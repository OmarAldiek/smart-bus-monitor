"""Service for sending SMS messages to bus drivers with full simulation."""
from __future__ import annotations

import logging
import random
import threading
import time
from datetime import datetime, timezone

from sqlalchemy.orm import Session

import crud
from message_templates import get_custom_template, get_door_open_template, get_overspeed_template

logger = logging.getLogger(__name__)


def send_driver_message(
    db: Session,
    bus_id: str,
    template_type: str,
    sent_by_user_id: int,
    alert_id: int | None = None,
    custom_note: str | None = None,
    speed: float | None = None,
    threshold: float | None = None,
) -> int:
    """
    Send a driver message and simulate the full SMS lifecycle.
    Returns the message ID.
    """
    # Generate message text based on template type
    if template_type == "overspeed" and speed is not None and threshold is not None:
        base_message = get_overspeed_template(speed, threshold)
    elif template_type == "door_open" and speed is not None:
        base_message = get_door_open_template(speed)
    else:
        # Fallback for custom or unknown types
        base_message = "ALERT: Please check your bus status immediately."

    message_text = get_custom_template(base_message, custom_note)

    # Create message record with pending status
    message = crud.create_driver_message(
        db=db,
        bus_id=bus_id,
        message_text=message_text,
        template_type=template_type,
        sent_by_user_id=sent_by_user_id,
        alert_id=alert_id,
        custom_note=custom_note,
    )
    db.commit()
    message_id = message.id

    # Start background simulation thread
    thread = threading.Thread(
        target=_simulate_sms_lifecycle,
        args=(message_id, bus_id, message_text),
        daemon=True,
    )
    thread.start()

    logger.info(f"Started SMS simulation for message {message_id} to bus {bus_id}")
    return message_id


def _simulate_sms_lifecycle(message_id: int, bus_id: str, message_text: str) -> None:
    """Simulate the complete SMS lifecycle in a background thread."""
    from db import SessionLocal

    db = SessionLocal()
    try:
        # Step 1: Simulate SMS API call (1-3 seconds delay)
        send_delay = random.uniform(1.0, 3.0)
        time.sleep(send_delay)

        # Check for failure (5% chance)
        if random.random() < 0.05:
            error_msg = "SMS gateway timeout"
            crud.update_message_status(
                db, message_id, "failed", error_message=error_msg
            )
            db.commit()
            logger.warning(f"SMS simulation failed for message {message_id}: {error_msg}")
            return

        # Update status to "sent"
        crud.update_message_status(db, message_id, "sent")
        db.commit()
        logger.info(f"[SMS SIMULATION] Message {message_id} sent to driver of {bus_id}")

        # Step 2: Simulate delivery confirmation (2-5 seconds after sent)
        delivery_delay = random.uniform(2.0, 5.0)
        time.sleep(delivery_delay)

        # Check for delivery failure (small chance)
        if random.random() < 0.03:
            error_msg = "Message delivery failed - recipient unreachable"
            crud.update_message_status(
                db, message_id, "failed", error_message=error_msg
            )
            db.commit()
            logger.warning(f"SMS delivery failed for message {message_id}: {error_msg}")
            return

        # Update status to "delivered"
        delivered_at = datetime.now(timezone.utc)
        crud.update_message_status(db, message_id, "delivered", delivered_at=delivered_at)
        db.commit()
        logger.info(f"[SMS SIMULATION] Message {message_id} delivered to driver of {bus_id}")

        # Step 3: Simulate read acknowledgment (5-15 seconds after delivered, 70% chance)
        if random.random() < 0.70:
            read_delay = random.uniform(5.0, 15.0)
            time.sleep(read_delay)
            read_at = datetime.now(timezone.utc)
            crud.update_message_status(db, message_id, "read", read_at=read_at)
            db.commit()
            logger.info(f"[SMS SIMULATION] Message {message_id} read by driver of {bus_id}")
        else:
            logger.info(f"[SMS SIMULATION] Message {message_id} delivered but not read yet")

    except Exception as e:
        logger.exception(f"Error in SMS simulation for message {message_id}: {e}")
        try:
            crud.update_message_status(
                db, message_id, "failed", error_message=str(e)
            )
            db.commit()
        except Exception:
            pass
    finally:
        db.close()

