import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type TradingMode = 'paper' | 'live';

interface TradingModeContextType {
  mode: TradingMode;
  setMode: (mode: TradingMode) => void;
  isPaper: boolean;
  isLive: boolean;
}

const TradingModeContext = createContext<TradingModeContextType | undefined>(undefined);

export function TradingModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<TradingMode>(() => {
    // Get from localStorage or default to paper
    const saved = localStorage.getItem('tradingMode');
    return (saved === 'live' ? 'live' : 'paper') as TradingMode;
  });

  const setMode = (newMode: TradingMode) => {
    setModeState(newMode);
    localStorage.setItem('tradingMode', newMode);
  };

  return (
    <TradingModeContext.Provider 
      value={{ 
        mode, 
        setMode, 
        isPaper: mode === 'paper',
        isLive: mode === 'live'
      }}
    >
      {children}
    </TradingModeContext.Provider>
  );
}

export function useTradingMode() {
  const context = useContext(TradingModeContext);
  if (!context) {
    throw new Error('useTradingMode must be used within a TradingModeProvider');
  }
  return context;
}
