import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import MainLayout from './components/Layout/MainLayout'
import DashboardPage from './pages/DashboardPage'
import VersionsPage from './pages/VersionsPage'
import ExchangePage from './pages/ExchangePage'
import ClientsPage from './pages/ClientsPage'
import ActionsPage from './pages/ActionsPage'
import LogsPage from './pages/LogsPage'
import RedisMonitorPage from './pages/RedisMonitorPage'
import SystemPage from './pages/SystemPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<MainLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/services" element={<DashboardPage />} />
          <Route path="/exchange" element={<ExchangePage />} />
          <Route path="/clients" element={<ClientsPage />} />
          <Route path="/actions" element={<ActionsPage />} />
          <Route path="/logs" element={<LogsPage />} />
          <Route path="/redis-monitor" element={<RedisMonitorPage />} />
          <Route path="/system" element={<SystemPage />} />
          <Route path="/versions" element={<VersionsPage />} />
          <Route path="/backups" element={<RedisMonitorPage />} />
          <Route path="/settings" element={<SystemPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
