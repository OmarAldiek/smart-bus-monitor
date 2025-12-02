import { useCallback, useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";

import { fetchBuses } from "../api/client";
import MapView from "../components/MapView";
import StateBlock from "../components/StateBlock";

const MapPage = () => {
  const [buses, setBuses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedBusId, setSelectedBusId] = useState(null);

  const load = useCallback(async () => {
    try {
      const data = await fetchBuses();
      setBuses(data);
      if (!selectedBusId && data.length) {
        setSelectedBusId(data[0].busId);
      }
      setError(null);
    } catch (err) {
      console.error("Failed to load buses for map", err);
      setError("Unable to fetch fleet positions.");
    } finally {
      setLoading(false);
    }
  }, [selectedBusId]);

  useEffect(() => {
    load();
  }, [load]);

  // Faster polling for the map to feel more live: 2s interval
  useEffect(() => {
    const interval = setInterval(load, 2000);
    return () => clearInterval(interval);
  }, [load]);

  const selectedBus = useMemo(
    () => buses.find((b) => b.busId === selectedBusId) || null,
    [buses, selectedBusId]
  );

  if (loading) {
    return <StateBlock title="Loading map" message="Fetching bus locations…" />;
  }

  if (error) {
    return <StateBlock title="Map unavailable" message={error} />;
  }

  if (!buses.length) {
    return <StateBlock title="No buses" message="Start the simulators to see the fleet on the map." />;
  }

  return (
    <section className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-secondary">Fleet map</p>
          <h2 className="text-2xl font-semibold text-primary">Dubai overview</h2>
        </div>
        <span className="text-xs text-slate-500">{buses.length} buses</span>
      </header>

      <MapView buses={buses} selectedBusId={selectedBusId} onSelectBus={setSelectedBusId} />

      {selectedBus && (
        <div className="rounded-2xl border border-slate-100 bg-card shadow-card p-6">
          <p className="text-xs uppercase tracking-[0.4em] text-secondary mb-3">Selected bus</p>
          <div className="grid gap-4 text-sm text-slate-700 md:grid-cols-5">
            <div className="col-span-1">
              <p className="text-xs uppercase text-slate-400">Bus</p>
              <p className="text-lg font-semibold text-primary">{selectedBus.busId}</p>
              <p className="text-xs text-slate-400 mt-1">
                {selectedBus.name || "Unregistered bus"}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase text-slate-400">Speed</p>
              <p className="font-semibold">{selectedBus.speed_kmh.toFixed(1)} km/h</p>
            </div>
            <div>
              <p className="text-xs uppercase text-slate-400">Occupancy</p>
              <p className="font-semibold">{selectedBus.occupancy} riders</p>
            </div>
            <div>
              <p className="text-xs uppercase text-slate-400">Door / Engine</p>
              <p className="font-semibold">
                {selectedBus.door_open ? "Door open" : "Door closed"} ·{" "}
                {selectedBus.engine_on ? "Engine on" : "Engine off"}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase text-slate-400">Last update</p>
              <p className="font-semibold">
                {dayjs(selectedBus.timestamp).format("MMM D, HH:mm:ss")}
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-4 text-sm text-slate-700 md:grid-cols-5">
            <div className="col-span-2">
              <p className="text-xs uppercase text-slate-400">Coordinates</p>
              <p className="font-mono text-xs">
                {selectedBus.lat.toFixed(5)}, {selectedBus.lon.toFixed(5)}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase text-slate-400">Speed threshold</p>
              <p className="font-semibold">70 km/h (configurable)</p>
            </div>
            <div>
              <p className="text-xs uppercase text-slate-400">Engine status</p>
              <p className="font-semibold">
                {selectedBus.engine_on ? "Running" : "Off"}
              </p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default MapPage;
