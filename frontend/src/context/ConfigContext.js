import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { fetchConfig, sendConfigUpdate } from "../api/client";

const defaultConfig = {
  overspeed_threshold: 70,
  poll_interval_seconds: 5,
  thingspeak_enabled: false,
  auto_sms_enabled: false,
};

const ConfigContext = createContext({
  config: defaultConfig,
  loading: true,
  error: null,
  refresh: () => {},
  updateConfig: async () => defaultConfig,
});

export const ConfigProvider = ({ children }) => {
  const [config, setConfig] = useState(defaultConfig);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchConfig();
      setConfig(data);
      setError(null);
    } catch (err) {
      console.error("Failed to load config", err);
      setError("Unable to load configuration");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 60_000);
    return () => clearInterval(interval);
  }, [refresh]);

  const updateConfig = useCallback(
    async (payload) => {
      const data = await sendConfigUpdate(payload);
      setConfig(data);
      return data;
    },
    []
  );

  const value = useMemo(
    () => ({ config, loading, error, refresh, updateConfig }),
    [config, loading, error, refresh, updateConfig]
  );

  return <ConfigContext.Provider value={value}>{children}</ConfigContext.Provider>;
};

export const useConfig = () => {
  const context = useContext(ConfigContext);
  if (!context) {
    throw new Error("useConfig must be used within a ConfigProvider");
  }
  return context;
};
