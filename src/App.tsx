import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { TradingModeProvider } from "@/hooks/useTradingMode";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import RetailTraderDashboard from "./pages/RetailTraderDashboard";
import ModelBuilder from "./pages/ModelBuilder";
import ModelDetail from "./pages/ModelDetail";
import ModelEdit from "./pages/ModelEdit";
import TrainingDashboard from "./pages/TrainingDashboard";
import Explore from "./pages/Explore";
import Profile from "./pages/Profile";
import RunBacktest from "./pages/RunBacktest";
import Feed from "./pages/Feed";
import Onboarding from "./pages/Onboarding";
import AdminDashboard from "./pages/AdminDashboard";
import Trade from "./pages/Trade";
import StockDetail from "./pages/StockDetail";
import Portfolio from "./pages/Portfolio";
import Orders from "./pages/Orders";
import BrokerageSettings from "./pages/BrokerageSettings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TradingModeProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/onboarding" element={<Onboarding />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/trader-dashboard" element={<RetailTraderDashboard />} />
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/feed" element={<Feed />} />
              <Route path="/models/new" element={<ModelBuilder />} />
              <Route path="/models/:id" element={<ModelDetail />} />
              <Route path="/models/:id/edit" element={<ModelEdit />} />
              <Route path="/models/:id/backtest" element={<RunBacktest />} />
              <Route path="/training" element={<TrainingDashboard />} />
              <Route path="/explore" element={<Explore />} />
              <Route path="/trade" element={<Trade />} />
              <Route path="/trade/stocks/:symbol" element={<StockDetail />} />
              <Route path="/trade/portfolio" element={<Portfolio />} />
              <Route path="/trade/orders" element={<Orders />} />
              <Route path="/settings/brokerage" element={<BrokerageSettings />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/profile/:userId" element={<Profile />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </TradingModeProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
