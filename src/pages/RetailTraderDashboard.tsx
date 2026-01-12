import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useUserRole } from '@/hooks/useUserRole';
import { useMySubscriptions } from '@/hooks/useSubscriptions';
import { usePublicModels } from '@/hooks/useModels';
import { MainNav } from '@/components/MainNav';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  TrendingUp, 
  TrendingDown, 
  LineChart, 
  Wallet, 
  Star, 
  Users, 
  Search,
  ArrowUpRight,
  Zap,
  Target,
  Shield
} from 'lucide-react';
import OnboardingTour from '@/components/OnboardingTour';

export default function RetailTraderDashboard() {
  const { user, loading: authLoading } = useAuth();
  const { data: profile } = useProfile();
  const { data: userRole, isLoading: roleLoading } = useUserRole();
  const { data: subscriptions = [], isLoading: subsLoading } = useMySubscriptions();
  const { data: publicModels = [] } = usePublicModels();
  const navigate = useNavigate();
  const [showTour, setShowTour] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  // Check if we should show onboarding tour
  useEffect(() => {
    const tourRole = localStorage.getItem('show_onboarding_tour');
    if (tourRole === 'retail_trader' && !localStorage.getItem('onboarding_completed')) {
      setShowTour(true);
      localStorage.removeItem('show_onboarding_tour');
    }
  }, []);

  if (authLoading || roleLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  // Calculate portfolio stats
  const totalPnL = subscriptions.reduce((acc, sub) => acc + (sub.total_pnl || 0), 0);
  const totalFeesPaid = subscriptions.reduce((acc, sub) => acc + (sub.total_fees_paid || 0), 0);
  const activeSubscriptions = subscriptions.length;

  // Get recommended models (top performers not subscribed to)
  const subscribedModelIds = subscriptions.map(s => s.model_id);
  const recommendedModels = publicModels
    .filter((m: any) => !subscribedModelIds.includes(m.id))
    .slice(0, 6);

  return (
    <div className="min-h-screen bg-background">
      {showTour && (
        <OnboardingTour role="retail_trader" onComplete={() => setShowTour(false)} />
      )}
      <MainNav />

      <main className="container py-8">
        {/* Welcome Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">
            Welcome back, {profile?.display_name || profile?.username || 'Trader'}!
          </h1>
          <p className="text-muted-foreground">
            Track your subscriptions and discover new trading models
          </p>
        </div>

        {/* Portfolio Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Active Subscriptions</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeSubscriptions}</div>
              <p className="text-xs text-muted-foreground">
                Trading models you follow
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Portfolio P&L</CardTitle>
              {totalPnL >= 0 ? (
                <TrendingUp className="h-4 w-4 text-green-500" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-500" />
              )}
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${totalPnL >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {totalPnL >= 0 ? '+' : ''}${totalPnL.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">
                Total profit/loss
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Fees Paid</CardTitle>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${totalFeesPaid.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                Performance fees to developers
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Models Available</CardTitle>
              <LineChart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{publicModels.length}</div>
              <p className="text-xs text-muted-foreground">
                In the marketplace
              </p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="subscriptions" className="space-y-6">
          <TabsList>
            <TabsTrigger value="subscriptions">My Subscriptions</TabsTrigger>
            <TabsTrigger value="discover">Discover Models</TabsTrigger>
            <TabsTrigger value="watchlist">Watchlist</TabsTrigger>
          </TabsList>

          {/* My Subscriptions Tab */}
          <TabsContent value="subscriptions" className="space-y-4">
            {subsLoading ? (
              <p className="text-muted-foreground">Loading subscriptions...</p>
            ) : subscriptions.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                    <Search className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">No Active Subscriptions</h3>
                  <p className="text-muted-foreground text-center mb-4 max-w-md">
                    You haven't subscribed to any trading models yet. 
                    Explore the marketplace to find strategies that match your goals.
                  </p>
                  <Button onClick={() => navigate('/explore')}>
                    <Search className="h-4 w-4 mr-2" />
                    Explore Models
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {subscriptions.map((sub) => (
                  <Card key={sub.id} className="hover:border-primary/50 transition-colors">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-4">
                          <Avatar className="h-12 w-12">
                            <AvatarImage src={sub.models.profiles?.avatar_url || ''} />
                            <AvatarFallback>
                              {sub.models.profiles?.display_name?.[0] || 'M'}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <h3 className="font-semibold text-lg">{sub.models.name}</h3>
                            <p className="text-sm text-muted-foreground">
                              by {sub.models.profiles?.display_name || sub.models.profiles?.username}
                            </p>
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                              {sub.models.description}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-6">
                          <div className="text-right">
                            <p className="text-sm text-muted-foreground">Return</p>
                            <p className={`font-semibold ${(sub.models.total_return || 0) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                              {(sub.models.total_return || 0) >= 0 ? '+' : ''}{sub.models.total_return?.toFixed(1) || 0}%
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-muted-foreground">Sharpe</p>
                            <p className="font-semibold">{sub.models.sharpe_ratio?.toFixed(2) || '-'}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-muted-foreground">Your P&L</p>
                            <p className={`font-semibold ${(sub.total_pnl || 0) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                              {(sub.total_pnl || 0) >= 0 ? '+' : ''}${sub.total_pnl?.toLocaleString() || 0}
                            </p>
                          </div>
                          <Button variant="outline" onClick={() => navigate(`/models/${sub.model_id}`)}>
                            View Details
                            <ArrowUpRight className="h-4 w-4 ml-1" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Discover Models Tab */}
          <TabsContent value="discover" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">Recommended For You</h2>
                <p className="text-muted-foreground">Top performing models you might like</p>
              </div>
              <Button variant="outline" onClick={() => navigate('/explore')}>
                View All Models
              </Button>
            </div>

            {recommendedModels.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <p className="text-muted-foreground">No models available yet. Check back soon!</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {recommendedModels.map((model: any) => (
                  <Card key={model.id} className="hover:border-primary/50 transition-colors cursor-pointer" onClick={() => navigate(`/models/${model.id}`)}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={model.profiles?.avatar_url || ''} />
                            <AvatarFallback>{model.profiles?.display_name?.[0] || 'D'}</AvatarFallback>
                          </Avatar>
                          <div>
                            <CardTitle className="text-base">{model.name}</CardTitle>
                            <p className="text-sm text-muted-foreground">
                              {model.profiles?.display_name || model.profiles?.username}
                            </p>
                          </div>
                        </div>
                        {model.profiles?.is_verified && (
                          <Badge variant="secondary" className="text-xs">
                            <Shield className="h-3 w-3 mr-1" />
                            Verified
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                        {model.description || 'No description available'}
                      </p>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="bg-muted/50 rounded-lg p-2">
                          <p className={`font-semibold ${(model.total_return || 0) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {model.total_return?.toFixed(1) || 0}%
                          </p>
                          <p className="text-xs text-muted-foreground">Return</p>
                        </div>
                        <div className="bg-muted/50 rounded-lg p-2">
                          <p className="font-semibold">{model.sharpe_ratio?.toFixed(2) || '-'}</p>
                          <p className="text-xs text-muted-foreground">Sharpe</p>
                        </div>
                        <div className="bg-muted/50 rounded-lg p-2">
                          <p className="font-semibold">{model.performance_fee_percent || 20}%</p>
                          <p className="text-xs text-muted-foreground">Fee</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Why Subscribe Section */}
            <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
              <CardContent className="py-8">
                <h3 className="text-xl font-semibold mb-6 text-center">Why Subscribe to Trading Models?</h3>
                <div className="grid md:grid-cols-3 gap-6">
                  <div className="text-center">
                    <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-3">
                      <Zap className="h-6 w-6 text-primary" />
                    </div>
                    <h4 className="font-medium mb-1">Automated Signals</h4>
                    <p className="text-sm text-muted-foreground">
                      Get real-time trading signals from professional quants
                    </p>
                  </div>
                  <div className="text-center">
                    <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-3">
                      <Target className="h-6 w-6 text-primary" />
                    </div>
                    <h4 className="font-medium mb-1">Proven Performance</h4>
                    <p className="text-sm text-muted-foreground">
                      All models are backtested with verified performance
                    </p>
                  </div>
                  <div className="text-center">
                    <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-3">
                      <Shield className="h-6 w-6 text-primary" />
                    </div>
                    <h4 className="font-medium mb-1">Only Pay for Profits</h4>
                    <p className="text-sm text-muted-foreground">
                      Performance fees mean you only pay when you make money
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Watchlist Tab */}
          <TabsContent value="watchlist">
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                  <Star className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Your Watchlist</h3>
                <p className="text-muted-foreground text-center mb-4 max-w-md">
                  Save models you're interested in to track their performance before subscribing.
                </p>
                <Button variant="outline" onClick={() => navigate('/explore')}>
                  <Search className="h-4 w-4 mr-2" />
                  Find Models to Watch
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
