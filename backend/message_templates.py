"""Message templates for driver SMS notifications."""


def get_overspeed_template(speed: float, threshold: float) -> str:
    """Generate overspeed alert message template."""
    return (
        f"ALERT: Overspeed detected. Current speed: {speed:.1f} km/h "
        f"(limit: {threshold:.1f} km/h). Please reduce speed immediately for safety."
    )


def get_door_open_template(speed: float) -> str:
    """Generate door open while moving alert message template."""
    return (
        f"ALERT: Door is open while bus is moving (speed: {speed:.1f} km/h). "
        f"Please close the door immediately for passenger safety."
    )


def get_custom_template(base_message: str, custom_note: str | None) -> str:
    """Combine base message with optional custom note."""
    if custom_note:
        return f"{base_message}\n\nNote: {custom_note}"
    return base_message

