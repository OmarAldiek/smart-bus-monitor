import { NavLink } from "react-router-dom";
import { FiActivity, FiMap, FiCpu, FiAlertTriangle, FiBook, FiSettings, FiBarChart2, FiMessageSquare } from "react-icons/fi";

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

const Sidebar = () => {
  return (
    <aside className="hidden lg:flex lg:flex-col w-20 bg-primary text-white min-h-screen shadow-xl">
      <div className="h-16 border-b border-white/10" />
      <nav className="flex-1 flex flex-col items-center py-6 space-y-3">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            title={item.label}
            className={({ isActive }) =>
              `flex items-center justify-center h-11 w-11 rounded-2xl text-lg transition-colors ${
                isActive ? "bg-white text-primary shadow-md" : "bg-white/5 hover:bg-white/15 text-white"
              }`
            }
          >
            <span aria-hidden="true">{item.icon}</span>
          </NavLink>
        ))}
      </nav>
      <div className="flex items-center justify-center py-4 text-[10px] text-white/60 border-t border-white/10">
        DXB
      </div>
    </aside>
  );
};

export default Sidebar;
