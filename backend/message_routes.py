"""Message-related FastAPI routes for sending and managing driver SMS messages."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from auth import get_current_user
from crud import get_driver_message_by_id, get_driver_messages
from db import get_db
from message_service import send_driver_message
from models import Alert, User
from schemas import MessageOut, MessageSendRequest, MessageTemplateInfo

router = APIRouter()


@router.post("/api/messages/send", response_model=MessageOut, status_code=status.HTTP_201_CREATED)
async def send_message(
    payload: MessageSendRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Send a message to a bus driver."""
    # Validate template type
    if payload.template_type not in ("overspeed", "door_open", "custom"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="template_type must be 'overspeed', 'door_open', or 'custom'",
        )

    # If alert_id is provided, validate it exists and get speed/threshold if needed
    speed = payload.speed
    threshold = payload.threshold
    if payload.alert_id:
        alert = db.query(Alert).filter(Alert.id == payload.alert_id).first()
        if not alert:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alert not found")
        if alert.bus_id != payload.bus_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="Alert does not belong to specified bus"
            )
        # Use alert data if speed/threshold not provided
        if speed is None:
            speed = alert.value
        if threshold is None and payload.template_type == "overspeed":
            threshold = alert.threshold

    # Send the message
    message_id = send_driver_message(
        db=db,
        bus_id=payload.bus_id,
        template_type=payload.template_type,
        sent_by_user_id=current_user.id,
        alert_id=payload.alert_id,
        custom_note=payload.custom_note,
        speed=speed,
        threshold=threshold,
    )

    # Return the created message
    message = get_driver_message_by_id(db, message_id)
    if not message:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create message")
    return message


@router.get("/api/messages", response_model=list[MessageOut])
async def list_messages(
    bus_id: str | None = Query(None, description="Filter by bus ID"),
    limit: int = Query(100, ge=1, le=500, description="Maximum number of messages to return"),
    offset: int = Query(0, ge=0, description="Number of messages to skip"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List driver messages with optional filtering."""
    messages = get_driver_messages(db, bus_id=bus_id, limit=limit, offset=offset)
    return messages


@router.get("/api/messages/{message_id}", response_model=MessageOut)
async def get_message(
    message_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a single message by ID."""
    message = get_driver_message_by_id(db, message_id)
    if not message:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")
    return message


@router.get("/api/messages/templates", response_model=list[MessageTemplateInfo])
async def get_templates(current_user: User = Depends(get_current_user)):
    """Get available message templates."""
    return [
        MessageTemplateInfo(
            type="overspeed",
            name="Overspeed Alert",
            example="ALERT: Overspeed detected. Current speed: 85.0 km/h (limit: 70.0 km/h). Please reduce speed immediately for safety.",
        ),
        MessageTemplateInfo(
            type="door_open",
            name="Door Open While Moving",
            example="ALERT: Door is open while bus is moving (speed: 25.0 km/h). Please close the door immediately for passenger safety.",
        ),
        MessageTemplateInfo(
            type="custom",
            name="Custom Message",
            example="ALERT: Please check your bus status immediately.",
        ),
    ]

