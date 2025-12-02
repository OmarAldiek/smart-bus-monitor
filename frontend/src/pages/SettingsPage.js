import { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";

import { fetchSimulatorStatus, startSimulators, stopSimulators, startBusSimulator, stopBusSimulator, fetchUsers, createUser, deleteUser, changePassword } from "../api/client";
import { useConfig } from "../context/ConfigContext";
import { useAuth } from "../context/AuthContext";
import Tabs from "../components/Tabs";

const SettingsPage = () => {
  const { config, updateConfig } = useConfig();
  const { user: currentUser } = useAuth();
  const [form, setForm] = useState(config);
  const [status, setStatus] = useState(null);
  const [simStatus, setSimStatus] = useState(null);
  const [simMessage, setSimMessage] = useState(null);
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userForm, setUserForm] = useState({ username: "", password: "", role: "operator" });
  const [userMessage, setUserMessage] = useState(null);
  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [passwordMessage, setPasswordMessage] = useState(null);
  const [passwordLoading, setPasswordLoading] = useState(false);

  useEffect(() => {
    setForm(config);
  }, [config]);

  const refreshSimulatorStatus = async () => {
    try {
      const data = await fetchSimulatorStatus();
      setSimStatus(data);
      setSimMessage(null);
    } catch (err) {
      console.error("Failed to fetch simulator status", err);
      setSimMessage("Unable to load simulator status");
    }
  };

  useEffect(() => {
    refreshSimulatorStatus();
    const interval = setInterval(refreshSimulatorStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const refreshUsers = async () => {
    if (currentUser?.role !== "admin") return;
    setUsersLoading(true);
    try {
      const data = await fetchUsers();
      setUsers(data);
    } catch (err) {
      console.error("Failed to fetch users", err);
      setUserMessage("Unable to load users");
    } finally {
      setUsersLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser?.role === "admin") {
      refreshUsers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.role]);

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : Number(value),
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus("Saving...");
    try {
      await updateConfig(form);
      setStatus("Configuration saved ✔");
    } catch (err) {
      console.error("Failed to update config", err);
      setStatus("Failed to save changes");
    }
  };

  const handleStartSimulators = async () => {
    setSimMessage("Starting 13 simulators…");
    try {
      const data = await startSimulators();
      setSimStatus(data);
      setSimMessage("Simulators are streaming data");
    } catch (err) {
      console.error("Failed to start simulators", err);
      setSimMessage("Failed to start simulators");
    }
  };

  const handleStopSimulators = async () => {
    setSimMessage("Stopping simulators…");
    try {
      const data = await stopSimulators();
      setSimStatus(data);
      setSimMessage("Simulators stopped");
    } catch (err) {
      console.error("Failed to stop simulators", err);
      setSimMessage("Failed to stop simulators");
    }
  };

  const allBusesSorted = useMemo(() => {
    if (!simStatus?.buses) return [];
    return [...simStatus.buses].sort((a, b) => a.busId.localeCompare(b.busId, undefined, { numeric: true }));
  }, [simStatus]);

  const heroBusList = useMemo(() => allBusesSorted.slice(0, 4), [allBusesSorted]);

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPasswordMessage(null);
    setPasswordLoading(true);

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordMessage("New passwords do not match");
      setPasswordLoading(false);
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      setPasswordMessage("New password must be at least 6 characters");
      setPasswordLoading(false);
      return;
    }

    try {
      await changePassword(passwordForm.currentPassword, passwordForm.newPassword);
      setPasswordMessage("Password changed successfully ✔");
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (err) {
      setPasswordMessage(err.response?.data?.detail || "Failed to change password");
    } finally {
      setPasswordLoading(false);
    }
  };

  const tabs = [
    { id: "system", label: "System" },
    { id: "simulators", label: "Simulators" },
    { id: "password", label: "Password" },
    ...(currentUser?.role === "admin" ? [{ id: "users", label: "Users" }] : []),
  ];

  return (
    <section className="space-y-4">
      <header>
        <p className="text-xs uppercase tracking-[0.4em] text-secondary">Settings</p>
        <h2 className="text-xl font-semibold text-primary">System Configuration</h2>
      </header>

      <Tabs tabs={tabs} defaultTab="system">
        {(activeTab) => (
          <>
            {activeTab === "system" && (
              <div className="rounded-xl border border-slate-100 bg-card shadow-card overflow-hidden">
          <div className="px-4 py-2.5 border-b border-slate-100 bg-neutral/30">
            <h3 className="text-base font-semibold text-primary">System Settings</h3>
            <p className="text-xs text-slate-500">Configure monitoring thresholds and intervals</p>
          </div>
          <form onSubmit={handleSubmit} className="p-4 space-y-3">
            <div className="grid gap-3">
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-slate-700 text-xs">Overspeed threshold (km/h)</span>
            <input
              type="number"
              name="overspeed_threshold"
              min="40"
              max="120"
              value={form.overspeed_threshold}
              onChange={handleChange}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-secondary"
            />
          </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-slate-700 text-xs">Poll interval (seconds)</span>
            <input
              type="number"
              name="poll_interval_seconds"
              min="3"
              max="30"
              value={form.poll_interval_seconds}
              onChange={handleChange}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-secondary"
            />
          </label>
        </div>

            <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="thingspeak_enabled"
            checked={form.thingspeak_enabled}
            onChange={handleChange}
                className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-secondary"
          />
              <span className="text-xs text-slate-700">Enable ThingSpeak forwarding</span>
            </label>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="auto_sms_enabled"
                checked={form.auto_sms_enabled}
                onChange={handleChange}
                className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-secondary"
              />
              <span className="text-xs text-slate-700">Enable automatic SMS notifications</span>
        </label>

            <div>
              <button
                type="submit"
                className="w-full px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-secondary transition"
              >
                Save Changes
              </button>
              {status && (
                <p className={`mt-1.5 text-xs text-center ${status.includes("✔") ? "text-green-600" : "text-slate-500"}`}>
                  {status}
                </p>
              )}
            </div>
          </form>
              </div>
            )}

            {activeTab === "simulators" && (
              <>
                {/* Simulator Control */}
                <div className="rounded-xl border border-slate-100 bg-card shadow-card overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-slate-100 bg-neutral/30">
                    <h3 className="text-base font-semibold text-primary">Simulator Control</h3>
                    <p className="text-xs text-slate-500">Manage bus telemetry simulators</p>
                  </div>
                  <div className="p-4 space-y-3">
                    <div className="flex items-center justify-between p-3 rounded-lg bg-gradient-to-r from-primary/5 to-secondary/5 border border-primary/10">
                      <div>
                        <p className="text-xs font-medium text-slate-700">
                          Status: <span className={simStatus?.running ? "text-green-600" : "text-slate-400"}>
                            {simStatus?.running ? "Active" : "Idle"}
                          </span>
                        </p>
                        <p className="text-xs text-slate-500">
                          {simStatus?.bus_count || 0} buses
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={handleStartSimulators}
                          className="px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-secondary transition disabled:opacity-50 disabled:cursor-not-allowed"
                          disabled={simStatus?.running}
                        >
                          Start All
                        </button>
                        <button
                          type="button"
                          onClick={handleStopSimulators}
                          className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-xs font-semibold hover:bg-slate-200 transition disabled:opacity-50 disabled:cursor-not-allowed"
                          disabled={!simStatus?.running}
                        >
                          Stop All
                        </button>
                      </div>
                    </div>

                    {simMessage && (
                      <p className={`text-xs px-3 py-1.5 rounded-lg ${
                        simMessage.includes("Failed") ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"
                      }`}>
                        {simMessage}
                      </p>
                    )}

                    {heroBusList.length > 0 && (
                      <div className="grid grid-cols-2 gap-2">
                        {heroBusList.map((bus) => (
                          <div key={bus.busId} className="rounded-lg bg-neutral/50 px-2 py-1.5 border border-slate-200">
                            <p className="text-xs font-medium text-slate-600">{bus.busId}</p>
                            <p className="text-base font-semibold text-primary">{bus.messages_sent}</p>
                            <p className="text-xs text-slate-400">
                              {bus.last_publish ? dayjs(bus.last_publish).format("HH:mm") : "pending"}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Individual Bus Control */}
                {allBusesSorted.length > 0 && (
                  <div className="rounded-xl border border-slate-100 bg-card shadow-card overflow-hidden mt-4">
                    <div className="px-4 py-2.5 border-b border-slate-100 bg-neutral/30">
                      <h3 className="text-base font-semibold text-primary">Individual Bus Control</h3>
                      <p className="text-xs text-slate-500">Start or stop individual bus simulators</p>
                    </div>
                    <div className="overflow-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-neutral text-slate-600 uppercase text-xs tracking-wide">
                          <tr>
                            <th className="px-3 py-2 text-left">Bus</th>
                            <th className="px-3 py-2 text-left">Status</th>
                            <th className="px-3 py-2 text-left">Msgs</th>
                            <th className="px-3 py-2 text-left">Last</th>
                            <th className="px-3 py-2 text-left">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {allBusesSorted.map((bus) => {
                            const isRunning = simStatus?.buses?.some((b) => b.busId === bus.busId && b.messages_sent > 0);
                            return (
                              <tr key={bus.busId} className="border-t border-slate-100 hover:bg-neutral/30">
                                <td className="px-3 py-2 font-semibold text-primary">
                                  {bus.busId}
                                  {bus.stationary && (
                                    <span className="ml-1 text-xs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">S</span>
                                  )}
                                </td>
                                <td className="px-3 py-2">
                                  {isRunning ? (
                                    <span className="text-green-600 font-medium text-xs">Run</span>
                                  ) : (
                                    <span className="text-slate-400 text-xs">Stop</span>
                                  )}
                                </td>
                                <td className="px-3 py-2">{bus.messages_sent || 0}</td>
                                <td className="px-3 py-2 text-slate-500 text-xs">
                                  {bus.last_publish ? dayjs(bus.last_publish).format("HH:mm") : "—"}
                                </td>
                                <td className="px-3 py-2">
                                  {isRunning ? (
                                    <button
                                      onClick={async () => {
                                        try {
                                          await stopBusSimulator(bus.busId);
                                          await refreshSimulatorStatus();
                                        } catch (err) {
                                          console.error("Failed to stop bus", err);
                                        }
                                      }}
                                      className="text-xs px-2 py-1 rounded bg-red-100 text-red-700 hover:bg-red-200 transition"
                                    >
                                      Stop
                                    </button>
                                  ) : (
                                    <button
                                      onClick={async () => {
                                        try {
                                          await startBusSimulator(bus.busId);
                                          await refreshSimulatorStatus();
                                        } catch (err) {
                                          console.error("Failed to start bus", err);
                                        }
                                      }}
                                      className="text-xs px-2 py-1 rounded bg-green-100 text-green-700 hover:bg-green-200 transition"
                                    >
                                      Start
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}

            {activeTab === "users" && currentUser?.role === "admin" && (
              <div className="rounded-xl border border-slate-100 bg-card shadow-card overflow-hidden">
          <div className="px-4 py-2.5 border-b border-slate-100 bg-neutral/30">
            <h3 className="text-base font-semibold text-primary">User Management</h3>
            <p className="text-xs text-slate-500">Create and manage user accounts</p>
          </div>

          <div className="p-4 space-y-4">
            <div>
              <h4 className="text-xs font-semibold text-slate-700 mb-2">Create New User</h4>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setUserMessage(null);
                  try {
                    await createUser(userForm.username, userForm.password, userForm.role);
                    setUserForm({ username: "", password: "", role: "operator" });
                    setUserMessage("User created successfully");
                    await refreshUsers();
                  } catch (err) {
                    setUserMessage(err.response?.data?.detail || "Failed to create user");
                  }
                }}
                className="grid gap-2 md:grid-cols-4"
              >
                <input
                  type="text"
                  placeholder="Username"
                  value={userForm.username}
                  onChange={(e) => setUserForm({ ...userForm, username: e.target.value })}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-secondary"
                  required
                  minLength={3}
                />
                <input
                  type="password"
                  placeholder="Password"
                  value={userForm.password}
                  onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-secondary"
                  required
                  minLength={6}
                />
                <select
                  value={userForm.role}
                  onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-secondary"
                >
                  <option value="operator">Operator</option>
                  <option value="admin">Admin</option>
                </select>
                <button
                  type="submit"
                  className="px-3 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-secondary transition"
                >
                  Create User
                </button>
              </form>
              {userMessage && (
                <p className={`mt-2 text-xs px-3 py-1.5 rounded-lg ${
                  userMessage.includes("success") || userMessage.includes("deleted")
                    ? "bg-green-50 text-green-700"
                    : "bg-red-50 text-red-700"
                }`}>
                  {userMessage}
                </p>
              )}
            </div>

            <div className="border-t border-slate-200 pt-3">
              <h4 className="text-xs font-semibold text-slate-700 mb-2">Existing Users</h4>
              {usersLoading ? (
                <p className="text-xs text-slate-500">Loading users...</p>
              ) : (
                <div className="overflow-auto rounded-lg border border-slate-200">
                  <table className="w-full text-xs">
                    <thead className="bg-neutral text-slate-600 uppercase text-xs tracking-wide">
                      <tr>
                        <th className="px-3 py-2 text-left">Username</th>
                        <th className="px-3 py-2 text-left">Role</th>
                        <th className="px-3 py-2 text-left">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u) => (
                        <tr key={u.id} className="border-t border-slate-100 hover:bg-neutral/30">
                          <td className="px-3 py-2 font-medium text-slate-700">{u.username}</td>
                          <td className="px-3 py-2">
                            <span
                              className={`px-2 py-0.5 rounded text-xs font-medium ${
                                u.role === "admin" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"
                              }`}
                            >
                              {u.role}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            {u.id !== currentUser.id ? (
                              <button
                                onClick={async () => {
                                  if (window.confirm(`Delete user ${u.username}?`)) {
                                    try {
                                      await deleteUser(u.id);
                                      setUserMessage("User deleted successfully");
                                      await refreshUsers();
                                    } catch (err) {
                                      setUserMessage(err.response?.data?.detail || "Failed to delete user");
                                    }
                                  }
                                }}
                                className="text-xs px-2 py-1 rounded bg-red-100 text-red-700 hover:bg-red-200 transition"
                              >
                                Delete
                              </button>
                            ) : (
                              <span className="text-xs text-slate-400">Current</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
                      </div>
                    )}

                    {activeTab === "password" && (
                      <div className="rounded-xl border border-slate-100 bg-card shadow-card overflow-hidden">
                        <div className="px-4 py-2.5 border-b border-slate-100 bg-neutral/30">
                          <h3 className="text-base font-semibold text-primary">Change Password</h3>
                          <p className="text-xs text-slate-500">Update your account password</p>
                        </div>
                        <form onSubmit={handlePasswordChange} className="p-4 space-y-3">
                          <div className="grid gap-3">
                            <label className="flex flex-col gap-1 text-sm">
                              <span className="font-medium text-slate-700 text-xs">Current Password</span>
                              <input
                                type="password"
                                value={passwordForm.currentPassword}
                                onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                                className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-secondary"
                                required
                              />
                            </label>
                            <label className="flex flex-col gap-1 text-sm">
                              <span className="font-medium text-slate-700 text-xs">New Password</span>
                              <input
                                type="password"
                                value={passwordForm.newPassword}
                                onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                                className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-secondary"
                                required
                                minLength={6}
                              />
                            </label>
                            <label className="flex flex-col gap-1 text-sm">
                              <span className="font-medium text-slate-700 text-xs">Confirm New Password</span>
                              <input
                                type="password"
                                value={passwordForm.confirmPassword}
                                onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                                className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-secondary"
                                required
                                minLength={6}
                              />
                            </label>
                          </div>

                          {passwordMessage && (
                            <p className={`text-xs px-3 py-1.5 rounded-lg ${
                              passwordMessage.includes("✔") || passwordMessage.includes("success")
                                ? "bg-green-50 text-green-700"
                                : "bg-red-50 text-red-700"
                            }`}>
                              {passwordMessage}
                            </p>
                          )}

                          <div>
        <button
          type="submit"
                              disabled={passwordLoading}
                              className="w-full px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-secondary transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
                              {passwordLoading ? "Changing..." : "Change Password"}
        </button>
                          </div>
      </form>
                      </div>
                    )}
                  </>
                )}
              </Tabs>
    </section>
  );
};

export default SettingsPage;
