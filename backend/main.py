"""FastAPI application exposing bus telemetry and alerts."""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import List

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

import config_manager
import crud
from auth import get_current_user
from auth_routes import bootstrap_default_users, router as auth_router
from db import Base, SessionLocal, engine, get_db
from message_routes import router as message_router
from mqtt_client import mqtt_ingestor
from schemas import (
    AlertOut,
    BusLatestTelemetry,
    ConfigResponse,
    ConfigUpdate,
    SimulatorStartRequest,
    SimulatorStatusResponse,
    TelemetryOut,
)
from simulator_runner import simulator_manager

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger(__name__)

app = FastAPI(title="Smart School Bus Monitoring API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(auth_router)
app.include_router(message_router)


@app.on_event("startup")
async def startup_event() -> None:
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        config_manager.ensure_defaults(db)
        bootstrap_default_users(db)
    mqtt_ingestor.start()


@app.on_event("shutdown")
async def shutdown_event() -> None:
    mqtt_ingestor.stop()


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}


@app.get("/api/buses", response_model=List[BusLatestTelemetry])
async def list_buses(db: Session = Depends(get_db), user=Depends(get_current_user)):
    rows = crud.get_latest_telemetry_per_bus(db)
    response: List[BusLatestTelemetry] = []
    for telemetry, bus in rows:
        response.append(
            BusLatestTelemetry(
                busId=telemetry.bus_id,
                timestamp=telemetry.timestamp,
                lat=telemetry.lat,
                lon=telemetry.lon,
                speed_kmh=telemetry.speed_kmh,
                occupancy=telemetry.occupancy,
                door_open=telemetry.door_open,
                engine_on=telemetry.engine_on,
                name=bus.name if bus else None,
                capacity=bus.capacity if bus else None,
            )
        )
    return response


@app.get("/api/buses/{bus_id}/history", response_model=List[TelemetryOut])
async def bus_history(
    bus_id: str,
    from_ts: datetime | None = Query(None, alias="from"),
    to_ts: datetime | None = Query(None, alias="to"),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    if from_ts and to_ts and from_ts > to_ts:
        raise HTTPException(status_code=400, detail="`from` must be earlier than `to`.")
    if from_ts is None:
        from_ts = datetime.now(timezone.utc) - timedelta(hours=1)
    history = crud.get_telemetry_history(db, bus_id, from_ts, to_ts)
    return [
        TelemetryOut(
            busId=item.bus_id,
            timestamp=item.timestamp,
            lat=item.lat,
            lon=item.lon,
            speed_kmh=item.speed_kmh,
            occupancy=item.occupancy,
            door_open=item.door_open,
            engine_on=item.engine_on,
        )
        for item in history
    ]


@app.get("/api/alerts", response_model=List[AlertOut])
async def recent_alerts(
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    alerts = crud.get_recent_alerts(db, limit=limit)
    return [
        AlertOut(
            id=alert.id,
            busId=alert.bus_id,
            timestamp=alert.timestamp,
            type=alert.type,
            value=alert.value,
            threshold=alert.threshold,
            message=alert.message,
        )
        for alert in alerts
    ]


@app.get("/api/config", response_model=ConfigResponse)
async def read_config(db: Session = Depends(get_db), user=Depends(get_current_user)):
    return config_manager.get_config(db)


@app.put("/api/config", response_model=ConfigResponse)
async def update_config(payload: ConfigUpdate, db: Session = Depends(get_db), user=Depends(get_current_user)):
    return config_manager.update_config(db, payload)


@app.get("/api/simulators/status", response_model=SimulatorStatusResponse)
async def simulator_status(user=Depends(get_current_user)):
    return simulator_manager.status()


@app.post("/api/simulators/start", response_model=SimulatorStatusResponse)
async def simulator_start(payload: SimulatorStartRequest | None = None, user=Depends(get_current_user)):
    bus_ids = payload.bus_ids if payload else None
    return simulator_manager.start(bus_ids)


@app.post("/api/simulators/stop", response_model=SimulatorStatusResponse)
async def simulator_stop(user=Depends(get_current_user)):
    return simulator_manager.stop()


@app.post("/api/simulators/bus/{bus_id}/start", response_model=SimulatorStatusResponse)
async def simulator_start_bus(bus_id: str, user=Depends(get_current_user)):
    return simulator_manager.start_bus(bus_id)


@app.post("/api/simulators/bus/{bus_id}/stop", response_model=SimulatorStatusResponse)
async def simulator_stop_bus(bus_id: str, user=Depends(get_current_user)):
    return simulator_manager.stop_bus(bus_id)
