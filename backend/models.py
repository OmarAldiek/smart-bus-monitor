"""SQLAlchemy models for buses, telemetry, alerts, and configuration."""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db import Base


class Bus(Base):
    __tablename__ = "buses"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    bus_id: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    name: Mapped[str | None]
    capacity: Mapped[int | None]

    telemetry: Mapped[list["Telemetry"]] = relationship("Telemetry", back_populates="bus", cascade="all, delete-orphan")
    alerts: Mapped[list["Alert"]] = relationship("Alert", back_populates="bus", cascade="all, delete-orphan")


class Telemetry(Base):
    __tablename__ = "telemetry"

    id: Mapped[int] = mapped_column(primary_key=True)
    bus_id: Mapped[str] = mapped_column(String(64), ForeignKey("buses.bus_id"), index=True, nullable=False)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True, nullable=False)
    lat: Mapped[float] = mapped_column(Float, nullable=False)
    lon: Mapped[float] = mapped_column(Float, nullable=False)
    speed_kmh: Mapped[float] = mapped_column(Float, nullable=False)
    occupancy: Mapped[int] = mapped_column(Integer, nullable=False)
    door_open: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    engine_on: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    bus: Mapped[Bus] = relationship("Bus", back_populates="telemetry")


class Alert(Base):
    __tablename__ = "alerts"

    id: Mapped[int] = mapped_column(primary_key=True)
    bus_id: Mapped[str] = mapped_column(String(64), ForeignKey("buses.bus_id"), index=True, nullable=False)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    type: Mapped[str] = mapped_column(String(64), nullable=False)
    value: Mapped[float] = mapped_column(Float, nullable=False)
    threshold: Mapped[float] = mapped_column(Float, nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)

    bus: Mapped[Bus] = relationship("Bus", back_populates="alerts")


class SystemConfig(Base):
    __tablename__ = "system_config"

    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    value: Mapped[str] = mapped_column(Text, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=func.now(), onupdate=func.now()
    )


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(32), nullable=False, default="operator")


class DriverMessage(Base):
    __tablename__ = "driver_messages"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    bus_id: Mapped[str] = mapped_column(String(64), ForeignKey("buses.bus_id"), index=True, nullable=False)
    alert_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("alerts.id"), nullable=True, index=True)
    message_text: Mapped[str] = mapped_column(Text, nullable=False)
    template_type: Mapped[str] = mapped_column(String(64), nullable=False)
    custom_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    sent_by_user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    sent_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="pending", index=True)
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
