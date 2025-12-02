# Smart School Bus Fleet Monitoring System

A full-stack IoT reference implementation for monitoring a Dubai-based smart school bus fleet. The system ingests MQTT telemetry from 13 simulated buses, stores it in PostgreSQL via a FastAPI backend, surfaces alerts and analytics to a Tailwind-powered React dashboard, and optionally forwards overspeed data to ThingSpeak.

## Architecture Overview

- **Simulator (`/simulator`)** – Python script (`bus_simulator.py`) that publishes JSON telemetry (`school/bus/{busId}/telemetry`) every 3–5 seconds using paho-mqtt. Routes follow five Dubai corridors to keep coordinates realistic.
- **MQTT Broker (`mosquitto`)** – Runs inside Docker with username/password auth (development credentials defined in Compose / `.env`, not for production). The compose file auto-generates the password hash at startup.
- **Backend (`/backend`)** – FastAPI service with JWT authentication that subscribes to telemetry topics, persists buses/telemetry/alerts in PostgreSQL, emits overspeed and door-open-while-moving alerts to MQTT + REST (with simulated SMS logging), exposes ThingSpeak forwarding, REST APIs, configuration endpoint, and per-bus simulator control.
- **Frontend (`/frontend`)** – Create React App + Tailwind dashboard with Live Status, Bus Details, Alerts, Documentation, and Settings pages. Uses react-chartjs-2 for historical charts.
- **Infrastructure (`/infrastructure`)** – Docker Compose stack orchestrating Mosquitto, PostgreSQL, backend (uvicorn), and frontend (static build served via `serve`).

```
+------------+       MQTT       +-----------+      REST/WebSockets      +-----------+
| Simulators |  -->  Mosquitto  |  FastAPI  |  -->  React Dashboard     |   Users   |
+------------+                  +-----------+                            +-----------+
                                     | ThingSpeak (optional)
                                     v
                              mqtt.thingspeak.com
```

## Prerequisites

- Docker Desktop (or Docker Engine + Compose v2)
- Python 3.11+ (only required if you want to run the simulator outside Docker)
- Node.js 20+ (optional for local CRA development)

## Environment Variables

### Backend (`backend/.env`)

Copy `backend/.env.example` and edit as needed:

```
MQTT_HOST=mosquitto
MQTT_PORT=1883
MQTT_USERNAME=<mqtt_username>
MQTT_PASSWORD=<mqtt_password>
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_DB=busdb
POSTGRES_USER=<db_user>
POSTGRES_PASSWORD=<db_password>
THINGSPEAK_CHANNEL_ID=<channel>
THINGSPEAK_MQTT_MQTT_API_KEY=<api_key>
THINGSPEAK_ENABLED=false
CONFIG_OVERSPEED_THRESHOLD=70
CONFIG_POLL_INTERVAL_SECONDS=5
```

### Frontend (`frontend/.env`)

```
REACT_APP_API_BASE_URL=http://localhost:8000
```

> **ThingSpeak toggle:** The backend only tries to forward overspeed data when both `THINGSPEAK_ENABLED=true` (or toggled on via the Settings page) and valid `THINGSPEAK_*` secrets are provided.

## Running the Stack

```
cd infrastructure
docker compose up --build
```

Services:

| Service    | URL / Port | Notes                                  |
|------------|------------|----------------------------------------|
| Mosquitto  | `1883`     | Auth required (development credentials defined in Compose) |
| PostgreSQL | `5432`     | Credentials from `.env`                 |
| Backend    | `http://localhost:8000` | FastAPI + REST             |
| Frontend   | `http://localhost:3000` | CRA dashboard               |

Health check: `curl http://localhost:8000/health`

## Running the Simulator Fleet (13 buses)

Install deps once:
### Option A – Launch from the Dashboard (recommended)

1. Open `http://localhost:3000` and log in with a development admin user (seeded automatically on first run).
2. Go to **Settings → Simulator Control**.
3. Click **"Start 13 simulators"** to launch all buses, or use the per-bus controls in the table to start/stop individual buses.
4. Note: Buses 1, 5, 9, and 13 are marked as stationary (0–5 km/h) to simulate parked buses for testing door-open alerts.
5. Click **"Stop simulators"** when you're done. This is perfect for quick demos without juggling terminals.

### Option B – Launch via CLI

Install deps once:

```
cd simulator
pip install -r requirements.txt
```

Launch individual buses (each in its own terminal). The script defaults to `localhost:1883`, so it connects to the Dockerized broker automatically:

```
python bus_simulator.py --bus-id bus-1
python bus_simulator.py --bus-id bus-2
...
python bus_simulator.py --bus-id bus-13
```

Tips (applies to both the UI-managed simulators and CLI scripts):

