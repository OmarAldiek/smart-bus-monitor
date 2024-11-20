import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { fetchCurrentUser, loginRequest, setAuthToken } from "../api/client";

const AuthContext = createContext(null);

const STORAGE_KEY = "busmonitoring_auth";

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed.token) {
          setToken(parsed.token);
          setAuthToken(parsed.token);
        }
      } catch {
        // ignore
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!token) {
      setUser(null);
      setAuthToken(null);
      window.localStorage.removeItem(STORAGE_KEY);
      return;
    }
    setAuthToken(token);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ token }));
    const loadUser = async () => {
      try {
        const data = await fetchCurrentUser();
        setUser(data);
      } catch {
        setUser(null);
      }
    };
    loadUser();
  }, [token]);

  const login = async (username, password) => {
    const data = await loginRequest(username, password);
    setToken(data.access_token);
  };

  const logout = () => {
    setToken(null);
  };

  const value = useMemo(
    () => ({ user, token, loading, login, logout }),
    [user, token, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};


