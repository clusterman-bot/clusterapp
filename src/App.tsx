import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { TradingModeProvider } from "@/hooks/useTradingMode";
import { TourProvider } from "@/contexts/TourContext";
import { GuidedTour } from "@/components/tour/GuidedTour";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Trade from "./pages/Trade";
import StockDetail from "./pages/StockDetail";
import StockAutomationConfig from "./pages/StockAutomationConfig";
import Portfolio from "./pages/Portfolio";
import Orders from "./pages/Orders";
import BrokerageSettings from "./pages/BrokerageSettings";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";
import FAQ from "./pages/FAQ";
import SMSConsent from "./pages/SMSConsent";
import Community from "./pages/Community";
import AIBotBuilder from "./pages/AIBotBuilder";
import Profile from "./pages/Profile";
import NotFound from "./pages/NotFound";
import VerifyEmail from "./pages/VerifyEmail";
import AlphaDashboard from "./pages/AlphaDashboard";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TradingModeProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <TourProvider>
              <GuidedTour />
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/trade" element={<Trade />} />
                <Route path="/trade/stocks/:symbol" element={<StockDetail />} />
                <Route path="/trade/stocks/:symbol/automate" element={<StockAutomationConfig />} />
                <Route path="/trade/portfolio" element={<Portfolio />} />
                <Route path="/trade/orders" element={<Orders />} />
                <Route path="/trade/ai-builder" element={<AIBotBuilder />} />
                <Route path="/community" element={<Community />} />
                <Route path="/settings/brokerage" element={<BrokerageSettings />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/profile/:userId" element={<Profile />} />
                <Route path="/privacy" element={<PrivacyPolicy />} />
                <Route path="/terms" element={<TermsOfService />} />
                <Route path="/faq" element={<FAQ />} />
                <Route path="/sms-consent" element={<SMSConsent />} />
                <Route path="/verify-email" element={<VerifyEmail />} />
                <Route path="/alpha" element={<AlphaDashboard />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </TourProvider>
          </BrowserRouter>
        </TooltipProvider>
      </TradingModeProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
