"""CRUD helpers for database interactions."""
from __future__ import annotations

from datetime import datetime
from typing import Dict, List, Tuple

from sqlalchemy import and_, func
from sqlalchemy.orm import Session

from models import Alert, Bus, DriverMessage, SystemConfig, Telemetry
from schemas import TelemetryIn


def get_or_create_bus(db: Session, bus_id: str) -> Bus:
    bus = db.query(Bus).filter(Bus.bus_id == bus_id).first()
    if bus is None:
        bus = Bus(bus_id=bus_id)
        db.add(bus)
        db.commit()
        db.refresh(bus)
    return bus


def create_telemetry(db: Session, telemetry_in: TelemetryIn) -> Telemetry:
    telemetry = Telemetry(
        bus_id=telemetry_in.bus_id,
        timestamp=telemetry_in.timestamp,
        lat=telemetry_in.lat,
        lon=telemetry_in.lon,
        speed_kmh=telemetry_in.speed_kmh,
        occupancy=telemetry_in.occupancy,
        door_open=telemetry_in.door_open,
        engine_on=telemetry_in.engine_on,
    )
    db.add(telemetry)
    db.flush()
    return telemetry


def create_alert(db: Session, bus_id: str, timestamp: datetime, alert_type: str, value: float, threshold: float, message: str) -> Alert:
    alert = Alert(
        bus_id=bus_id,
        timestamp=timestamp,
        type=alert_type,
        value=value,
        threshold=threshold,
        message=message,
    )
    db.add(alert)
    db.flush()
    return alert


def get_latest_telemetry_per_bus(db: Session) -> List[Tuple[Telemetry, Bus | None]]:
    subquery = (
        db.query(Telemetry.bus_id, func.max(Telemetry.timestamp).label("max_timestamp"))
        .group_by(Telemetry.bus_id)
        .subquery()
    )
    results = (
        db.query(Telemetry, Bus)
        .join(subquery, and_(Telemetry.bus_id == subquery.c.bus_id, Telemetry.timestamp == subquery.c.max_timestamp))
        .outerjoin(Bus, Bus.bus_id == Telemetry.bus_id)
        .order_by(Telemetry.bus_id)
        .all()
    )
    return results


def get_telemetry_history(
    db: Session, bus_id: str, from_ts: datetime | None = None, to_ts: datetime | None = None
) -> List[Telemetry]:
    query = db.query(Telemetry).filter(Telemetry.bus_id == bus_id)
    if from_ts is not None:
        query = query.filter(Telemetry.timestamp >= from_ts)
    if to_ts is not None:
        query = query.filter(Telemetry.timestamp <= to_ts)
    return query.order_by(Telemetry.timestamp.asc()).all()


def get_recent_alerts(db: Session, limit: int = 50) -> List[Alert]:
    return db.query(Alert).order_by(Alert.timestamp.desc()).limit(limit).all()


def get_config_map(db: Session) -> Dict[str, str]:
    rows = db.query(SystemConfig).all()
    return {row.key: row.value for row in rows}


def upsert_config_values(db: Session, values: Dict[str, str]) -> Dict[str, str]:
    for key, value in values.items():
        entry = db.query(SystemConfig).filter(SystemConfig.key == key).first()
        if entry is None:
            entry = SystemConfig(key=key, value=value)
            db.add(entry)
        else:
            entry.value = value
    db.commit()
    return get_config_map(db)


def create_driver_message(
    db: Session,
    bus_id: str,
    message_text: str,
    template_type: str,
    sent_by_user_id: int,
    alert_id: int | None = None,
    custom_note: str | None = None,
) -> DriverMessage:
    """Create a new driver message record."""
    message = DriverMessage(
        bus_id=bus_id,
        alert_id=alert_id,
        message_text=message_text,
        template_type=template_type,
        custom_note=custom_note,
        sent_by_user_id=sent_by_user_id,
        sent_at=datetime.now(),
        status="pending",
    )
    db.add(message)
    db.flush()
    return message


def get_driver_messages(
    db: Session,
    bus_id: str | None = None,
    limit: int = 100,
    offset: int = 0,
) -> List[DriverMessage]:
    """Get driver messages with optional filtering."""
    query = db.query(DriverMessage)
    if bus_id is not None:
        query = query.filter(DriverMessage.bus_id == bus_id)
    return query.order_by(DriverMessage.sent_at.desc()).offset(offset).limit(limit).all()


def get_driver_message_by_id(db: Session, message_id: int) -> DriverMessage | None:
    """Get a single driver message by ID."""
    return db.query(DriverMessage).filter(DriverMessage.id == message_id).first()


def update_message_status(
    db: Session,
    message_id: int,
    status: str,
    delivered_at: datetime | None = None,
    read_at: datetime | None = None,
    error_message: str | None = None,
) -> DriverMessage | None:
    """Update message status and related timestamps."""
    message = db.query(DriverMessage).filter(DriverMessage.id == message_id).first()
    if message is None:
        return None
    message.status = status
    if delivered_at is not None:
        message.delivered_at = delivered_at
    if read_at is not None:
        message.read_at = read_at
    if error_message is not None:
        message.error_message = error_message
    db.flush()
    return message
