import { NavLink, useNavigate } from "react-router-dom";
import { FiActivity, FiMap, FiCpu, FiAlertTriangle, FiBook, FiSettings, FiBarChart2, FiMessageSquare } from "react-icons/fi";
import { useConfig } from "../context/ConfigContext";
import { useAuth } from "../context/AuthContext";

const navItems = [
  { label: "Map", path: "/map", icon: <FiMap /> },
  { label: "Live", path: "/live", icon: <FiActivity /> },
  { label: "Buses", path: "/buses", icon: <FiCpu /> },
  { label: "Analytics", path: "/analytics", icon: <FiBarChart2 /> },
  { label: "Alerts", path: "/alerts", icon: <FiAlertTriangle /> },
  { label: "Messages", path: "/messages", icon: <FiMessageSquare /> },
  { label: "Docs", path: "/docs", icon: <FiBook /> },
  { label: "Settings", path: "/settings", icon: <FiSettings /> },
];

const TopBar = () => {
  const { config } = useConfig();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <header className="bg-white/90 backdrop-blur border-b border-slate-200/80 shadow-sm">
      <div className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-baseline gap-2">
          <h2 className="text-lg font-semibold text-primary">School Bus Monitor</h2>
          <span className="hidden text-xs text-slate-400 sm:inline">Dubai fleet</span>
        </div>
        <div className="text-xs sm:text-sm text-slate-600 flex flex-row gap-4 sm:items-center">
          <span>Limit {config.overspeed_threshold} km/h</span>
          <span>Polling {config.poll_interval_seconds}s</span>
          {user && (
            <div className="flex items-center gap-2">
              <span className="text-slate-500">{user.username}</span>
              <span className="text-slate-400">({user.role})</span>
              <button
                onClick={handleLogout}
                className="px-3 py-1 text-xs rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition"
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
      <nav className="flex gap-3 px-4 pb-3 lg:hidden overflow-x-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            title={item.label}
            className={({ isActive }) =>
              `flex items-center justify-center h-9 w-9 rounded-full text-base ${
                isActive ? "bg-primary text-white shadow-sm" : "bg-neutral text-primary"
              }`
            }
          >
            <span aria-hidden="true">{item.icon}</span>
          </NavLink>
        ))}
      </nav>
    </header>
  );
};

export default TopBar;
