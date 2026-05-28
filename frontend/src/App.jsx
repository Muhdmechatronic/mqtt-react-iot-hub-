import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import LoginPage      from './pages/LoginPage';
import RegisterPage   from './pages/RegisterPage';
import DevicesPage    from './pages/DevicesPage';
import DashboardPage  from './pages/DashboardPage';
import ExportPage     from './pages/ExportPage';
import DatastreamPage from './pages/DatastreamPage';
import DeviceConfigPage from './pages/DeviceConfigPage';
import SandboxPage    from './pages/SandboxPage';
import Layout         from './components/Layout';

function PrivateRoute({ children }) {
  const { token } = useAuth();
  return token ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login"    element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
        <Route index                        element={<Navigate to="/devices" replace />} />
        <Route path="devices"               element={<DevicesPage />} />
        <Route path="dashboard/:id"         element={<DashboardPage />} />
        <Route path="export"                element={<ExportPage />} />
        {/* Legacy routes — still reachable via direct URL */}
        <Route path="datastreams"           element={<DatastreamPage />} />
        <Route path="config"                element={<DeviceConfigPage />} />
        {/* Developer Zone */}
        <Route path="developer/datastreams" element={<DatastreamPage />} />
        <Route path="developer/sandbox"     element={<SandboxPage />} />
      </Route>
    </Routes>
  );
}
