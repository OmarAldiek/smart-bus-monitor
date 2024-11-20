"""Application settings loaded from environment variables."""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from typing import Any, Dict

from dotenv import load_dotenv

load_dotenv()


def _to_bool(value: str | None, default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


@dataclass
class Settings:
    mqtt_host: str = os.getenv("MQTT_HOST", "mosquitto")
    mqtt_port: int = int(os.getenv("MQTT_PORT", "1883"))
    mqtt_username: str = os.getenv("MQTT_USERNAME", "studentbus")
    mqtt_password: str = os.getenv("MQTT_PASSWORD", "studentbus123")

    postgres_host: str = os.getenv("POSTGRES_HOST", "postgres")
    postgres_port: int = int(os.getenv("POSTGRES_PORT", "5432"))
    postgres_db: str = os.getenv("POSTGRES_DB", "busdb")
    postgres_user: str = os.getenv("POSTGRES_USER", "bususer")
    postgres_password: str = os.getenv("POSTGRES_PASSWORD", "buspass")

    thingspeak_channel_id: str | None = os.getenv("THINGSPEAK_CHANNEL_ID")
    thingspeak_mqtt_api_key: str | None = os.getenv("THINGSPEAK_MQTT_API_KEY")
    thingspeak_enabled_env: bool = _to_bool(os.getenv("THINGSPEAK_ENABLED"), False)

    overspeed_default: float = float(os.getenv("CONFIG_OVERSPEED_THRESHOLD", "70"))
    poll_interval_default: int = int(os.getenv("CONFIG_POLL_INTERVAL_SECONDS", "5"))

    config_defaults: Dict[str, Any] = field(init=False)

    def __post_init__(self) -> None:
        self.config_defaults = {
            "overspeed_threshold": self.overspeed_default,
            "poll_interval_seconds": self.poll_interval_default,
            "thingspeak_enabled": self.thingspeak_enabled,
            "auto_sms_enabled": False,
        }

    @property
    def database_url(self) -> str:
        return (
            f"postgresql+psycopg2://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    @property
    def thingspeak_enabled(self) -> bool:
        return self.thingspeak_enabled_env and bool(self.thingspeak_channel_id and self.thingspeak_mqtt_api_key)


settings = Settings()