- To point at a remote broker, override `--mqtt-host` / `--mqtt-port` / `--username` / `--password`.
- Each simulator walks a 3–4 point polyline anchored in Dubai (Downtown, Marina, Jumeirah, Deira Creek, Academic City).
- Speed hovers ~50 km/h with 15% random spikes above 70 km/h, generating alert traffic for the dashboard.
- Stationary buses (1, 5, 9, 13) stay at their starting point with speed 0–5 km/h, useful for testing door-open-while-moving alerts.

## Authentication

The system uses JWT-based authentication. Default users:
- `admin` (admin role)
- `operator1` (operator role)

All API endpoints require a valid JWT token in the `Authorization: Bearer <token>` header. The frontend automatically handles login and token management.

## REST API Reference

| Endpoint | Description | Auth Required |
|----------|-------------|---------------|
| `POST /auth/login` | Login and receive JWT token | No |
| `GET /auth/me` | Get current user info | Yes |
| `GET /api/buses` | Latest telemetry snapshot for every bus | Yes |
| `GET /api/buses/{busId}/history?from=ISO&to=ISO` | Time series (speed, occupancy, lat/lon, door, engine) | Yes |
| `GET /api/alerts?limit=50` | Alerts (overspeed and door-open while moving) sorted by timestamp desc | Yes |
| `GET /api/config` | Current overspeed threshold, polling cadence, ThingSpeak flag | Yes |
| `PUT /api/config` | Update configuration (persisted in `system_config`) | Yes |
| `GET /api/simulators/status` | Get simulator status (running buses, message counts) | Yes |
| `POST /api/simulators/start` | Start all 13 simulators (or specific bus IDs) | Yes |
| `POST /api/simulators/stop` | Stop all simulators | Yes |
| `POST /api/simulators/bus/{busId}/start` | Start a single bus simulator | Yes |
| `POST /api/simulators/bus/{busId}/stop` | Stop a single bus simulator | Yes |

All responses use the same field names as the MQTT payload (`busId`, `speed_kmh`, `door_open`, ...), making it easy to correlate telemetry and REST data.

## Frontend Highlights

- **Login Page** – JWT-based authentication with multiple user support (admin and operator roles).
- **Live Status** – Polls `/api/buses` (default every 5s) to render a responsive fleet table with overspeed badges and door indicators.
- **Map View** – Real-time map (Leaflet/OpenStreetMap) showing all buses with clickable markers. Updates every 2s for live tracking.
- **Bus Details** – Select any bus to see real-time cards, last 2h speed chart (react-chartjs-2), and recent samples. Auto-refreshes every 3s without manual refresh.
- **Alerts** – Streams overspeed and door-open-while-moving events (auto-refresh every 10s). Simulated SMS notifications are logged in the backend.
- **Documentation** – Built-in reference for the PostgreSQL schema, authentication, alerts, simulator control, and live update behavior.
- **Settings** – Adjust overspeed threshold, polling interval, and ThingSpeak toggle without redeployment. Control all 13 simulators or start/stop individual buses. Shows which buses are stationary.

## Screenshots

Run the stack + simulators, open `http://localhost:3000`, and capture screenshots of:

1. Live Status table while overspeed badges are visible.
2. Bus Details chart showing the Dubai route coordinates + overspeed points.
3. Alerts or Documentation pages highlighting data governance.

## Troubleshooting

- **Docker not running** – Ensure Docker Desktop is started before `docker compose up`.
- **MQTT auth errors** – The compose file regenerates `password.txt` at runtime. Stop the stack, delete `infrastructure/mosquitto/password.txt`, and rerun compose to refresh if needed.
- **No telemetry shown** – Verify at least one simulator is running and publishing to `school/bus/{busId}/telemetry`.
- **ThingSpeak disabled** – The Settings page can only enable forwarding when env secrets are provided; otherwise it remains in mock/no-op mode.

## Testing Checklist

- `npm run build` (frontend) – verifies Tailwind + CRA build is healthy.
- Manual: launch simulators for buses 1–13 and observe:
  - Login page accepts default credentials (admin/admin123).
  - Live table updates every few seconds and highlights >70 km/h speeds.
  - Map view shows real-time bus positions with clickable markers.
  - Bus Details chart auto-refreshes every 3s and paints overspeed markers (red) and shows Dubai coordinates.
  - Alerts table receives rows for overspeed and door-open-while-moving events, matching MQTT `school/bus/{busId}/alerts` publications.
  - Backend logs show simulated SMS notifications for alerts.
  - Settings page allows per-bus simulator control and shows stationary bus indicators.
  - Settings updates (threshold/polling) immediately change the UI & backend behavior.

## Project Structure

```
busmonitoring/
├── backend/               # FastAPI app, SQLAlchemy models, MQTT ingest
├── frontend/              # CRA + Tailwind dashboard
├── infrastructure/        # docker-compose + Mosquitto config
├── simulator/             # paho-mqtt simulator script
└── README.md              # this file
```

Happy monitoring!
