import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

export interface TourStep {
  id: string;
  target?: string; // data-tour attribute value — if absent, shows centered modal
  title: string;
  description: string;
  route?: string;   // navigate to this route before showing step
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  actionLabel?: string; // override "Next" button
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    title: "Welcome to Cluster! 🎉",
    description: "Let's take you through a quick setup so you can start trading. This only takes about a minute!",
    position: 'center',
    actionLabel: "Let's go →",
  },
  {
    id: 'trading-mode',
    target: 'trading-mode-toggle',
    route: '/trade',
    title: "Choose your trading mode",
    description: "Toggle between Paper Trading (virtual money, zero risk) and Live Trading. We recommend starting with Paper to practice first.",
    position: 'bottom',
  },
  {
    id: 'connect-prompt',
    target: 'connect-brokerage-btn',
    route: '/trade',
    title: "Connect your brokerage",
    description: "Click here to link your Alpaca account. You need this to place real trades. Paper trading is free and instant to set up!",
    position: 'bottom',
    actionLabel: 'Click it!',
  },
  {
    id: 'settings-nav',
    target: 'nav-settings',
    route: '/trade',
    title: "Open Brokerage Settings",
    description: "Click Settings in the navigation to connect your Alpaca account and manage your trading keys.",
    position: 'bottom',
    actionLabel: 'Got it →',
  },
  {
    id: 'connect-account-btn',
    target: 'connect-account-btn',
    route: '/settings/brokerage',
    title: "Connect your first account",
    description: "Click \"Connect Account\" here. You'll need a free Alpaca account — it only takes 2 minutes to sign up!",
    position: 'bottom',
    actionLabel: 'Got it!',
  },
  {
    id: 'stock-search',
    target: 'stock-search-input',
    route: '/trade',
    title: "Search for any stock",
    description: "Type a ticker or company name here to find and buy any stock. Try searching for \"AAPL\" or \"Tesla\".",
    position: 'bottom',
  },
  {
    id: 'done',
    title: "You're all set! 🚀",
    description: "You now know your way around Cluster. Start exploring stocks, check your portfolio, and happy trading!",
    position: 'center',
    actionLabel: 'Start Trading!',
  },
];

interface TourContextType {
  isActive: boolean;
  currentStep: number;
  steps: TourStep[];
  startTour: () => void;
  nextStep: () => void;
  prevStep: () => void;
  skipTour: () => void;
}

const TourContext = createContext<TourContextType | undefined>(undefined);

const TOUR_PENDING_KEY = 'cluster_tour_pending';

export function TourProvider({ children }: { children: ReactNode }) {
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const navigate = useNavigate();

  // On mount, resume tour if it was pending (e.g. user had to verify email mid-tour)
  useEffect(() => {
    const pending = localStorage.getItem(TOUR_PENDING_KEY);
    if (pending === 'true') {
      localStorage.removeItem(TOUR_PENDING_KEY);
      setCurrentStep(0);
      setIsActive(true);
    }
  }, []);

  const startTour = useCallback(() => {
    setCurrentStep(0);
    setIsActive(true);
    // Mark as pending so it survives a redirect to email verification
    localStorage.setItem(TOUR_PENDING_KEY, 'true');
  }, []);

  const nextStep = useCallback(() => {
    const next = currentStep + 1;
    if (next >= TOUR_STEPS.length) {
      setIsActive(false);
      setCurrentStep(0);
      localStorage.removeItem(TOUR_PENDING_KEY);
      localStorage.setItem('tour_completed', 'true');
      return;
    }
    const nextStepData = TOUR_STEPS[next];
    if (nextStepData.route) {
      navigate(nextStepData.route);
    }
    setCurrentStep(next);
  }, [currentStep, navigate]);

  const prevStep = useCallback(() => {
    const prev = currentStep - 1;
    if (prev < 0) return;
    const prevStepData = TOUR_STEPS[prev];
    if (prevStepData.route) {
      navigate(prevStepData.route);
    }
    setCurrentStep(prev);
  }, [currentStep, navigate]);

  const skipTour = useCallback(() => {
    setIsActive(false);
    setCurrentStep(0);
    localStorage.removeItem(TOUR_PENDING_KEY);
    localStorage.setItem('tour_completed', 'true');
  }, []);

  return (
    <TourContext.Provider value={{
      isActive,
      currentStep,
      steps: TOUR_STEPS,
      startTour,
      nextStep,
      prevStep,
      skipTour,
    }}>
      {children}
    </TourContext.Provider>
  );
}

export function useTour() {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error('useTour must be used within TourProvider');
  return ctx;
}
