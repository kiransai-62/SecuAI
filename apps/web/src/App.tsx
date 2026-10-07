import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './components/Toast';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { AiAssistantPage } from './pages/AiAssistantPage';
import { ProjectsListPage } from './pages/ProjectsListPage';
import { NewProjectPage } from './pages/NewProjectPage';
import { ProjectDetailPage } from './pages/ProjectDetailPage';
import { NewScanPage } from './pages/NewScanPage';
import { ScanDetailPage } from './pages/ScanDetailPage';
import { FindingsListPage } from './pages/FindingsListPage';
import { FindingDetailPage } from './pages/FindingDetailPage';
import { HistoryPage } from './pages/HistoryPage';
import { ReportsPage } from './pages/ReportsPage';
import { SettingsPage } from './pages/SettingsPage';

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            {/* Public Landing & Authentication */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/landing" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />

            {/* Dashboard redirects directly to New Scan workspace */}
            <Route path="/dashboard" element={<Navigate to="/new-scan" replace />} />

            {/* Primary Security Scanner Workspace (New Scan + Completed Score & Gemini AI Report) */}
            <Route
              path="/new-scan"
              element={
                <ProtectedRoute>
                  <NewScanPage />
                </ProtectedRoute>
              }
            />

            {/* AI Assistant (Hero Conversational Workspace) */}
            <Route
              path="/assistant"
              element={
                <ProtectedRoute>
                  <AiAssistantPage />
                </ProtectedRoute>
              }
            />

            {/* Projects & Project Details */}
            <Route
              path="/projects"
              element={
                <ProtectedRoute>
                  <ProjectsListPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/projects/new"
              element={
                <ProtectedRoute>
                  <NewScanPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/projects/:id"
              element={
                <ProtectedRoute>
                  <ProjectDetailPage />
                </ProtectedRoute>
              }
            />

            {/* Scans & Scan Details */}
            <Route
              path="/scans"
              element={
                <ProtectedRoute>
                  <HistoryPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/scans/:id"
              element={
                <ProtectedRoute>
                  <ScanDetailPage />
                </ProtectedRoute>
              }
            />

            {/* Findings & Finding Details */}
            <Route
              path="/findings"
              element={
                <ProtectedRoute>
                  <FindingsListPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/findings/:id"
              element={
                <ProtectedRoute>
                  <FindingDetailPage />
                </ProtectedRoute>
              }
            />

            {/* Scan & Remediation History */}
            <Route
              path="/history"
              element={
                <ProtectedRoute>
                  <HistoryPage />
                </ProtectedRoute>
              }
            />

            {/* Executive Reports & Compliance */}
            <Route
              path="/reports"
              element={
                <ProtectedRoute>
                  <ReportsPage />
                </ProtectedRoute>
              }
            />

            {/* Settings */}
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <SettingsPage />
                </ProtectedRoute>
              }
            />

            {/* Catch-all route redirects to New Scan workspace */}
            <Route path="*" element={<Navigate to="/new-scan" replace />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
