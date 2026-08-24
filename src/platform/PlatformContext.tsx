import React, { createContext, useContext, ReactNode } from 'react';
import { IPlatformServices } from './PlatformInterface';
import { getPlatformServices } from './PlatformFactory';

const PlatformContext = createContext<IPlatformServices>(getPlatformServices());

export const PlatformProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const platform = getPlatformServices();
  return (
    <PlatformContext.Provider value={platform}>
      {children}
    </PlatformContext.Provider>
  );
};

export const usePlatform = (): IPlatformServices => {
  return useContext(PlatformContext);
};
