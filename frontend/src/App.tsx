/**
 * App Root
 *
 * Routes to different views based on the current path:
 * - / — Main 2D Office (5 pages)
 * - /pet — Floating pet window renderer
 * - /capture-panel — Quick Capture panel renderer
 * - /onboarding — First-launch onboarding flow
 */

import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { platform } from './platform';
import { OfficeLayout } from './components/OfficeLayout';
import { CapturePage } from './pages/CapturePage';
import { IdeaMapPage } from './pages/IdeaMapPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { CompletedPage } from './pages/CompletedPage';
import { MemoryPage } from './pages/MemoryPage';
import { PetWindow } from './components/PetWindow';
import { CapturePanel } from './components/CapturePanel';
import { Onboarding } from './components/Onboarding';

function App() {
  const [onboardingComplete, setOnboardingComplete] = useState<boolean | null>(null);

  useEffect(() => {
    // Check if onboarding is complete
    checkOnboarding();
  }, []);

  async function checkOnboarding() {
    try {
      const config = await platform.storage.getAll();
      setOnboardingComplete(!!config.onboardingComplete);
    } catch {
      setOnboardingComplete(false);
    }
  }

  if (onboardingComplete === null) {
    // Still loading
    return null;
  }

  if (!onboardingComplete) {
    return <Onboarding onComplete={checkOnboarding} />;
  }

  return (
    <Routes>
      {/* Main 2D Office */}
      <Route path="/" element={<OfficeLayout />}>
        <Route index element={<Navigate to="/capture" replace />} />
        <Route path="capture" element={<CapturePage />} />
        <Route path="map" element={<IdeaMapPage />} />
        <Route path="projects" element={<ProjectsPage />} />
        <Route path="completed" element={<CompletedPage />} />
        <Route path="memory" element={<MemoryPage />} />
      </Route>

      {/* Pet window (separate Electron window) */}
      <Route path="/pet" element={<PetWindow />} />

      {/* Quick Capture panel (separate Electron window) */}
      <Route path="/capture-panel" element={<CapturePanel />} />

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
