import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FiRefreshCw, FiPlay, FiPause } from "react-icons/fi";
import dayjs from "dayjs";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line } from "react-chartjs-2";

import { fetchBusHistory, fetchBuses } from "../api/client";
import MetricCard from "../components/MetricCard";
import StateBlock from "../components/StateBlock";
import { useConfig } from "../context/ConfigContext";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler);

const BusDetailsPage = () => {
  const { busId: routeBusId } = useParams();
  const navigate = useNavigate();
  const { config } = useConfig();

  const [buses, setBuses] = useState([]);
  const [selectedBusId, setSelectedBusId] = useState(routeBusId || "");
  const [history, setHistory] = useState([]);
  const [selectedDate, setSelectedDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(null);
  const scrollContainerRef = useRef(null);
  const scrollPositionRef = useRef(0);

  const loadBuses = useCallback(async () => {
    try {
      const data = await fetchBuses();
      setBuses(data);
      if (!selectedBusId && data.length) {
        setSelectedBusId(data[0].busId);
        navigate(`/buses/${data[0].busId}`, { replace: true });
      }
    } catch (err) {
      console.error("Failed to load buses", err);
    }
  }, [navigate, selectedBusId]);

  const loadHistory = useCallback(
    async (busId, preserveScroll = false, dateOverride) => {
      if (!busId) return Promise.resolve();

      // Save scroll position before update
      if (preserveScroll && scrollContainerRef.current) {
        scrollPositionRef.current = scrollContainerRef.current.scrollTop;
      }

      setLoading(true);
      try {
        const day = dateOverride || selectedDate;
        const from = dayjs(day).startOf("day").toISOString();
        const to = dayjs(day).endOf("day").toISOString();
        const params = { from, to };
        const data = await fetchBusHistory(busId, params);
        setHistory(data);
        setError(null);

        // Restore scroll position after state update
        if (preserveScroll) {
          setTimeout(() => {
            if (scrollContainerRef.current) {
              scrollContainerRef.current.scrollTop = scrollPositionRef.current;
            }
          }, 0);
        }
        
        return Promise.resolve();
      } catch (err) {
        console.error("Failed to load history", err);
        setError("Unable to load history for this bus.");
        return Promise.resolve();
      } finally {
        setLoading(false);
      }
    },
    [selectedDate]
  );

  useEffect(() => {
    loadBuses();
  }, []); // Only load once on mount

  useEffect(() => {
    if (routeBusId && routeBusId !== selectedBusId) {
      setSelectedBusId(routeBusId);
    }
  }, [routeBusId, selectedBusId]);

  useEffect(() => {
    if (selectedBusId) {
      loadHistory(selectedBusId).then(() => setLastRefresh(new Date()));
    }
  }, [selectedBusId, loadHistory]);

  // Auto-refresh only if enabled - preserve scroll position
  useEffect(() => {
    if (!autoRefresh || !selectedBusId) return;
    const interval = setInterval(() => {
      loadHistory(selectedBusId, true).then(() => setLastRefresh(new Date()));
    }, 5000); // Slower refresh when auto-refresh is on
    return () => clearInterval(interval);
  }, [autoRefresh, selectedBusId, loadHistory]);

  const handleManualRefresh = () => {
    if (selectedBusId) {
      loadHistory(selectedBusId).then(() => setLastRefresh(new Date()));
    }
    loadBuses();
  };

  const latestPoint = history[history.length - 1];
  const threshold = config?.overspeed_threshold || 70;

  const chartData = useMemo(() => {
    // Aggregate samples by minute to keep the chart readable even after long runs.
    // Each point represents the average speed for that minute, with overspeed
    // markers showing the maximum speed above the threshold in that minute.
    const buckets = new Map();

    history.forEach((point) => {
      const minuteKey = dayjs(point.timestamp).format("HH:mm");
      if (!buckets.has(minuteKey)) {
        buckets.set(minuteKey, []);
      }
      buckets.get(minuteKey).push(point);
    });

    const labels = [];
    const avgSpeeds = [];
    const overspeedPoints = [];

    Array.from(buckets.entries()).forEach(([minute, points]) => {
      labels.push(minute);
      const avg =
        points.reduce((sum, p) => sum + p.speed_kmh, 0) / points.length;
      avgSpeeds.push(avg);

      const maxAboveThreshold = Math.max(
        ...points
          .filter((p) => p.speed_kmh > threshold)
          .map((p) => p.speed_kmh),
        -Infinity
      );
      overspeedPoints.push(
        maxAboveThreshold === -Infinity ? null : maxAboveThreshold
      );
    });

    return {
      labels,
      datasets: [
        {
          label: "Speed (km/h)",
          data: avgSpeeds,
          borderColor: "#0A3D62",
          backgroundColor: "rgba(10, 61, 98, 0.08)",
          tension: 0.4,
          fill: true,
        },
        {
          label: "Overspeed",
          data: overspeedPoints,
          borderColor: "#e55039",
          pointBackgroundColor: "#e55039",
          pointRadius: 4,
          showLine: false,
        },
      ],
    };
  }, [history, threshold]);

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: { display: true },
    },
    scales: {
      y: {
        beginAtZero: true,
        title: { display: true, text: "km/h" },
      },
    },
  };

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-secondary">Bus details</p>
          <h2 className="text-2xl font-semibold text-primary">Route insights</h2>
        </div>
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
          <label className="text-sm text-slate-600">Bus</label>
          <select
            value={selectedBusId}
            onChange={(event) => navigate(`/buses/${event.target.value}`)}
            className="rounded-xl border border-slate-200 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-secondary"
          >
            {buses.map((bus) => (
              <option key={bus.busId} value={bus.busId}>
                {bus.busId}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={selectedDate}
            onChange={(event) => {
              const value = event.target.value;
              setSelectedDate(value);
              if (selectedBusId) {
                loadHistory(selectedBusId, false, value).then(() => setLastRefresh(new Date()));
              }
            }}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-secondary"
          />
          <button
            onClick={handleManualRefresh}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-neutral transition text-sm font-medium"
            title="Refresh data"
          >
            <FiRefreshCw className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl transition text-sm font-medium ${
              autoRefresh
                ? "bg-green-100 text-green-700 hover:bg-green-200"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
            title={autoRefresh ? "Pause auto-refresh" : "Enable auto-refresh"}
          >
            {autoRefresh ? <FiPause /> : <FiPlay />}
            {autoRefresh ? "Auto" : "Manual"}
          </button>
          {lastRefresh && (
            <span className="text-xs text-slate-500">
              Updated {dayjs(lastRefresh).format("HH:mm:ss")}
            </span>
          )}
        </div>
      </header>

      {!selectedBusId || loading ? (
        <StateBlock title="Loading bus data" message="Fetching telemetry history..." />
      ) : error ? (
        <StateBlock title="History unavailable" message={error} />
      ) : !history.length ? (
        <StateBlock title="No samples yet" message="Waiting for this bus to publish telemetry." />
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              label="Current speed"
              value={`${latestPoint.speed_kmh.toFixed(1)} km/h`}
              subtext={dayjs(latestPoint.timestamp).format("HH:mm:ss")}
              variant={latestPoint.speed_kmh > threshold ? "warning" : "accent"}
            />
            <MetricCard label="Occupancy" value={`${latestPoint.occupancy} riders`} subtext="0-30 expected" />
            <MetricCard
              label="Engine status"
              value={latestPoint.engine_on ? "Engine On" : "Engine Off"}
              subtext={latestPoint.door_open ? "Doors open" : "Doors closed"}
            />
            <MetricCard
              label="Coordinates"
              value={`${latestPoint.lat.toFixed(4)}, ${latestPoint.lon.toFixed(4)}`}
              subtext="Dubai polygon"
            />
          </div>

          <div className="rounded-2xl border border-slate-100 bg-card shadow-card p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-primary">Speed profile (last 2h)</h3>
              <span className="text-sm text-slate-500">Overspeed threshold {threshold} km/h</span>
            </div>
            <Line data={chartData} options={chartOptions} height={120} />
          </div>

          <div className="rounded-2xl border border-slate-100 bg-card shadow-card p-5">
            <h3 className="text-lg font-semibold text-primary mb-4">Latest samples</h3>
            <div className="overflow-auto" ref={scrollContainerRef}>
              <table className="w-full text-sm">
                <thead className="text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="py-2 text-left">Timestamp</th>
                    <th className="py-2 text-left">Speed</th>
                    <th className="py-2 text-left">Occupancy</th>
                    <th className="py-2 text-left">Door</th>
                    <th className="py-2 text-left">Lat / Lon</th>
                  </tr>
                </thead>
                <tbody>
                  {[...history].slice(-10).reverse().map((point) => (
                    <tr key={point.timestamp} className="border-t border-slate-100">
                      <td className="py-2">{dayjs(point.timestamp).format("MMM D, HH:mm:ss")}</td>
                      <td className="py-2">{point.speed_kmh.toFixed(1)} km/h</td>
                      <td className="py-2">{point.occupancy}</td>
                      <td className="py-2">{point.door_open ? "Open" : "Closed"}</td>
                      <td className="py-2">
                        {point.lat.toFixed(4)}, {point.lon.toFixed(4)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default BusDetailsPage;
