#!/usr/bin/env python3
"""Bus telemetry simulator publishing MQTT messages for the Smart School Bus project."""
from __future__ import annotations

import argparse
import json
import os
import random
import signal
import sys
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Iterable, List, Sequence, Tuple

import paho.mqtt.client as mqtt

# Rough Dubai-area routes (lat, lon pairs) to keep simulated buses localized.
ROUTES: Sequence[Sequence[Tuple[float, float]]] = (
    # Downtown / Business Bay
    ((25.2048, 55.2708), (25.1983, 55.2750), (25.1905, 55.2639), (25.2058, 55.2526)),
    # Dubai Marina / JBR
    ((25.0797, 55.1402), (25.0916, 55.1469), (25.1007, 55.1544), (25.0755, 55.1549)),
    # Jumeirah / City Walk
    ((25.2155, 55.2462), (25.2074, 55.2580), (25.1991, 55.2465), (25.2103, 55.2386)),
    # Deira / Creek
    ((25.2705, 55.3152), (25.2716, 55.2991), (25.2620, 55.2841), (25.2492, 55.3066)),
    # Academic City / Silicon Oasis
    ((25.1189, 55.4090), (25.0985, 55.3912), (25.0841, 55.3685), (25.0719, 55.3496)),
)


@dataclass
class RouteWalker:
    """Simple helper that walks along a polyline with smooth interpolation."""

    coordinates: Sequence[Tuple[float, float]]
    segment_index: int = 0
    progress: float = 0.0

    def next_point(self) -> Tuple[float, float]:
        if len(self.coordinates) < 2:
            raise ValueError("A route must provide at least two coordinates.")

        self.progress += random.uniform(0.08, 0.25)
        while self.progress >= 1.0:
            self.progress -= 1.0
            self.segment_index = (self.segment_index + 1) % len(self.coordinates)

        start_lat, start_lon = self.coordinates[self.segment_index]
        end_lat, end_lon = self.coordinates[(self.segment_index + 1) % len(self.coordinates)]
        lat = start_lat + (end_lat - start_lat) * self.progress
        lon = start_lon + (end_lon - start_lon) * self.progress
        jitter_lat = random.uniform(-0.0005, 0.0005)
        jitter_lon = random.uniform(-0.0005, 0.0005)
        return lat + jitter_lat, lon + jitter_lon


def parse_args(argv: Iterable[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="MQTT bus telemetry simulator")
    parser.add_argument("--bus-id", required=True, help="Identifier such as bus-1 .. bus-13")
    parser.add_argument("--mqtt-host", default=os.getenv("MQTT_HOST", "localhost"), help="MQTT broker host")
    parser.add_argument("--mqtt-port", type=int, default=int(os.getenv("MQTT_PORT", "1883")), help="MQTT broker port")
    parser.add_argument("--username", default=os.getenv("MQTT_USERNAME", "studentbus"), help="MQTT username")
    parser.add_argument("--password", default=os.getenv("MQTT_PASSWORD", "studentbus123"), help="MQTT password")
    parser.add_argument("--min-interval", type=float, default=3.0, help="Minimum seconds between telemetry publishes")
    parser.add_argument("--max-interval", type=float, default=5.0, help="Maximum seconds between telemetry publishes")
    parser.add_argument("--overspeed-threshold", type=float, default=float(os.getenv("OVERSPEED_THRESHOLD", 70)), help="Speed threshold for alerts (for reference in logs)")
    return parser.parse_args(list(argv))


def extract_bus_number(bus_id: str) -> int:
    try:
        return int(bus_id.split("-")[-1])
    except (ValueError, IndexError):
        return random.randint(1, 99)


def build_client(args: argparse.Namespace) -> mqtt.Client:
    client = mqtt.Client(client_id=f"sim-{args.bus_id}-{random.randint(1000,9999)}")
    client.username_pw_set(args.username, args.password)
    client.enable_logger()
    client.connect(args.mqtt_host, args.mqtt_port, keepalive=60)
    client.loop_start()
    return client


def compute_speed_kmh() -> float:
    speed = max(0.0, random.gauss(50, 8))
    if random.random() < 0.15:
        speed += random.uniform(15, 35)
    return round(speed, 1)


def simulate_bus(args: argparse.Namespace) -> None:
    bus_number = extract_bus_number(args.bus_id)
    route = ROUTES[(bus_number - 1) % len(ROUTES)]
    walker = RouteWalker(route)
    client = build_client(args)
    topic = f"school/bus/{args.bus_id}/telemetry"

    door_open = False
    last_toggle = time.time()

    running = True

    def handle_stop(signum, frame):  # type: ignore[override]
        nonlocal running
        running = False
        print("Received stop signal, shutting down simulator...")

    signal.signal(signal.SIGINT, handle_stop)
    signal.signal(signal.SIGTERM, handle_stop)

    print(
        f"Starting telemetry loop for {args.bus_id} on {args.mqtt_host}:{args.mqtt_port} using route #{(bus_number - 1) % len(ROUTES) + 1}"
    )

    try:
        while running:
            timestamp = datetime.now(timezone.utc).isoformat()
            lat, lon = walker.next_point()
            speed = compute_speed_kmh()

            if time.time() - last_toggle > random.uniform(20, 60):
                door_open = not door_open
                last_toggle = time.time()

            occupancy = random.randint(0, 30)
            payload = {
                "busId": args.bus_id,
                "timestamp": timestamp,
                "lat": round(lat, 6),
                "lon": round(lon, 6),
                "speed_kmh": speed,
                "occupancy": occupancy,
                "door_open": door_open,
                "engine_on": True,
            }

            result = client.publish(topic, json.dumps(payload), qos=1)
            status = result.rc
            if status != mqtt.MQTT_ERR_SUCCESS:
                print(f"Publish failed ({status}), will retry after delay")

            print(f"[{args.bus_id}] {timestamp} speed={speed}km/h occ={occupancy} door={'OPEN' if door_open else 'closed'}")
            time.sleep(random.uniform(args.min_interval, args.max_interval))
    finally:
        client.loop_stop()
        client.disconnect()


def main(argv: Iterable[str]) -> None:
    args = parse_args(argv)
    if args.min_interval > args.max_interval:
        args.min_interval, args.max_interval = args.max_interval, args.min_interval
    simulate_bus(args)


if __name__ == "__main__":
    main(sys.argv[1:])
