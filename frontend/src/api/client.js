import axios from "axios";

// Decide base URL at runtime:
// - In local dev (hostname === "localhost"), talk directly to backend on 8000.
// - In Docker/Cloudflare, use relative URLs so requests go through nginx.
const defaultBaseURL =
  typeof window !== "undefined" && window.location.hostname !== "localhost"
    ? ""
    : "http://localhost:8000";

// Allow overriding via build-time env, but keep empty string if explicitly set.
const envBase = process.env.REACT_APP_API_BASE_URL;
const baseURL = envBase ?? defaultBaseURL;

const api = axios.create({
  baseURL,
});

// Add token to all requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("busmonitoring_auth");
    if (token) {
      try {
        const parsed = JSON.parse(token);
        if (parsed.token) {
          config.headers.Authorization = `Bearer ${parsed.token}`;
        }
      } catch (e) {
        // Ignore parse errors
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export const setAuthToken = (token) => {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
};

export const fetchBuses = async () => {
  const { data } = await api.get("/api/buses");
  return data;
};

export const fetchBusHistory = async (busId, params = {}) => {
  const { data } = await api.get(`/api/buses/${busId}/history`, { params });
  return data;
};

export const fetchAlerts = async (limit = 50) => {
  const { data } = await api.get("/api/alerts", { params: { limit } });
  return data;
};

export const fetchConfig = async () => {
  const { data } = await api.get("/api/config");
  return data;
};

export const sendConfigUpdate = async (payload) => {
  const { data } = await api.put("/api/config", payload);
  return data;
};

export const fetchSimulatorStatus = async () => {
  const { data } = await api.get("/api/simulators/status");
  return data;
};

export const startSimulators = async (busIds) => {
  const payload = busIds ? { bus_ids: busIds } : undefined;
  const { data } = await api.post("/api/simulators/start", payload);
  return data;
};

export const stopSimulators = async () => {
  const { data } = await api.post("/api/simulators/stop");
  return data;
};

export const startBusSimulator = async (busId) => {
  const { data } = await api.post(`/api/simulators/bus/${busId}/start`);
  return data;
};

export const stopBusSimulator = async (busId) => {
  const { data } = await api.post(`/api/simulators/bus/${busId}/stop`);
  return data;
};

export const fetchUsers = async () => {
  const { data } = await api.get("/auth/users");
  return data;
};

export const createUser = async (username, password, role) => {
  const { data } = await api.post("/auth/users", { username, password, role });
  return data;
};

export const deleteUser = async (userId) => {
  const { data } = await api.delete(`/auth/users/${userId}`);
  return data;
};

export const loginRequest = async (username, password) => {
  const { data } = await api.post("/auth/login", { username, password });
  return data;
};

export const fetchCurrentUser = async () => {
  const { data } = await api.get("/auth/me");
  return data;
};

export const changePassword = async (currentPassword, newPassword) => {
  const { data } = await api.post("/auth/change-password", {
    current_password: currentPassword,
    new_password: newPassword,
  });
  return data;
};

export const sendDriverMessage = async (busId, alertId, templateType, customNote, speed, threshold) => {
  const payload = {
    bus_id: busId,
    alert_id: alertId || null,
    template_type: templateType,
    custom_note: customNote || null,
    speed: speed || null,
    threshold: threshold || null,
  };
  const { data } = await api.post("/api/messages/send", payload);
  return data;
};

export const fetchMessages = async (busId, limit = 100, offset = 0) => {
  const params = { limit, offset };
  if (busId) {
    params.bus_id = busId;
  }
  const { data } = await api.get("/api/messages", { params });
  return data;
};

export const fetchMessageById = async (messageId) => {
  const { data } = await api.get(`/api/messages/${messageId}`);
  return data;
};

export const fetchMessageTemplates = async () => {
  const { data } = await api.get("/api/messages/templates");
  return data;
};

export default api;
