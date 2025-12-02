"""MQTT subscriber that ingests telemetry and emits alerts."""
from __future__ import annotations

import json
import logging
import random
from typing import Optional

import paho.mqtt.client as mqtt
import paho.mqtt.publish as publish
from pydantic import ValidationError

import config_manager
import crud
from db import SessionLocal
from message_service import send_driver_message
from models import User
from schemas import TelemetryIn
from settings import settings

logger = logging.getLogger(__name__)

TELEMETRY_TOPIC = "school/bus/+/telemetry"
ALERT_TOPIC_TEMPLATE = "school/bus/{bus_id}/alerts"


class ThingSpeakForwarder:
    def __init__(self) -> None:
        self.channel_id = settings.thingspeak_channel_id
        self.api_key = settings.thingspeak_mqtt_api_key
        self.enabled_by_env = settings.thingspeak_enabled

    def forward_speed(self, bus_id: str, speed_kmh: float, config_enabled: bool) -> None:
        if not (self.enabled_by_env and config_enabled):
            return
        if not (self.channel_id and self.api_key):
            return
        topic = f"channels/{self.channel_id}/publish/fields/field1"
        payload = f"field1={speed_kmh:.1f}"
        try:
            publish.single(
                topic,
                payload=payload,
                hostname="mqtt.thingspeak.com",
                port=1883,
                auth={"username": self.api_key, "password": self.api_key},
                client_id=f"ts-{bus_id}-{random.randint(1000,9999)}",
                keepalive=30,
            )
        except Exception:
            logger.exception("Failed to forward telemetry to ThingSpeak")


class MQTTIngestor:
    def __init__(self) -> None:
        self.client: Optional[mqtt.Client] = None
        self.thingspeak = ThingSpeakForwarder()

    def start(self) -> None:
        if self.client is not None:
            return
        self.client = mqtt.Client(client_id=f"backend-subscriber-{random.randint(1000,9999)}")
        if settings.mqtt_username:
            self.client.username_pw_set(settings.mqtt_username, settings.mqtt_password)
        self.client.on_connect = self.on_connect
        self.client.on_message = self.on_message
        logger.info("Connecting to MQTT broker %s:%s", settings.mqtt_host, settings.mqtt_port)
        self.client.connect(settings.mqtt_host, settings.mqtt_port, keepalive=60)
        self.client.loop_start()

    def stop(self) -> None:
        if self.client is None:
            return
        self.client.loop_stop()
        self.client.disconnect()
        self.client = None

    def on_connect(self, client: mqtt.Client, userdata, flags, rc):  # type: ignore[override]
        if rc == 0:
            logger.info("Connected to MQTT broker, subscribing to %s", TELEMETRY_TOPIC)
            client.subscribe(TELEMETRY_TOPIC)
        else:
            logger.error("Failed to connect to MQTT broker, rc=%s", rc)

    def on_message(self, client: mqtt.Client, userdata, message):  # type: ignore[override]
        try:
            payload = message.payload.decode("utf-8")
            telemetry_in = TelemetryIn.model_validate_json(payload)
        except (UnicodeDecodeError, ValidationError) as exc:
            logger.error("Invalid telemetry payload: %s", exc)
            return

        db = SessionLocal()
        try:
            crud.get_or_create_bus(db, telemetry_in.bus_id)
            telemetry = crud.create_telemetry(db, telemetry_in)
            config = config_manager.get_config(db)

            alerts_created = []
            
            # Check for overspeed
            if telemetry.speed_kmh > config.overspeed_threshold:
                message_text = (
                    f"Overspeed detected: {telemetry.speed_kmh:.1f} km/h > {config.overspeed_threshold:.1f}"
                )
                alert = crud.create_alert(
                    db,
                    bus_id=telemetry.bus_id,
                    timestamp=telemetry.timestamp,
                    alert_type="overspeed",
                    value=telemetry.speed_kmh,
                    threshold=config.overspeed_threshold,
                    message=message_text,
                )
                alerts_created.append(alert)
                
                # Auto-send SMS if enabled
                if config.auto_sms_enabled:
                    system_user = db.query(User).filter(User.role == "admin").first()
                    if system_user:
                        try:
                            send_driver_message(
                                db=db,
                                bus_id=telemetry.bus_id,
                                template_type="overspeed",
                                sent_by_user_id=system_user.id,
                                alert_id=alert.id,
                                speed=telemetry.speed_kmh,
                                threshold=config.overspeed_threshold,
                            )
                            logger.info(
                                "[AUTO SMS] Sent SMS to driver of %s for overspeed alert",
                                telemetry.bus_id
                            )
                        except Exception as e:
                            logger.exception("Failed to send auto SMS for overspeed alert: %s", e)
                else:
                    logger.info(
                        "[SMS SIMULATION] Auto SMS disabled - would send SMS to driver of %s: ALERT - Overspeed: %.1f km/h (threshold: %.1f km/h). "
                        "Please reduce speed immediately.",
                        telemetry.bus_id, telemetry.speed_kmh, config.overspeed_threshold
                    )

            # Check for door open while moving (speed > 5 km/h)
            DOOR_OPEN_SPEED_THRESHOLD = 5.0
            if telemetry.door_open and telemetry.speed_kmh > DOOR_OPEN_SPEED_THRESHOLD:
                message_text = (
                    f"Door open while moving: door is open and speed is {telemetry.speed_kmh:.1f} km/h > {DOOR_OPEN_SPEED_THRESHOLD:.1f}"
                )
                alert = crud.create_alert(
                    db,
                    bus_id=telemetry.bus_id,
                    timestamp=telemetry.timestamp,
                    alert_type="door_open_while_moving",
                    value=telemetry.speed_kmh,
                    threshold=DOOR_OPEN_SPEED_THRESHOLD,
                    message=message_text,
                )
                alerts_created.append(alert)
                
                # Auto-send SMS if enabled
                if config.auto_sms_enabled:
                    system_user = db.query(User).filter(User.role == "admin").first()
                    if system_user:
                        try:
                            send_driver_message(
                                db=db,
                                bus_id=telemetry.bus_id,
                                template_type="door_open",
                                sent_by_user_id=system_user.id,
                                alert_id=alert.id,
                                speed=telemetry.speed_kmh,
                            )
                            logger.info(
                                "[AUTO SMS] Sent SMS to driver of %s for door open alert",
                                telemetry.bus_id
                            )
                        except Exception as e:
                            logger.exception("Failed to send auto SMS for door open alert: %s", e)
                else:
                    logger.info(
                        "[SMS SIMULATION] Auto SMS disabled - would send SMS to driver of %s: ALERT - Door is open while bus is moving "
                        "(speed: %.1f km/h). Please close the door immediately for passenger safety.",
                        telemetry.bus_id, telemetry.speed_kmh
                )

            db.commit()

            # Publish alerts to MQTT
            for alert_created in alerts_created:
                alert_payload = {
                    "busId": telemetry.bus_id,
                    "timestamp": telemetry.timestamp.isoformat(),
                    "type": alert_created.type,
                    "value": alert_created.value,
                    "threshold": alert_created.threshold,
                    "message": alert_created.message,
                }
                alert_topic = ALERT_TOPIC_TEMPLATE.format(bus_id=telemetry.bus_id)
                client.publish(alert_topic, json.dumps(alert_payload), qos=1)

            self.thingspeak.forward_speed(telemetry.bus_id, telemetry.speed_kmh, config.thingspeak_enabled)
        except Exception:
            db.rollback()
            logger.exception("Failed to process telemetry message")
        finally:
            db.close()


mqtt_ingestor = MQTTIngestor()
