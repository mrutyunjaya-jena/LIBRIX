import React from 'react';
import { PlatformProvider } from './platform/PlatformContext';
import { ErrorBoundary } from './ui/layout/ErrorBoundary';
import { AppShell } from './ui/layout/AppShell';
import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import './styles/reader.css';

export function App() {
  return (
    <ErrorBoundary>
      <PlatformProvider>
        <AppShell />
      </PlatformProvider>
    </ErrorBoundary>
  );
}

export default App;
