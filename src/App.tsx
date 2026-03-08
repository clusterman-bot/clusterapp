import { lazy, Suspense } from "react";
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
import { ChatWidget } from "@/components/ChatWidget";

// Eagerly load the landing page for FCP/LCP
import Index from "./pages/Index";

// Lazy-load all other pages
const Auth = lazy(() => import("./pages/Auth"));
const Trade = lazy(() => import("./pages/Trade"));
const StockDetail = lazy(() => import("./pages/StockDetail"));
const CryptoDetail = lazy(() => import("./pages/CryptoDetail"));
const CryptoAutomationConfig = lazy(() => import("./pages/CryptoAutomationConfig"));
const StockAutomationConfig = lazy(() => import("./pages/StockAutomationConfig"));
const Portfolio = lazy(() => import("./pages/Portfolio"));
const Orders = lazy(() => import("./pages/Orders"));
const BrokerageSettings = lazy(() => import("./pages/BrokerageSettings"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const TermsOfService = lazy(() => import("./pages/TermsOfService"));
const FAQ = lazy(() => import("./pages/FAQ"));
const SMSConsent = lazy(() => import("./pages/SMSConsent"));
const Community = lazy(() => import("./pages/Community"));
const AIBotBuilder = lazy(() => import("./pages/AIBotBuilder"));
const Profile = lazy(() => import("./pages/Profile"));
const NotFound = lazy(() => import("./pages/NotFound"));
const VerifyEmail = lazy(() => import("./pages/VerifyEmail"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const AlphaDashboard = lazy(() => import("./pages/AlphaDashboard"));
const ModelBuilderHub = lazy(() => import("./pages/ModelBuilderHub"));
const ModelDetail = lazy(() => import("./pages/ModelDetail"));

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
              <Suspense fallback={<div className="min-h-screen bg-background" />}>
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
                  <Route path="/trade/crypto/:symbol" element={<ProtectedRoute><CryptoDetail /></ProtectedRoute>} />
                  <Route path="/trade/stocks/:symbol/automate" element={<ProtectedRoute><StockAutomationConfig /></ProtectedRoute>} />
                  <Route path="/trade/crypto/:symbol/automate" element={<ProtectedRoute><CryptoAutomationConfig /></ProtectedRoute>} />
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
              </Suspense>
              <ChatWidget />
            </TourProvider>
          </BrowserRouter>
        </TooltipProvider>
      </TradingModeProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
