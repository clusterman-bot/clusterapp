import { useNavigate } from 'react-router-dom';
import { Footer } from '@/components/Footer';
import { MainNav } from '@/components/MainNav';
import { useAuth } from '@/hooks/useAuth';
import { useEffect, useState, useRef } from 'react';
import { usePublicFeed, useLikePost, useUnlikePost, useLikesForPosts } from '@/hooks/useSocial';
import { usePublicModels } from '@/hooks/useModels';
import { useStocks } from '@/hooks/useTrading';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { SocialPostCard } from '@/components/SocialPostCard';
import { ModelMarketplaceCard } from '@/components/community/ModelMarketplaceCard';
import {
  TrendingUp, TrendingDown, Sparkles, LogIn, Users,
  LineChart, Search, Bot, MessageSquare, BarChart3
} from 'lucide-react';

function formatPrice(price: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(price);
}

function StockRowPreview({ stock, onClick }: { stock: any; onClick: () => void }) {
  const priceChange = stock.previous_close
    ? stock.current_price - stock.previous_close
    : 0;
  const priceChangePercent = stock.previous_close
    ? (priceChange / stock.previous_close) * 100
    : 0;
  const isPositive = priceChange >= 0;
  const isPlausible = Math.abs(priceChangePercent) < 20;

  return (
    <div
      className="flex items-center justify-between p-4 hover:bg-muted/50 cursor-pointer border-b last:border-b-0 transition-colors"
      onClick={onClick}
    >
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
          <span className="font-bold text-sm text-primary">{stock.symbol.slice(0, 2)}</span>
        </div>
        <div>
          <p className="font-semibold">{stock.symbol}</p>
          <p className="text-sm text-muted-foreground">{stock.name}</p>
        </div>
      </div>
      <div className="text-right">
        <p className="font-semibold">{formatPrice(stock.current_price)}</p>
        {stock.previous_close && isPlausible ? (
          <div className={`flex items-center justify-end gap-1 text-sm ${isPositive ? 'text-profit' : 'text-loss'}`}>
            {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            <span>{isPositive ? '+' : ''}{priceChangePercent.toFixed(2)}%</span>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Click for details</p>
        )}
      </div>
    </div>
  );
}

export default function Index() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  // Social data
  const { data: posts, isLoading: feedLoading } = usePublicFeed();
  const likePost = useLikePost();
  const unlikePost = useUnlikePost();
  const postIds = posts?.map(p => p.id) || [];
  const { data: likedPostsData } = useLikesForPosts(postIds);
  const likedPostIds = new Set(likedPostsData?.map(l => l.post_id) || []);

  // Models data
  const { data: publicModels, isLoading: modelsLoading } = usePublicModels();

  // Trade data
  const [searchQuery, setSearchQuery] = useState('');
  const { data: stocks, isLoading: stocksLoading } = useStocks(searchQuery);

  // Section refs for smooth scrolling
  const tradeRef = useRef<HTMLDivElement>(null);
  const communityRef = useRef<HTMLDivElement>(null);

  // Active section tracking
  const [activeSection, setActiveSection] = useState<string>('home');

  useEffect(() => {
    if (!loading && user) {
      navigate('/trade', { replace: true });
    }
  }, [user, loading, navigate]);

  // Intersection observer for active section tracking
  useEffect(() => {
    const sections = [
      { id: 'home', ref: null },
      { id: 'trade', ref: tradeRef },
      { id: 'community', ref: communityRef },
    ];

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      { rootMargin: '-40% 0px -40% 0px' }
    );

    sections.forEach(({ ref }) => {
      if (ref?.current) observer.observe(ref.current);
    });

    return () => observer.disconnect();
  }, []);

  const scrollTo = (id: string) => {
    if (id === 'home') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleLike = async (postId: string) => {
    if (!user) {
      navigate('/auth');
      return;
    }
    try {
      if (likedPostIds.has(postId)) {
        await unlikePost.mutateAsync(postId);
      } else {
        await likePost.mutateAsync(postId);
      }
    } catch (error) {
      console.error('Error liking post:', error);
    }
  };

  const topGainers = stocks?.filter(s => s.previous_close && s.current_price > s.previous_close)
    .sort((a, b) => {
      const aChange = ((a.current_price - (a.previous_close || 0)) / (a.previous_close || 1));
      const bChange = ((b.current_price - (b.previous_close || 0)) / (b.previous_close || 1));
      return bChange - aChange;
    }).slice(0, 5) || [];

  const topLosers = stocks?.filter(s => s.previous_close && s.current_price < s.previous_close)
    .sort((a, b) => {
      const aChange = ((a.current_price - (a.previous_close || 0)) / (a.previous_close || 1));
      const bChange = ((b.current_price - (b.previous_close || 0)) / (b.previous_close || 1));
      return aChange - bChange;
    }).slice(0, 5) || [];

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const sectionNavItems = [
    { id: 'home', label: 'Home', icon: Sparkles },
    { id: 'trade', label: 'Trade', icon: LineChart },
    { id: 'community', label: 'Community', icon: Users },
  ];

  return (
    <div className="min-h-screen bg-background scroll-smooth">
      {/* Hero Section */}
      <div className="border-b border-border">
        <div className="container max-w-4xl py-12 px-4">
          <div className="text-center space-y-6">
            <div className="flex items-center justify-center gap-3 mb-2">
              <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center">
                <TrendingUp className="h-7 w-7 text-primary" />
              </div>
            </div>
            <div className="space-y-3">
              <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
                Welcome to <span className="text-primary">Cluster</span>
              </h1>
              <p className="text-lg text-muted-foreground max-w-md mx-auto">
                Your AI-powered stock trading platform. Build strategies, follow models, and trade smarter.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 max-w-sm mx-auto">
              <Button
                size="lg"
                className="flex-1 text-lg h-14 gap-3"
                onClick={() => navigate('/auth?mode=signup&tutorial=true')}
              >
                <Sparkles className="h-5 w-5" />
                Launch Tutorial!
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="flex-1 text-lg h-14 gap-3"
                onClick={() => navigate('/auth')}
              >
                <LogIn className="h-5 w-5" />
                Log In
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              Free to get started · No credit card required
            </p>
          </div>
        </div>
      </div>

      {/* Sticky Section Nav */}
      <div className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-border">
        <div className="container max-w-4xl">
          <nav className="flex items-center gap-1 py-2 overflow-x-auto">
            {sectionNavItems.map(({ id, label, icon: Icon }) => (
              <Button
                key={id}
                variant={activeSection === id ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => scrollTo(id)}
                className="gap-2 shrink-0"
              >
                <Icon className="h-4 w-4" />
                {label}
              </Button>
            ))}
            <div className="ml-auto">
              <Button size="sm" onClick={() => navigate('/auth')}>
                <LogIn className="h-4 w-4 mr-2" />
                Sign In
              </Button>
            </div>
          </nav>
        </div>
      </div>

      {/* ===== TRADE SECTION ===== */}
      <div id="trade" ref={tradeRef} className="scroll-mt-14">
        <div className="container max-w-4xl py-8 px-4">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <LineChart className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Trade</h2>
              <p className="text-sm text-muted-foreground">Explore stocks and market movers</p>
            </div>
          </div>

          {/* Search */}
          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search any stock (e.g., AAPL, TSLA, MSFT)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-12 text-lg"
            />
          </div>

          {/* Movers */}
          {!searchQuery && (topGainers.length > 0 || topLosers.length > 0) && (
            <div className="grid gap-4 md:grid-cols-2 mb-6">
              {topGainers.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm text-profit">
                      <TrendingUp className="h-4 w-4" /> Top Gainers
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    {topGainers.map(stock => (
                      <StockRowPreview
                        key={stock.id}
                        stock={stock}
                        onClick={() => navigate(`/trade/stocks/${stock.symbol}`)}
                      />
                    ))}
                  </CardContent>
                </Card>
              )}
              {topLosers.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm text-loss">
                      <TrendingDown className="h-4 w-4" /> Top Losers
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    {topLosers.map(stock => (
                      <StockRowPreview
                        key={stock.id}
                        stock={stock}
                        onClick={() => navigate(`/trade/stocks/${stock.symbol}`)}
                      />
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Stock List */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                {searchQuery ? 'Search Results' : 'All Stocks'}
                {stocks && <Badge variant="secondary">{stocks.length}</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 max-h-[500px] overflow-y-auto">
              {stocksLoading ? (
                <div className="p-8 text-center text-muted-foreground">Loading...</div>
              ) : stocks && stocks.length > 0 ? (
                stocks.map(stock => (
                  <StockRowPreview
                    key={stock.id}
                    stock={stock}
                    onClick={() => navigate(`/trade/stocks/${stock.symbol}`)}
                  />
                ))
              ) : (
                <div className="p-8 text-center text-muted-foreground">
                  {searchQuery ? `No stocks found for "${searchQuery}"` : 'No stocks available'}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Sign up CTA */}
          <Card className="mt-6 border-dashed border-2 border-primary/30 bg-primary/5">
            <CardContent className="py-6 text-center">
              <p className="font-medium mb-2">Want to trade? Create an account to get started.</p>
              <Button onClick={() => navigate('/auth?mode=signup')}>
                <Sparkles className="h-4 w-4 mr-2" />
                Sign Up Free
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ===== COMMUNITY SECTION ===== */}
      <div id="community" ref={communityRef} className="border-t border-border scroll-mt-14">
        <div className="container max-w-3xl py-8 px-4">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Community</h2>
              <p className="text-sm text-muted-foreground">Discover models and see what traders are talking about</p>
            </div>
          </div>

          {/* Models */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <Bot className="h-5 w-5 text-muted-foreground" />
              <h3 className="font-semibold">Trading Models</h3>
            </div>
            {modelsLoading ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <Card key={i}>
                    <CardContent className="py-5">
                      <div className="flex gap-4">
                        <Skeleton className="h-10 w-10 rounded-full" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-4 w-40" />
                          <Skeleton className="h-4 w-full" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : publicModels && publicModels.length > 0 ? (
              <div className="space-y-3">
                {publicModels.map((model: any) => (
                  <ModelMarketplaceCard key={model.id} model={model} />
                ))}
              </div>
            ) : (
              <Card className="text-center py-8">
                <CardContent>
                  <Bot className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                  <p className="font-medium">No models published yet</p>
                  <p className="text-sm text-muted-foreground mt-1">Be the first to share a trading model!</p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Feed */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <MessageSquare className="h-5 w-5 text-muted-foreground" />
              <h3 className="font-semibold">Community Feed</h3>
            </div>

            {feedLoading ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <Card key={i}>
                    <CardContent className="py-4">
                      <div className="flex gap-3">
                        <Skeleton className="h-12 w-12 rounded-full" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-4 w-full" />
                          <Skeleton className="h-4 w-3/4" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : posts && posts.length > 0 ? (
              <div className="divide-y divide-border rounded-lg border">
                {posts.map((post) => (
                  <SocialPostCard
                    key={post.id}
                    post={post}
                    isLiked={likedPostIds.has(post.id)}
                    onLike={handleLike}
                  />
                ))}
              </div>
            ) : (
              <Card className="text-center py-8">
                <CardContent>
                  <Sparkles className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                  <p className="font-medium">No community posts yet</p>
                  <p className="text-sm text-muted-foreground mt-1">Sign up to be the first to post!</p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sign up CTA */}
          <Card className="mt-6 border-dashed border-2 border-primary/30 bg-primary/5">
            <CardContent className="py-6 text-center">
              <p className="font-medium mb-2">Join the community to post, comment, and follow models.</p>
              <Button onClick={() => navigate('/auth?mode=signup')}>
                <LogIn className="h-4 w-4 mr-2" />
                Sign Up Free
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <Footer />
    </div>
  );
}
