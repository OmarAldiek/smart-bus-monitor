import { useCallback, useEffect, useState } from "react";
import dayjs from "dayjs";

import { fetchMessages } from "../api/client";
import MessageStatusBadge from "../components/MessageStatusBadge";
import StateBlock from "../components/StateBlock";

const MessagesPage = () => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterBusId, setFilterBusId] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [offset, setOffset] = useState(0);
  const limit = 50;

  const loadMessages = useCallback(async () => {
    try {
      const data = await fetchMessages(filterBusId || null, limit, offset);
      setMessages(Array.isArray(data) ? data : []);
      setError(null);
    } catch (err) {
      console.error("Failed to load messages", err);
      setError(err.response?.data?.detail || "Unable to fetch messages.");
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, [filterBusId, offset]);

  useEffect(() => {
    setLoading(true);
    loadMessages();
  }, [loadMessages]);

  // Real-time updates every 5 seconds to update statuses
  useEffect(() => {
    const interval = setInterval(loadMessages, 5000);
    return () => clearInterval(interval);
  }, [loadMessages]);

  // Filter messages client-side by status
  const filteredMessages = messages.filter((msg) => {
    if (!msg) return false;
    if (filterStatus && msg.status !== filterStatus) {
      return false;
    }
    return true;
  });

  if (loading && messages.length === 0 && !error) {
    return <StateBlock title="Loading messages" message="Fetching message history..." />;
  }

  if (error && messages.length === 0) {
    return <StateBlock title="Messages unavailable" message={error} />;
  }

  return (
    <section className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-[0.4em] text-secondary">Messages</p>
        <h2 className="text-2xl font-semibold text-primary">Driver SMS History</h2>
      </header>

      {/* Filters */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="flex-1">
          <label className="block text-xs font-medium text-slate-700 mb-1">Filter by Bus ID</label>
          <input
            type="text"
            value={filterBusId}
            onChange={(e) => {
              setFilterBusId(e.target.value);
              setOffset(0);
            }}
            placeholder="e.g., bus-1"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-secondary"
          />
        </div>
        <div className="flex-1">
          <label className="block text-xs font-medium text-slate-700 mb-1">Filter by Status</label>
          <select
            value={filterStatus}
            onChange={(e) => {
              setFilterStatus(e.target.value);
              setOffset(0);
            }}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-secondary"
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="sent">Sent</option>
            <option value="delivered">Delivered</option>
            <option value="read">Read</option>
            <option value="failed">Failed</option>
          </select>
        </div>
      </div>

      {filteredMessages.length === 0 ? (
        <StateBlock title="No messages found" message="No messages match your filters." />
      ) : (
        <>
          <div className="rounded-2xl border border-slate-100 bg-card shadow-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-neutral text-slate-600 uppercase text-xs">
                <tr>
                  <th className="px-6 py-3 text-left">Timestamp</th>
                  <th className="px-6 py-3 text-left">Bus ID</th>
                  <th className="px-6 py-3 text-left">Template</th>
                  <th className="px-6 py-3 text-left">Message Preview</th>
                  <th className="px-6 py-3 text-left">Status</th>
                  <th className="px-6 py-3 text-left">Delivered</th>
                  <th className="px-6 py-3 text-left">Read</th>
                </tr>
              </thead>
              <tbody>
                {filteredMessages.map((message) => {
                  // Handle both camelCase and snake_case response formats
                  const sentAt = message.sentAt || message.sent_at;
                  const busId = message.busId || message.bus_id;
                  const templateType = message.templateType || message.template_type;
                  const messageText = message.messageText || message.message_text || "";
                  const deliveredAt = message.deliveredAt || message.delivered_at;
                  const readAt = message.readAt || message.read_at;
                  
                  return (
                    <tr key={message.id} className="border-t border-slate-100">
                      <td className="px-6 py-3">{sentAt ? dayjs(sentAt).format("MMM D, HH:mm:ss") : "—"}</td>
                      <td className="px-6 py-3 font-semibold text-primary">{busId || "—"}</td>
                      <td className="px-6 py-3">
                        <span className="text-xs text-slate-500">{templateType || "—"}</span>
                      </td>
                      <td className="px-6 py-3 text-slate-600 max-w-xs truncate" title={messageText}>
                        {messageText ? (messageText.length > 60 ? `${messageText.substring(0, 60)}...` : messageText) : "—"}
                      </td>
                      <td className="px-6 py-3">
                        <MessageStatusBadge status={message.status || "unknown"} />
                      </td>
                      <td className="px-6 py-3 text-xs text-slate-500">
                        {deliveredAt ? dayjs(deliveredAt).format("HH:mm:ss") : "—"}
                      </td>
                      <td className="px-6 py-3 text-xs text-slate-500">
                        {readAt ? dayjs(readAt).format("HH:mm:ss") : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setOffset(Math.max(0, offset - limit))}
              disabled={offset === 0}
              className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="text-sm text-slate-600">
              Showing {offset + 1}-{offset + filteredMessages.length} of {filteredMessages.length} messages
            </span>
            <button
              onClick={() => setOffset(offset + limit)}
              disabled={filteredMessages.length < limit}
              className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </>
      )}
    </section>
  );
};

export default MessagesPage;

