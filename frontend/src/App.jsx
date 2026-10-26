import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { SettingsProvider } from './hooks/useSettings';
import Sidebar from './components/layout/Sidebar';
import Dashboard from './pages/Dashboard';
import Assistant from './pages/Assistant';
import Builder from './pages/Builder';
import FileAnalyzer from './pages/FileAnalyzer';
import ReportGenerator from './pages/ReportGenerator';
import AiDetector from './pages/AiDetector';
import History from './pages/History';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';

export default function App() {
  return (
    <SettingsProvider>
      <BrowserRouter>
        <div className="h-screen overflow-hidden bg-surface-950 text-surface-200">
          <Sidebar />
          <main className="h-screen overflow-y-auto lg:ml-[260px] transition-all duration-300">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/assistant" element={<Assistant />} />
              <Route path="/builder" element={<Builder />} />
              <Route path="/files" element={<FileAnalyzer />} />
              <Route path="/report" element={<ReportGenerator />} />
              <Route path="/detector" element={<AiDetector />} />
              <Route path="/history" element={<History />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: '#1e1e2e',
              color: '#e2e8f0',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '12px',
              fontSize: '13px',
            },
          }}
        />
      </BrowserRouter>
    </SettingsProvider>
  );
}
