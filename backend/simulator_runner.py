"""Server-managed bus simulator threads."""
from __future__ import annotations

import json
import random
import threading
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Dict, List, Sequence, Tuple

import paho.mqtt.client as mqtt

from settings import settings

ROUTES: Sequence[Sequence[Tuple[float, float]]] = (
    ((25.2048, 55.2708), (25.1983, 55.2750), (25.1905, 55.2639), (25.2058, 55.2526)),
    ((25.0797, 55.1402), (25.0916, 55.1469), (25.1007, 55.1544), (25.0755, 55.1549)),
    ((25.2155, 55.2462), (25.2074, 55.2580), (25.1991, 55.2465), (25.2103, 55.2386)),
    ((25.2705, 55.3152), (25.2716, 55.2991), (25.2620, 55.2841), (25.2492, 55.3066)),
    ((25.1189, 55.4090), (25.0985, 55.3912), (25.0841, 55.3685), (25.0719, 55.3496)),
)

DEFAULT_BUS_IDS = [f"bus-{i}" for i in range(1, 14)]


@dataclass
class SimulatorMetrics:
    last_publish: datetime | None = None
    messages_sent: int = 0


class BusSimulatorThread(threading.Thread):
    def __init__(self, bus_id: str, stop_event: threading.Event, stationary: bool = False) -> None:
        super().__init__(daemon=True)
        self.bus_id = bus_id
        self.stop_event = stop_event
        self.stationary = stationary
        self._local_stop = None  # For individual stopping
        self.metrics = SimulatorMetrics()
        self.route = ROUTES[(self._extract_number(bus_id) - 1) % len(ROUTES)]
        self.segment_index = 0
        self.progress = 0.0
        self.door_open = False
        self.last_toggle = time.time()
        # For stationary buses, keep them at the first route point
        if self.stationary:
            self.segment_index = 0
            self.progress = 0.0

    @staticmethod
    def _extract_number(bus_id: str) -> int:
        try:
            return int(bus_id.split("-")[-1])
        except (ValueError, IndexError):
            return random.randint(1, 99)

    def _next_point(self) -> Tuple[float, float]:
        if len(self.route) < 2:
            raise ValueError("Route requires at least two coordinates")
        if self.stationary:
            # Stationary buses stay at the first route point with small random variations
            start_lat, start_lon = self.route[0]
            return start_lat + random.uniform(-0.0001, 0.0001), start_lon + random.uniform(-0.0001, 0.0001)
        self.progress += random.uniform(0.08, 0.25)
        while self.progress >= 1.0:
            self.progress -= 1.0
            self.segment_index = (self.segment_index + 1) % len(self.route)
        start_lat, start_lon = self.route[self.segment_index]
        end_lat, end_lon = self.route[(self.segment_index + 1) % len(self.route)]
        lat = start_lat + (end_lat - start_lat) * self.progress
        lon = start_lon + (end_lon - start_lon) * self.progress
        return lat + random.uniform(-0.0005, 0.0005), lon + random.uniform(-0.0005, 0.0005)

    def _compute_speed(self) -> float:
        if self.stationary:
            # Stationary buses have very low speed (0-5 km/h)
            return round(random.uniform(0.0, 5.0), 1)
        speed = max(0.0, random.gauss(50, 8))
        if random.random() < 0.15:
            speed += random.uniform(15, 35)
        return round(speed, 1)

    def run(self) -> None:
        client = mqtt.Client(client_id=f"manager-{self.bus_id}-{random.randint(1000,9999)}")
        client.username_pw_set(settings.mqtt_username, settings.mqtt_password)
        client.connect(settings.mqtt_host, settings.mqtt_port, keepalive=60)
        client.loop_start()
        topic = f"school/bus/{self.bus_id}/telemetry"

        try:
            while not (self._local_stop and self._local_stop.is_set()) and not self.stop_event.is_set():
                timestamp = datetime.now(timezone.utc)
                lat, lon = self._next_point()
                speed = self._compute_speed()
                if time.time() - self.last_toggle > random.uniform(20, 60):
                    self.door_open = not self.door_open
                    self.last_toggle = time.time()
                occupancy = random.randint(0, 30)
                payload = {
                    "busId": self.bus_id,
                    "timestamp": timestamp.isoformat(),
                    "lat": round(lat, 6),
                    "lon": round(lon, 6),
                    "speed_kmh": speed,
                    "occupancy": occupancy,
                    "door_open": self.door_open,
                    "engine_on": True,
                }
                client.publish(topic, json.dumps(payload), qos=1)
                self.metrics.last_publish = timestamp
                self.metrics.messages_sent += 1
                time.sleep(random.uniform(3.0, 5.0))
        finally:
            client.loop_stop()
            client.disconnect()


class SimulatorManager:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._threads: Dict[str, BusSimulatorThread] = {}
        self._stop_event = threading.Event()
        self._started_at: datetime | None = None
        # Mark some buses as stationary (buses 1, 5, 9, 13) for SMS alert simulation
        self._stationary_buses = {"bus-1", "bus-5", "bus-9", "bus-13"}

    def _status_locked(self) -> Dict[str, object]:
        buses = [
            {
                "busId": bus_id,
                "messages_sent": thread.metrics.messages_sent,
                "last_publish": thread.metrics.last_publish,
                "stationary": thread.stationary,
            }
            for bus_id, thread in self._threads.items()
        ]
        return {
            "running": bool(self._threads),
            "started_at": self._started_at,
            "bus_count": len(self._threads),
            "buses": buses,
        }

    def start(self, bus_ids: List[str] | None = None) -> Dict[str, object]:
        with self._lock:
            ids = bus_ids or DEFAULT_BUS_IDS
            # Start only buses that aren't already running
            new_buses = [bus_id for bus_id in ids if bus_id not in self._threads]
            if not new_buses:
                return self._status_locked()
            if not self._threads:
                self._stop_event.clear()
                self._started_at = datetime.now(timezone.utc)
            for bus_id in new_buses:
                stationary = bus_id in self._stationary_buses
                thread = BusSimulatorThread(bus_id, self._stop_event, stationary=stationary)
                thread.start()
                self._threads[bus_id] = thread
            return self._status_locked()

    def start_bus(self, bus_id: str) -> Dict[str, object]:
        """Start a single bus simulator."""
        with self._lock:
            if bus_id in self._threads:
                return self._status_locked()
            if not self._threads:
                self._stop_event.clear()
                self._started_at = datetime.now(timezone.utc)
            stationary = bus_id in self._stationary_buses
            thread = BusSimulatorThread(bus_id, self._stop_event, stationary=stationary)
            thread.start()
            self._threads[bus_id] = thread
            return self._status_locked()

    def stop_bus(self, bus_id: str) -> Dict[str, object]:
        """Stop a single bus simulator."""
        with self._lock:
            if bus_id not in self._threads:
                return self._status_locked()
            thread = self._threads[bus_id]
            # Create a per-thread stop event for individual stopping
            thread._local_stop = threading.Event()
            thread._local_stop.set()
            thread.join(timeout=1.0)
            del self._threads[bus_id]
            if not self._threads:
                self._started_at = None
            return self._status_locked()

    def stop(self) -> Dict[str, object]:
        with self._lock:
            if not self._threads:
                return self._status_locked()
            self._stop_event.set()
            for thread in self._threads.values():
                thread.join(timeout=1.0)
            self._threads.clear()
            self._started_at = None
            self._stop_event = threading.Event()
            return self._status_locked()

    def status(self) -> Dict[str, object]:
        with self._lock:
            return self._status_locked()


simulator_manager = SimulatorManager()
