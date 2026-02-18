import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { TradingModeProvider } from "@/hooks/useTradingMode";
import { TourProvider } from "@/contexts/TourContext";
import { GuidedTour } from "@/components/tour/GuidedTour";
import { ProtectedRoute } from "@/components/ProtectedRoute";
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
import ResetPassword from "./pages/ResetPassword";
import AlphaDashboard from "./pages/AlphaDashboard";
import ModelBuilderHub from "./pages/ModelBuilderHub";
import ModelDetail from "./pages/ModelDetail";

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
                {/* Public routes */}
                <Route path="/" element={<Index />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/verify-email" element={<VerifyEmail />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/privacy" element={<PrivacyPolicy />} />
                <Route path="/terms" element={<TermsOfService />} />
                <Route path="/faq" element={<FAQ />} />
                <Route path="/sms-consent" element={<SMSConsent />} />

                {/* Protected routes */}
                <Route path="/trade" element={<ProtectedRoute><Trade /></ProtectedRoute>} />
                <Route path="/trade/stocks/:symbol" element={<ProtectedRoute><StockDetail /></ProtectedRoute>} />
                <Route path="/trade/stocks/:symbol/automate" element={<ProtectedRoute><StockAutomationConfig /></ProtectedRoute>} />
                <Route path="/trade/portfolio" element={<ProtectedRoute><Portfolio /></ProtectedRoute>} />
                <Route path="/trade/orders" element={<ProtectedRoute><Orders /></ProtectedRoute>} />
                <Route path="/trade/ai-builder" element={<ProtectedRoute><AIBotBuilder /></ProtectedRoute>} />
                <Route path="/community" element={<ProtectedRoute><Community /></ProtectedRoute>} />
                <Route path="/settings/brokerage" element={<ProtectedRoute><BrokerageSettings /></ProtectedRoute>} />
                <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
                <Route path="/profile/:userId" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
                <Route path="/alpha" element={<ProtectedRoute><AlphaDashboard /></ProtectedRoute>} />
                <Route path="/models/new" element={<ProtectedRoute><ModelBuilderHub /></ProtectedRoute>} />
                <Route path="/models/:id" element={<ProtectedRoute><ModelDetail /></ProtectedRoute>} />

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

