import React from "react";

const MessageStatusBadge = ({ status }) => {
  const getStatusConfig = (status) => {
    switch (status) {
      case "pending":
        return { bg: "bg-yellow-100", text: "text-yellow-700", label: "Pending" };
      case "sent":
        return { bg: "bg-blue-100", text: "text-blue-700", label: "Sent" };
      case "delivered":
        return { bg: "bg-green-100", text: "text-green-700", label: "Delivered" };
      case "read":
        return { bg: "bg-emerald-100", text: "text-emerald-700", label: "Read" };
      case "failed":
        return { bg: "bg-red-100", text: "text-red-700", label: "Failed" };
      default:
        return { bg: "bg-slate-100", text: "text-slate-700", label: status };
    }
  };

  const config = getStatusConfig(status);

  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${config.bg} ${config.text}`}>
      {config.label}
    </span>
  );
};

export default MessageStatusBadge;

