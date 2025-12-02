import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

import { fetchBuses } from "../api/client";
import StatusBadge from "../components/StatusBadge";
import StateBlock from "../components/StateBlock";
import { useConfig } from "../context/ConfigContext";

dayjs.extend(relativeTime);

const LiveStatusPage = () => {
  const { config } = useConfig();
  const [buses, setBuses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const loadBuses = useCallback(async () => {
    try {
      const data = await fetchBuses();
      setBuses(data);
      setError(null);
    } catch (err) {
      console.error("Failed to load buses", err);
      setError("Unable to fetch live status.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBuses();
  }, [loadBuses]);

  useEffect(() => {
    if (!config) return;
    const intervalMs = Math.max(config.poll_interval_seconds || 5, 3) * 1000;
    const interval = setInterval(loadBuses, intervalMs);
    return () => clearInterval(interval);
  }, [config, loadBuses]);

  const sortedBuses = useMemo(
    () =>
      [...buses].sort((a, b) => a.busId.localeCompare(b.busId, undefined, { numeric: true })),
    [buses]
  );

  if (loading) {
    return <StateBlock title="Loading telemetry" message="Fetching the latest bus positions..." />;
  }

  if (error) {
    return <StateBlock title="Live data unavailable" message={error} action={<button onClick={loadBuses} className="px-4 py-2 rounded-full bg-primary text-white">Retry</button>} />;
  }

  if (!sortedBuses.length) {
    return <StateBlock title="No telemetry yet" message="Start the bus simulator to see live data streaming in." />;
  }

  const overspeedThreshold = config?.overspeed_threshold || 70;

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-secondary">Live</p>
          <h2 className="text-2xl font-semibold text-primary">Fleet status</h2>
        </div>
        <div className="text-sm text-slate-500">
          Last refresh: {dayjs().format("HH:mm:ss")} | threshold: {overspeedThreshold} km/h
        </div>
      </header>

      <div className="overflow-hidden rounded-2xl shadow-card border border-slate-100 bg-card">
        <table className="w-full text-left text-sm">
          <thead className="bg-neutral text-slate-600 uppercase text-xs tracking-wide">
            <tr>
              <th className="px-6 py-3">Bus</th>
              <th className="px-6 py-3">Speed (km/h)</th>
              <th className="px-6 py-3">Occupancy</th>
              <th className="px-6 py-3">Door</th>
              <th className="px-6 py-3">Last update</th>
            </tr>
          </thead>
          <tbody>
            {sortedBuses.map((bus) => {
              const overspeed = bus.speed_kmh > overspeedThreshold;
              return (
                <tr
                  key={bus.busId}
                  className="border-t border-slate-100 hover:bg-neutral cursor-pointer"
                  onClick={() => navigate(`/buses/${bus.busId}`)}
                >
                  <td className="px-6 py-4 font-semibold text-primary">
                    <div className="flex flex-col">
                      <span>{bus.busId}</span>
                      <span className="text-xs text-slate-500">{bus.name || "Unregistered"}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge tone={overspeed ? "warning" : "success"}>{bus.speed_kmh.toFixed(1)}</StatusBadge>
                  </td>
                  <td className="px-6 py-4">{bus.occupancy} / {bus.capacity || 30}</td>
                  <td className="px-6 py-4">
                    <StatusBadge tone={bus.door_open ? "warning" : "success"}>
                      {bus.door_open ? "Open" : "Closed"}
                    </StatusBadge>
                  </td>
                  <td className="px-6 py-4 text-slate-500">
                    {dayjs(bus.timestamp).fromNow()} · {dayjs(bus.timestamp).format("HH:mm:ss")}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default LiveStatusPage;
