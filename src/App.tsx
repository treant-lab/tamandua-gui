import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Alerts } from './pages/Alerts';
import { Scan } from './pages/Scan';
import { Quarantine } from './pages/Quarantine';
import { Settings } from './pages/Settings';
import { Security } from './pages/Security';
import { ProcessExplorer } from './pages/ProcessExplorer';
import { Exclusions } from './pages/Exclusions';
import { EventHistory } from './pages/EventHistory';
import { License } from './pages/License';
import { ScheduledScans } from './pages/ScheduledScans';
import { Network } from './pages/Network';
import { Files } from './pages/Files';
import { Performance } from './pages/Performance';
import { Logs } from './pages/Logs';
import { MitreAttack } from './pages/MitreAttack';
import { ThreatIntel } from './pages/ThreatIntel';
import { ResponseHistory } from './pages/ResponseHistory';
import { AgentSetup } from './pages/AgentSetup';
import { Updates } from './pages/Updates';
import { IncidentDetail } from './pages/IncidentDetail';
import { AuthProvider } from './context/AuthContext';
import { PasswordDialog, BiometricPrompt, SetupWizard } from './components/auth';
import { useAuth } from './hooks/useAuth';
import { ToastProvider } from './components/Toast';
import { ConfirmProvider } from './components/ConfirmDialog';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5000,
    },
  },
});

function AuthDialogs() {
  const {
    showPasswordDialog,
    showBiometricPrompt,
    showSetupWizard,
  } = useAuth();

  return (
    <>
      <PasswordDialog isOpen={showPasswordDialog} />
      <BiometricPrompt isOpen={showBiometricPrompt} />
      <SetupWizard isOpen={showSetupWizard} />
    </>
  );
}

function AppContent() {
  return (
    <>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="alerts" element={<Alerts />} />
            <Route path="incidents/:id" element={<IncidentDetail />} />
            <Route path="scan" element={<Scan />} />
            <Route path="schedules" element={<ScheduledScans />} />
            <Route path="quarantine" element={<Quarantine />} />
            <Route path="exclusions" element={<Exclusions />} />
            <Route path="settings" element={<Settings />} />
            <Route path="setup" element={<AgentSetup />} />
            <Route path="updates" element={<Updates />} />
            <Route path="security" element={<Security />} />
            <Route path="processes" element={<ProcessExplorer />} />
            <Route path="network" element={<Network />} />
            <Route path="files" element={<Files />} />
            <Route path="performance" element={<Performance />} />
            <Route path="logs" element={<Logs />} />
            <Route path="mitre" element={<MitreAttack />} />
            <Route path="threat-intel" element={<ThreatIntel />} />
            <Route path="response-history" element={<ResponseHistory />} />
            <Route path="events" element={<EventHistory />} />
            <Route path="license" element={<License />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <AuthDialogs />
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider>
          <ConfirmProvider>
            <AppContent />
          </ConfirmProvider>
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
