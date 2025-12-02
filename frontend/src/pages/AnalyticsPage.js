import { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Bar, Line, Doughnut } from "react-chartjs-2";

import { fetchBuses, fetchAlerts } from "../api/client";
import MetricCard from "../components/MetricCard";
import { useConfig } from "../context/ConfigContext";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler
);

const AnalyticsPage = () => {
  const { config } = useConfig();
  const [buses, setBuses] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [busesData, alertsData] = await Promise.all([
          fetchBuses(),
          fetchAlerts(200),
        ]);
        setBuses(busesData);
        setAlerts(alertsData);
      } catch (err) {
        console.error("Failed to load analytics data", err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
    const interval = setInterval(loadData, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const stats = useMemo(() => {
    if (!buses.length) return null;

    const totalBuses = buses.length;
    const activeBuses = buses.filter((b) => b.engine_on).length;
    const avgSpeed = buses.reduce((sum, b) => sum + b.speed_kmh, 0) / totalBuses;
    const totalOccupancy = buses.reduce((sum, b) => sum + b.occupancy, 0);
    const overspeedCount = buses.filter((b) => b.speed_kmh > (config?.overspeed_threshold || 70)).length;
    const doorOpenCount = buses.filter((b) => b.door_open).length;

    // Speed distribution
    const speedRanges = {
      "0-30": buses.filter((b) => b.speed_kmh >= 0 && b.speed_kmh < 30).length,
      "30-50": buses.filter((b) => b.speed_kmh >= 30 && b.speed_kmh < 50).length,
      "50-70": buses.filter((b) => b.speed_kmh >= 50 && b.speed_kmh < 70).length,
      "70+": buses.filter((b) => b.speed_kmh >= 70).length,
    };

    // Alert trends (last 24 hours)
    const now = dayjs();
    const alertTrends = Array.from({ length: 24 }, (_, i) => {
      const hour = now.subtract(23 - i, "hour");
      return alerts.filter(
        (a) => dayjs(a.timestamp).isSame(hour, "hour")
      ).length;
    });

    // Alert types distribution
    const alertTypes = alerts.reduce((acc, alert) => {
      acc[alert.type] = (acc[alert.type] || 0) + 1;
      return acc;
    }, {});

    // Bus activity (by bus ID)
    const busActivity = buses
      .map((bus) => ({
        busId: bus.busId,
        speed: bus.speed_kmh,
        occupancy: bus.occupancy,
      }))
      .sort((a, b) => b.speed - a.speed);

    return {
      totalBuses,
      activeBuses,
      avgSpeed,
      totalOccupancy,
      overspeedCount,
      doorOpenCount,
      speedRanges,
      alertTrends,
      alertTypes,
      busActivity,
    };
  }, [buses, alerts, config]);

  if (loading) {
    return (
      <section className="space-y-6">
        <header>
          <p className="text-xs uppercase tracking-[0.4em] text-secondary">Analytics</p>
          <h2 className="text-2xl font-semibold text-primary">Fleet Analytics</h2>
        </header>
        <div className="text-center py-12 text-slate-500">Loading analytics...</div>
      </section>
    );
  }

  if (!stats) {
    return (
      <section className="space-y-6">
        <header>
          <p className="text-xs uppercase tracking-[0.4em] text-secondary">Analytics</p>
          <h2 className="text-2xl font-semibold text-primary">Fleet Analytics</h2>
        </header>
        <div className="text-center py-12 text-slate-500">No data available</div>
      </section>
    );
  }

  const speedDistributionData = {
    labels: Object.keys(stats.speedRanges),
    datasets: [
      {
        label: "Number of Buses",
        data: Object.values(stats.speedRanges),
        backgroundColor: [
          "rgba(56, 173, 169, 0.8)",
          "rgba(10, 61, 98, 0.8)",
          "rgba(255, 193, 7, 0.8)",
          "rgba(229, 80, 57, 0.8)",
        ],
        borderColor: [
          "rgba(56, 173, 169, 1)",
          "rgba(10, 61, 98, 1)",
          "rgba(255, 193, 7, 1)",
          "rgba(229, 80, 57, 1)",
        ],
        borderWidth: 1,
      },
    ],
  };

  const alertTrendData = {
    labels: Array.from({ length: 24 }, (_, i) => {
      const hour = dayjs().subtract(23 - i, "hour");
      return hour.format("HH:00");
    }),
    datasets: [
      {
        label: "Alerts per Hour",
        data: stats.alertTrends,
        borderColor: "rgba(229, 80, 57, 1)",
        backgroundColor: "rgba(229, 80, 57, 0.1)",
        tension: 0.4,
        fill: true,
      },
    ],
  };

  const alertTypesData = {
    labels: Object.keys(stats.alertTypes),
    datasets: [
      {
        data: Object.values(stats.alertTypes),
        backgroundColor: [
          "rgba(229, 80, 57, 0.8)",
          "rgba(255, 152, 0, 0.8)",
          "rgba(56, 173, 169, 0.8)",
        ],
        borderColor: [
          "rgba(229, 80, 57, 1)",
          "rgba(255, 152, 0, 1)",
          "rgba(56, 173, 169, 1)",
        ],
        borderWidth: 2,
      },
    ],
  };

  const busSpeedData = {
    labels: stats.busActivity.slice(0, 10).map((b) => b.busId),
    datasets: [
      {
        label: "Speed (km/h)",
        data: stats.busActivity.slice(0, 10).map((b) => b.speed),
        backgroundColor: "rgba(10, 61, 98, 0.8)",
        borderColor: "rgba(10, 61, 98, 1)",
        borderWidth: 1,
      },
    ],
  };

  return (
    <section className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-[0.4em] text-secondary">Analytics</p>
        <h2 className="text-2xl font-semibold text-primary">Fleet Analytics</h2>
      </header>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Total Buses"
          value={stats.totalBuses}
          subtext={`${stats.activeBuses} active`}
          variant="accent"
        />
        <MetricCard
          label="Average Speed"
          value={`${stats.avgSpeed.toFixed(1)} km/h`}
          subtext={`${stats.overspeedCount} overspeed`}
          variant={stats.overspeedCount > 0 ? "warning" : "accent"}
        />
        <MetricCard
          label="Total Occupancy"
          value={stats.totalOccupancy}
          subtext="Riders across fleet"
          variant="accent"
        />
        <MetricCard
          label="Active Alerts"
          value={alerts.length}
          subtext={`${stats.doorOpenCount} doors open`}
          variant={alerts.length > 0 ? "warning" : "accent"}
        />
      </div>

      {/* Charts Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Speed Distribution */}
        <div className="rounded-2xl border border-slate-100 bg-card shadow-card p-6">
          <h3 className="text-lg font-semibold text-primary mb-4">Speed Distribution</h3>
          <Bar
            data={speedDistributionData}
            options={{
              responsive: true,
              plugins: {
                legend: { display: false },
              },
              scales: {
                y: {
                  beginAtZero: true,
                  ticks: { stepSize: 1 },
                },
              },
            }}
            height={200}
          />
        </div>

        {/* Alert Types */}
        <div className="rounded-2xl border border-slate-100 bg-card shadow-card p-6">
          <h3 className="text-lg font-semibold text-primary mb-4">Alert Types Distribution</h3>
          {Object.keys(stats.alertTypes).length > 0 ? (
            <Doughnut
              data={alertTypesData}
              options={{
                responsive: true,
                plugins: {
                  legend: { position: "bottom" },
                },
              }}
              height={200}
            />
          ) : (
            <div className="flex items-center justify-center h-[200px] text-slate-400">
              No alerts recorded
            </div>
          )}
        </div>

        {/* Alert Trends */}
        <div className="rounded-2xl border border-slate-100 bg-card shadow-card p-6">
          <h3 className="text-lg font-semibold text-primary mb-4">Alert Trends (Last 24 Hours)</h3>
          <Line
            data={alertTrendData}
            options={{
              responsive: true,
              plugins: {
                legend: { display: false },
              },
              scales: {
                y: {
                  beginAtZero: true,
                  ticks: { stepSize: 1 },
                },
              },
            }}
            height={200}
          />
        </div>

        {/* Top 10 Bus Speeds */}
        <div className="rounded-2xl border border-slate-100 bg-card shadow-card p-6">
          <h3 className="text-lg font-semibold text-primary mb-4">Top 10 Bus Speeds</h3>
          <Bar
            data={busSpeedData}
            options={{
              responsive: true,
              indexAxis: "y",
              plugins: {
                legend: { display: false },
              },
              scales: {
                x: {
                  beginAtZero: true,
                  title: { display: true, text: "Speed (km/h)" },
                },
              },
            }}
            height={200}
          />
        </div>
      </div>

      {/* Bus Activity Table */}
      <div className="rounded-2xl border border-slate-100 bg-card shadow-card overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-neutral/30">
          <h3 className="text-lg font-semibold text-primary">Fleet Activity Overview</h3>
          <p className="text-xs text-slate-500 mt-1">Current status of all buses</p>
        </div>
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-neutral text-slate-600 uppercase text-xs tracking-wide">
              <tr>
                <th className="px-6 py-3 text-left">Bus ID</th>
                <th className="px-6 py-3 text-left">Speed</th>
                <th className="px-6 py-3 text-left">Occupancy</th>
                <th className="px-6 py-3 text-left">Status</th>
                <th className="px-6 py-3 text-left">Door</th>
              </tr>
            </thead>
            <tbody>
              {buses
                .sort((a, b) => b.speed_kmh - a.speed_kmh)
                .map((bus) => (
                  <tr key={bus.busId} className="border-t border-slate-100 hover:bg-neutral/30">
                    <td className="px-6 py-3 font-semibold text-primary">{bus.busId}</td>
                    <td className="px-6 py-3">
                      <span
                        className={
                          bus.speed_kmh > (config?.overspeed_threshold || 70)
                            ? "text-red-600 font-medium"
                            : "text-slate-700"
                        }
                      >
                        {bus.speed_kmh.toFixed(1)} km/h
                      </span>
                    </td>
                    <td className="px-6 py-3">{bus.occupancy} riders</td>
                    <td className="px-6 py-3">
                      <span
                        className={`px-2 py-1 rounded text-xs ${
                          bus.engine_on
                            ? "bg-green-100 text-green-700"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {bus.engine_on ? "Running" : "Stopped"}
                      </span>
                    </td>
                    <td className="px-6 py-3">
                      <span
                        className={`px-2 py-1 rounded text-xs ${
                          bus.door_open
                            ? "bg-orange-100 text-orange-700"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {bus.door_open ? "Open" : "Closed"}
                      </span>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};

export default AnalyticsPage;

