import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { HomePage } from './pages/HomePage';
import { AboutPage } from './pages/AboutPage';
import { RegisterPage } from './pages/RegisterPage';
import { LoginPage } from './pages/LoginPage';
import { PlayerDashboardPage } from './pages/PlayerDashboardPage';
import { AdminLoginPage } from './pages/AdminLoginPage';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import { TournamentsPage } from './pages/TournamentsPage';
import { RulesPage } from './pages/RulesPage';
import { AnnouncementsPage } from './pages/AnnouncementsPage';
import { ContactPage } from './pages/ContactPage';
import { MaintenancePage } from './pages/MaintenancePage';

const ADMIN_ROUTES = ['/admin-portal', '/admin-login', '/admin'];

function AppShell() {
  const { siteConfig, isAdmin } = useAuth();
  const location = useLocation();

  const isAdminPath = ADMIN_ROUTES.some(
    (prefix) => location.pathname === prefix || location.pathname.startsWith(`${prefix}/`)
  );

  // Enforce maintenance mode on client navigation as well (Express handles HTTP 503 on initial load)
  if (siteConfig.maintenanceEnabled && !isAdmin && !isAdminPath) {
    return <MaintenancePage />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#090B0E] text-slate-100">
      <Navbar />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/dashboard" element={<PlayerDashboardPage />} />
          <Route path="/admin-login" element={<AdminLoginPage />} />
          <Route path="/admin-portal" element={<AdminLoginPage />} />
          <Route path="/admin" element={<AdminDashboardPage />} />
          <Route path="/admin-portal/dashboard" element={<AdminDashboardPage />} />
          <Route path="/tournaments" element={<TournamentsPage />} />
          <Route path="/rules" element={<RulesPage />} />
          <Route path="/announcements" element={<AnnouncementsPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/maintenance" element={<MaintenancePage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppShell />
      </AuthProvider>
    </BrowserRouter>
  );
}
