import Tabs from "../components/Tabs";

const tables = [
  {
    name: "buses",
    description: "Static registry for each school bus (bus-1 … bus-13).",
    columns: [
      { field: "id", type: "serial", note: "Primary key" },
      { field: "bus_id", type: "text", note: "External identifier, unique" },
      { field: "name", type: "text", note: "Optional friendly name" },
      { field: "capacity", type: "integer", note: "Seated capacity" },
    ],
  },
  {
    name: "telemetry",
    description: "High-frequency telemetry streamed from simulators via MQTT.",
    columns: [
      { field: "id", type: "serial", note: "Primary key" },
      { field: "bus_id", type: "text", note: "FK to buses.bus_id" },
      { field: "timestamp", type: "timestamptz", note: "Event time (UTC)" },
      { field: "lat / lon", type: "float", note: "Geo-location (Dubai polygon)" },
      { field: "speed_kmh", type: "float", note: "Current speed" },
      { field: "occupancy", type: "integer", note: "0–30 riders" },
      { field: "door_open", type: "boolean", note: "Door sensor" },
      { field: "engine_on", type: "boolean", note: "Engine status" },
    ],
  },
  {
    name: "alerts",
    description: "Alerts created by the backend for overspeed and door-open while moving.",
    columns: [
      { field: "id", type: "serial", note: "Primary key" },
      { field: "bus_id", type: "text", note: "FK to buses.bus_id" },
      { field: "timestamp", type: "timestamptz", note: "Alert time" },
      { field: "type", type: "text", note: "overspeed or door_open_while_moving" },
      { field: "value", type: "float", note: "Measured value (speed or speed when door open)" },
      { field: "threshold", type: "float", note: "Configured limit" },
      { field: "message", type: "text", note: "Human-readable summary" },
    ],
  },
  {
    name: "users",
    description: "User accounts for authentication (admin and operator roles).",
    columns: [
      { field: "id", type: "serial", note: "Primary key" },
      { field: "username", type: "text", note: "Unique login name" },
      { field: "password_hash", type: "text", note: "Bcrypt hashed password" },
      { field: "role", type: "text", note: "admin or operator" },
    ],
  },
];

const simulationFacts = [
  "13 simulators (bus-1 … bus-13) can be started individually or all at once from the Settings page.",
  "Buses 1, 5, 9, and 13 are marked as stationary (speed 0–5 km/h) to simulate parked buses for alert testing.",
  "Each simulator follows a short route in Dubai (Downtown, Marina, Jumeirah, Deira Creek, Academic City).",
  "Speed is centred around 50 km/h with occasional spikes above 70 km/h to exercise alerting and charts.",
  "Occupancy is random between 0–30 riders, and the door flag toggles every 20–60 seconds to mimic stops.",
  "All telemetry is pushed via MQTT to Mosquitto, then persisted by the FastAPI backend into PostgreSQL.",
];

const systemFlow = [
  {
    title: "1. Simulators → Mosquitto",
    text: "Python scripts create 13 virtual buses. Each connects to the Mosquitto broker (auth required) and publishes JSON payloads to school/bus/{busId}/telemetry.",
  },
  {
    title: "2. Mosquitto → FastAPI",
    text: "The backend MQTT subscriber listens to school/bus/+/telemetry, validates the JSON, upserts the bus, and writes telemetry rows.",
  },
  {
    title: "3. Alert engine",
    text: "On every telemetry message, the backend checks: (1) speed_kmh > overspeed threshold (overspeed alert), (2) door_open AND speed_kmh > 5 km/h (door-open while moving). Alerts are stored, published to MQTT, and simulated SMS notifications are logged.",
  },
  {
    title: "4. ThingSpeak (optional)",
    text: "If enabled, the backend also publishes speed to the ThingSpeak MQTT endpoint using the configured channel and API key.",
  },
  {
    title: "5. REST API → React UI",
    text: "The React dashboard polls REST endpoints: /api/buses for latest positions (every 2s on map, 5s elsewhere), /api/buses/{id}/history for charts (every 3s on bus details page), /api/alerts for the log, and /api/config for thresholds and flags. All endpoints require JWT authentication.",
  },
  {
    title: "6. Configuration & simulator control",
    text: "The Settings page writes configuration into the system_config table via /api/config and can start/stop all 13 backend-managed simulators or control individual buses. Per-bus control allows testing specific scenarios (e.g., stationary buses for door-open alerts).",
  },
  {
    title: "7. Authentication",
    text: "The system uses JWT-based authentication. Default users: admin/admin123 (admin role) and operator1/operator123 (operator role). All API endpoints and UI routes are protected. Login tokens are stored in localStorage and automatically attached to API requests.",
  },
];

