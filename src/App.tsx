import React from 'react';
import { PlatformProvider } from './platform/PlatformContext';
import { AppShell } from './ui/layout/AppShell';
import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import './styles/reader.css';

export function App() {
  return (
    <PlatformProvider>
      <AppShell />
    </PlatformProvider>
  );
}

export default App;
