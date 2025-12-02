import { useCallback, useEffect, useState } from "react";
import dayjs from "dayjs";
import { FiDownload, FiMessageSquare, FiX } from "react-icons/fi";

import { fetchAlerts, sendDriverMessage } from "../api/client";
import StatusBadge from "../components/StatusBadge";
import StateBlock from "../components/StateBlock";

const AlertsPage = () => {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [customNote, setCustomNote] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(null);
  const [sendSuccess, setSendSuccess] = useState(false);

  const loadAlerts = useCallback(async () => {
    try {
      const data = await fetchAlerts(100);
      setAlerts(data);
      setError(null);
    } catch (err) {
      console.error("Failed to load alerts", err);
      setError("Unable to fetch alerts.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAlerts();
    const interval = setInterval(loadAlerts, 10_000);
    return () => clearInterval(interval);
  }, [loadAlerts]);

  if (loading) {
    return <StateBlock title="Loading alerts" message="Checking for violations..." />;
  }

  if (error) {
    return <StateBlock title="Alerts unavailable" message={error} />;
  }

  if (!alerts.length) {
    return <StateBlock title="All clear" message="No violations have been recorded yet." />;
  }

  const downloadCSV = () => {
    const headers = ["Timestamp", "Bus ID", "Type", "Value (km/h)", "Threshold (km/h)", "Message"];
    const rows = alerts.map((alert) => [
      dayjs(alert.timestamp).format("YYYY-MM-DD HH:mm:ss"),
      alert.busId,
      alert.type,
      alert.value.toFixed(1),
      alert.threshold.toFixed(1),
      alert.message,
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `violation-log-${dayjs().format("YYYY-MM-DD-HHmmss")}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-secondary">Alerts</p>
          <h2 className="text-2xl font-semibold text-primary">Violation log</h2>
        </div>
        <button
          onClick={downloadCSV}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white font-semibold hover:bg-secondary transition shadow-sm"
        >
          <FiDownload />
          Download CSV
        </button>
      </header>

      <div className="rounded-2xl border border-slate-100 bg-card shadow-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-neutral text-slate-600 uppercase text-xs">
            <tr>
              <th className="px-6 py-3 text-left">Timestamp</th>
              <th className="px-6 py-3 text-left">Bus</th>
              <th className="px-6 py-3 text-left">Type</th>
              <th className="px-6 py-3 text-left">Value</th>
              <th className="px-6 py-3 text-left">Threshold</th>
              <th className="px-6 py-3 text-left">Message</th>
              <th className="px-6 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {alerts.map((alert) => (
              <tr key={alert.id} className="border-t border-slate-100">
                <td className="px-6 py-3">{dayjs(alert.timestamp).format("MMM D, HH:mm:ss")}</td>
                <td className="px-6 py-3 font-semibold text-primary">{alert.busId}</td>
                <td className="px-6 py-3">
                  <StatusBadge tone="warning">{alert.type}</StatusBadge>
                </td>
                <td className="px-6 py-3">{alert.value.toFixed(1)} km/h</td>
                <td className="px-6 py-3">{alert.threshold.toFixed(1)} km/h</td>
                <td className="px-6 py-3 text-slate-600">{alert.message}</td>
                <td className="px-6 py-3">
                  <button
                    onClick={() => setSelectedAlert(alert)}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-secondary transition"
                  >
                    <FiMessageSquare />
                    Send SMS
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Send SMS Modal */}
      {selectedAlert && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setSelectedAlert(null)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-primary">Send SMS to Driver</h3>
              <button
                onClick={() => {
                  setSelectedAlert(null);
                  setCustomNote("");
                  setSendError(null);
                  setSendSuccess(false);
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <FiX size={20} />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="text-sm text-slate-600">
                <p><strong>Bus:</strong> {selectedAlert.busId}</p>
                <p><strong>Alert Type:</strong> {selectedAlert.type}</p>
                <p><strong>Speed:</strong> {selectedAlert.value.toFixed(1)} km/h</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Message Preview</label>
                <div className="bg-slate-50 rounded-lg p-3 text-sm text-slate-700 border border-slate-200">
                  {selectedAlert.type === "overspeed" && (
                    <p>
                      ALERT: Overspeed detected. Current speed: {selectedAlert.value.toFixed(1)} km/h (limit: {selectedAlert.threshold.toFixed(1)} km/h). Please reduce speed immediately for safety.
                      {customNote && <><br /><br />Note: {customNote}</>}
                    </p>
                  )}
                  {selectedAlert.type === "door_open_while_moving" && (
                    <p>
                      ALERT: Door is open while bus is moving (speed: {selectedAlert.value.toFixed(1)} km/h). Please close the door immediately for passenger safety.
                      {customNote && <><br /><br />Note: {customNote}</>}
                    </p>
                  )}
                  {selectedAlert.type !== "overspeed" && selectedAlert.type !== "door_open_while_moving" && (
                    <p>
                      ALERT: Please check your bus status immediately.
                      {customNote && <><br /><br />Note: {customNote}</>}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Custom Note (Optional)</label>
                <textarea
                  value={customNote}
                  onChange={(e) => setCustomNote(e.target.value)}
                  placeholder="Add any additional notes..."
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-secondary"
                  rows={3}
                />
              </div>

              {sendError && (
                <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg">
                  {sendError}
                </div>
              )}

              {sendSuccess && (
                <div className="bg-green-50 text-green-700 text-sm p-3 rounded-lg">
                  Message sent successfully! The SMS is being processed.
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    setSending(true);
                    setSendError(null);
                    setSendSuccess(false);
                    try {
                      await sendDriverMessage(
                        selectedAlert.busId,
                        selectedAlert.id,
                        selectedAlert.type === "door_open_while_moving" ? "door_open" : selectedAlert.type,
                        customNote || null,
                        selectedAlert.value,
                        selectedAlert.threshold
                      );
                      setSendSuccess(true);
                      setTimeout(() => {
                        setSelectedAlert(null);
                        setCustomNote("");
                        setSendError(null);
                        setSendSuccess(false);
                      }, 2000);
                    } catch (err) {
                      setSendError(err.response?.data?.detail || "Failed to send message");
                    } finally {
                      setSending(false);
                    }
                  }}
                  disabled={sending}
                  className="flex-1 px-4 py-2 rounded-lg bg-primary text-white font-semibold hover:bg-secondary transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sending ? "Sending..." : "Send SMS"}
                </button>
                <button
                  onClick={() => {
                    setSelectedAlert(null);
                    setCustomNote("");
                    setSendError(null);
                    setSendSuccess(false);
                  }}
                  className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default AlertsPage;
