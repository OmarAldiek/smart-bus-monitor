"""Pydantic schemas for API payloads."""
from __future__ import annotations

from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class TelemetryIn(BaseModel):
    bus_id: str = Field(alias="busId")
    timestamp: datetime
    lat: float
    lon: float
    speed_kmh: float
    occupancy: int
    door_open: bool
    engine_on: bool

    model_config = ConfigDict(populate_by_name=True)


class TelemetryOut(BaseModel):
    bus_id: str = Field(alias="busId")
    timestamp: datetime
    lat: float
    lon: float
    speed_kmh: float
    occupancy: int
    door_open: bool
    engine_on: bool

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)


class BusLatestTelemetry(TelemetryOut):
    name: str | None = None
    capacity: int | None = None


class AlertOut(BaseModel):
    id: int
    bus_id: str = Field(alias="busId")
    timestamp: datetime
    type: str
    value: float
    threshold: float
    message: str

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)


class ConfigResponse(BaseModel):
    overspeed_threshold: float
    poll_interval_seconds: int
    thingspeak_enabled: bool
    auto_sms_enabled: bool


class ConfigUpdate(BaseModel):
    overspeed_threshold: float | None = Field(default=None, ge=10, le=150)
    poll_interval_seconds: int | None = Field(default=None, ge=1, le=60)
    thingspeak_enabled: bool | None = None
    auto_sms_enabled: bool | None = None


class SimulatorStartRequest(BaseModel):
    bus_ids: list[str] | None = Field(default=None, min_length=1)


class SimulatorBusStatus(BaseModel):
    bus_id: str = Field(alias="busId")
    messages_sent: int
    last_publish: datetime | None
    stationary: bool = False

    model_config = ConfigDict(populate_by_name=True)


class SimulatorStatusResponse(BaseModel):
    running: bool
    started_at: datetime | None
    bus_count: int
    buses: list[SimulatorBusStatus]


class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=64)
    password: str = Field(min_length=6)
    role: str = Field(default="operator")


class UserOut(BaseModel):
    id: int
    username: str
    role: str

    model_config = ConfigDict(from_attributes=True)


class MessageSendRequest(BaseModel):
    bus_id: str
    alert_id: int | None = None
    template_type: str = Field(description="overspeed, door_open, or custom")
    custom_note: str | None = None
    speed: float | None = None
    threshold: float | None = None


class MessageOut(BaseModel):
    id: int
    bus_id: str = Field(alias="busId")
    alert_id: int | None = Field(alias="alertId", default=None)
    message_text: str
    template_type: str
    custom_note: str | None = None
    sent_by_user_id: int = Field(alias="sentByUserId")
    sent_at: datetime = Field(alias="sentAt")
    status: str
    delivered_at: datetime | None = Field(alias="deliveredAt", default=None)
    read_at: datetime | None = Field(alias="readAt", default=None)
    error_message: str | None = Field(alias="errorMessage", default=None)

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)


class MessageTemplateInfo(BaseModel):
    type: str
    name: str
    example: str