const payloadExample = `{
  "busId": "bus-7",
  "timestamp": "2025-12-01T10:35:12Z",
  "lat": 25.205812,
  "lon": 55.252643,
  "speed_kmh": 74.1,
  "occupancy": 18,
  "door_open": false,
  "engine_on": true
}`;

const DocumentationPage = () => {
  const tabs = [
    { id: "schema", label: "Database Schema" },
    { id: "flow", label: "System Flow" },
    { id: "simulation", label: "Simulation" },
  ];

  return (
    <section className="space-y-4">
      <header>
        <p className="text-xs uppercase tracking-[0.4em] text-secondary">Documentation</p>
        <h2 className="text-xl font-semibold text-primary">How this system works</h2>
      </header>

      <Tabs tabs={tabs} defaultTab="schema">
        {(activeTab) => (
          <>
            {activeTab === "schema" && (
              <div className="grid gap-4 lg:grid-cols-2">
        {tables.map((table) => (
                  <article key={table.name} className="rounded-xl border border-slate-100 bg-card shadow-card p-4 flex flex-col">
                    <h3 className="text-base font-semibold text-primary mb-2">{table.name}</h3>
                    <p className="text-xs text-slate-600 mb-3">{table.description}</p>
                    <ul className="space-y-1.5 text-xs text-slate-700 flex-1">
              {table.columns.map((column) => (
                        <li key={column.field} className="flex justify-between py-1 border-b border-slate-100 last:border-0">
                  <span className="font-medium">{column.field}</span>
                  <span className="text-right text-slate-500 text-xs">
                    {column.type}
                    <br />
                    {column.note}
                  </span>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
            )}

            {activeTab === "flow" && (
              <div className="rounded-xl border border-slate-100 bg-card shadow-card p-4">
                <h3 className="text-base font-semibold text-primary mb-3">End-to-end data flow</h3>
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {systemFlow.map((step) => (
                    <article key={step.title} className="text-xs text-slate-700 p-3 rounded-lg bg-neutral/30">
                      <h4 className="font-semibold text-primary mb-1.5">{step.title}</h4>
                      <p className="text-slate-600 leading-relaxed">{step.text}</p>
                    </article>
                  ))}
                </div>
              </div>
            )}

            {activeTab === "simulation" && (
              <div className="space-y-4">
                <div className="rounded-xl border border-slate-100 bg-card shadow-card p-4">
                  <h3 className="text-base font-semibold text-primary mb-3">Simulation playbook</h3>
                  <ul className="list-disc pl-5 space-y-1.5 text-xs text-slate-700">
          {simulationFacts.map((fact) => (
            <li key={fact}>{fact}</li>
          ))}
        </ul>
      </div>

                <div className="rounded-xl border border-slate-200 bg-slate-900 text-slate-100 p-4 font-mono text-xs overflow-auto">
                  <h3 className="text-sm font-semibold text-accent mb-2">Telemetry payload sample</h3>
                  <pre className="text-xs">{payloadExample}</pre>
                </div>
      </div>
            )}
          </>
        )}
      </Tabs>
    </section>
  );
};

export default DocumentationPage;
