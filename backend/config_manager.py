"""Configuration utilities stored in the database."""
from __future__ import annotations

from typing import Any, Dict

from sqlalchemy.orm import Session

import crud
from schemas import ConfigResponse, ConfigUpdate
from settings import settings


def _to_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() in {"1", "true", "yes", "on"}


CONFIG_CASTERS = {
    "overspeed_threshold": float,
    "poll_interval_seconds": int,
    "thingspeak_enabled": _to_bool,
    "auto_sms_enabled": _to_bool,
}


def _serialize(value: Any) -> str:
    if isinstance(value, bool):
        return "true" if value else "false"
    return str(value)


def ensure_defaults(db: Session) -> None:
    existing = crud.get_config_map(db)
    missing: Dict[str, str] = {}
    for key, default_value in settings.config_defaults.items():
        if key not in existing:
            missing[key] = _serialize(default_value)
    if missing:
        crud.upsert_config_values(db, missing)


def get_config(db: Session) -> ConfigResponse:
    raw = settings.config_defaults | crud.get_config_map(db)
    typed: Dict[str, Any] = {}
    for key, caster in CONFIG_CASTERS.items():
        value = raw.get(key)
        if value is None:
            typed[key] = settings.config_defaults[key]
            continue
        if isinstance(value, str):
            typed[key] = caster(value)
        else:
            typed[key] = value
    return ConfigResponse(**typed)


def update_config(db: Session, payload: ConfigUpdate) -> ConfigResponse:
    updates: Dict[str, str] = {}
    if payload.overspeed_threshold is not None:
        updates["overspeed_threshold"] = _serialize(payload.overspeed_threshold)
    if payload.poll_interval_seconds is not None:
        updates["poll_interval_seconds"] = _serialize(payload.poll_interval_seconds)
    if payload.thingspeak_enabled is not None:
        updates["thingspeak_enabled"] = _serialize(payload.thingspeak_enabled)
    if payload.auto_sms_enabled is not None:
        updates["auto_sms_enabled"] = _serialize(payload.auto_sms_enabled)
    if updates:
        crud.upsert_config_values(db, updates)
    return get_config(db)
