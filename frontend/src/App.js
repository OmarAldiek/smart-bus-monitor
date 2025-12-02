import { BrowserRouter as Router, Navigate, Route, Routes } from "react-router-dom";

import Layout from "./components/Layout";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ConfigProvider } from "./context/ConfigContext";
import AlertsPage from "./pages/AlertsPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import BusDetailsPage from "./pages/BusDetailsPage";
import DocumentationPage from "./pages/DocumentationPage";
import LiveStatusPage from "./pages/LiveStatusPage";
import LoginPage from "./pages/LoginPage";
import MapPage from "./pages/MapPage";
import MessagesPage from "./pages/MessagesPage";
import SettingsPage from "./pages/SettingsPage";

const RequireAuth = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral text-slate-600 text-sm">
        Checking session…
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

function App() {
  return (
    <AuthProvider>
    <Router>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/*"
            element={
              <RequireAuth>
      <ConfigProvider>
        <Layout>
          <Routes>
                      <Route path="/" element={<Navigate to="/map" replace />} />
            <Route path="/live" element={<LiveStatusPage />} />
                      <Route path="/map" element={<MapPage />} />
            <Route path="/buses" element={<BusDetailsPage />} />
            <Route path="/buses/:busId" element={<BusDetailsPage />} />
                      <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/alerts" element={<AlertsPage />} />
                      <Route path="/messages" element={<MessagesPage />} />
            <Route path="/docs" element={<DocumentationPage />} />
            <Route path="/settings" element={<SettingsPage />} />
                      <Route path="*" element={<Navigate to="/map" replace />} />
          </Routes>
        </Layout>
      </ConfigProvider>
              </RequireAuth>
            }
          />
        </Routes>
    </Router>
    </AuthProvider>
  );
}

export default App;
