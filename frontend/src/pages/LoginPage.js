import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const LoginPage = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: "", password: "" });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      // Trim to avoid mobile keyboards adding accidental spaces
      await login(form.username.trim(), form.password.trim());
      navigate("/map", { replace: true });
    } catch (err) {
      console.error("Login failed", err);
      setError("Invalid username or password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl bg-card shadow-card border border-slate-100 p-8 space-y-6">
        <div>
          <h1 className="mt-2 text-2xl font-semibold text-primary">Sign in</h1>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600">Username</label>
            <input
              type="text"
              name="username"
              value={form.username}
              onChange={handleChange}
            autoCapitalize="none"
            autoCorrect="off"
              className="w-full rounded-xl border border-slate-200 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-secondary"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600">Password</label>
            <input
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
            autoCapitalize="none"
            autoCorrect="off"
              className="w-full rounded-xl border border-slate-200 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-secondary"
            />
          </div>
          {error && <p className="text-sm text-warning">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-primary text-white py-2.5 font-semibold hover:bg-secondary transition disabled:opacity-60"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;


