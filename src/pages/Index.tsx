import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { usePublicFeed, Post as SocialPost } from '@/hooks/useSocial';
import { MainNav } from '@/components/MainNav';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  TrendingUp, Heart, MessageCircle, Code, LineChart, 
  Compass, BarChart3, Users, ArrowUpRight, Zap
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export default function Index() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: feedPosts, isLoading: feedLoading } = usePublicFeed();

  // Fetch all public models for the landing page (regardless of status)
  const { data: models, isLoading: modelsLoading } = useQuery({
    queryKey: ['models', 'landing'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('models')
        .select(`
          *,
          profiles:user_id (
            id,
            username,
            display_name,
            avatar_url,
            is_verified
          )
        `)
        .eq('is_public', true)
        .order('total_subscribers', { ascending: false })
        .limit(4);
      
      if (error) throw error;
      return data;
    },
  });

  // Filter posts for different tabs
  const allPosts = feedPosts || [];
  const developerPosts = allPosts.filter(
    (p) => p.post_type === 'model_update' || p.post_type === 'announcement'
  );
  const retailPosts = allPosts.filter(
    (p) => p.post_type === 'update' || p.post_type === 'insight'
  );

  // Get top models
  const topModels = models || [];

  const PostCard = ({ post }: { post: SocialPost }) => (
    <Card className="mb-4 hover:border-primary/50 transition-colors">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Avatar>
              <AvatarImage src={post.profiles?.avatar_url || undefined} />
              <AvatarFallback>
                {post.profiles?.display_name?.[0] || post.profiles?.username?.[0] || '?'}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium">{post.profiles?.display_name || post.profiles?.username}</span>
                {post.profiles?.is_verified && (
                  <Badge variant="secondary" className="text-xs">Verified</Badge>
                )}
                {post.post_type === 'model_update' && (
                  <Badge variant="outline" className="text-xs">
                    <Code className="h-3 w-3 mr-1" />
                    Developer
                  </Badge>
                )}
              </div>
              <span className="text-sm text-muted-foreground">
                @{post.profiles?.username} • {post.created_at && formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
              </span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <p className="whitespace-pre-wrap mb-4">{post.content}</p>

        {post.models && (
          <Card 
            className="mb-4 cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={() => navigate(`/models/${post.models?.id}`)}
          >
            <CardContent className="py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  <span className="font-medium">{post.models.name}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex items-center gap-6 text-muted-foreground">
          <button 
            className="flex items-center gap-2 hover:text-primary transition-colors"
            onClick={() => navigate('/auth')}
          >
            <Heart className="h-4 w-4" />
            <span className="text-sm">{post.likes_count || 0}</span>
          </button>
          <button 
            className="flex items-center gap-2 hover:text-primary transition-colors"
            onClick={() => navigate('/auth')}
          >
            <MessageCircle className="h-4 w-4" />
            <span className="text-sm">{post.comments_count || 0}</span>
          </button>
        </div>
      </CardContent>
    </Card>
  );

  const ModelCard = ({ model }: { model: any }) => (
    <Card 
      className="cursor-pointer hover:border-primary transition-colors group"
      onClick={() => navigate(`/models/${model.id}`)}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            {model.name}
            <ArrowUpRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
          </CardTitle>
          <Badge variant="outline" className="capitalize text-xs">
            {model.model_type}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-3 w-3 text-muted-foreground" />
            <span className={`font-medium ${(model.total_return || 0) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {((model.total_return || 0) * 100).toFixed(1)}%
            </span>
          </div>
          <div className="flex items-center gap-2">
            <BarChart3 className="h-3 w-3 text-muted-foreground" />
            <span className="font-medium">{(model.sharpe_ratio || 0).toFixed(2)}</span>
          </div>
        </div>
        <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
          <Users className="h-3 w-3" />
          {model.total_subscribers || 0} subscribers
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-background">
      <MainNav />

      <main className="container py-6">
        {/* Hero Section */}
        <section className="text-center py-12 mb-8">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
            Build. Backtest. <span className="text-primary">Monetize.</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-6">
            Create AI-powered trading models, validate with professional backtesting, and earn performance fees from subscribers.
          </p>
          <div className="flex gap-4 justify-center">
            <Button size="lg" onClick={() => navigate('/auth')}>Start Building</Button>
            <Button size="lg" variant="outline" onClick={() => navigate('/explore')}>
              <Compass className="mr-2 h-4 w-4" />
              Explore Models
            </Button>
          </div>
        </section>

        {/* Features */}
        <section className="grid md:grid-cols-3 gap-4 mb-12">
          <Card className="text-center p-4">
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-3">
              <Zap className="h-5 w-5 text-primary" />
            </div>
            <h3 className="font-semibold mb-1">Sandbox or No-Code</h3>
            <p className="text-sm text-muted-foreground">Run custom code or use our visual strategy builder.</p>
          </Card>
          <Card className="text-center p-4">
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-3">
              <BarChart3 className="h-5 w-5 text-primary" />
            </div>
            <h3 className="font-semibold mb-1">Professional Backtesting</h3>
            <p className="text-sm text-muted-foreground">Sharpe ratio, max drawdown, win rate, and more.</p>
          </Card>
          <Card className="text-center p-4">
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-3">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <h3 className="font-semibold mb-1">Performance Fees</h3>
            <p className="text-sm text-muted-foreground">Monetize your strategies from subscribers.</p>
          </Card>
        </section>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Feed */}
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Community Feed</h2>
              <Button variant="ghost" size="sm" onClick={() => navigate('/auth')}>
                Join the conversation →
              </Button>
            </div>

            <Tabs defaultValue="all">
              <TabsList className="grid w-full grid-cols-3 mb-4">
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="developers">
                  <Code className="h-4 w-4 mr-2" />
                  Developers
                </TabsTrigger>
                <TabsTrigger value="traders">
                  <LineChart className="h-4 w-4 mr-2" />
                  Traders
                </TabsTrigger>
              </TabsList>

              <TabsContent value="all">
                {feedLoading ? (
                  <div className="space-y-4">
                    {[...Array(3)].map((_, i) => (
                      <Card key={i} className="animate-pulse">
                        <CardHeader><div className="h-12 bg-muted rounded" /></CardHeader>
                        <CardContent><div className="h-20 bg-muted rounded" /></CardContent>
                      </Card>
                    ))}
                  </div>
                ) : allPosts.length > 0 ? (
                  allPosts.map((post) => <PostCard key={post.id} post={post} />)
                ) : (
                  <Card className="text-center py-12">
                    <CardContent>
                      <p className="text-muted-foreground mb-4">No posts yet. Be the first!</p>
                      <Button onClick={() => navigate('/auth')}>Create Account</Button>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="developers">
                {developerPosts.length > 0 ? (
                  developerPosts.map((post) => <PostCard key={post.id} post={post} />)
                ) : (
                  <Card className="text-center py-12">
                    <CardContent>
                      <p className="text-muted-foreground">No developer posts yet</p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="traders">
                {retailPosts.length > 0 ? (
                  retailPosts.map((post) => <PostCard key={post.id} post={post} />)
                ) : (
                  <Card className="text-center py-12">
                    <CardContent>
                      <p className="text-muted-foreground">No trader posts yet</p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
          </div>

          {/* Sidebar - Top Models */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Top Models</h2>
              <Button variant="ghost" size="sm" onClick={() => navigate('/explore')}>
                View all →
              </Button>
            </div>

            {modelsLoading ? (
              <div className="space-y-4">
                {[...Array(4)].map((_, i) => (
                  <Card key={i} className="animate-pulse">
                    <CardHeader><div className="h-6 bg-muted rounded w-3/4" /></CardHeader>
                    <CardContent><div className="h-12 bg-muted rounded" /></CardContent>
                  </Card>
                ))}
              </div>
            ) : topModels.length > 0 ? (
              <div className="space-y-4">
                {topModels.map((model) => (
                  <ModelCard key={model.id} model={model} />
                ))}
              </div>
            ) : (
              <Card className="text-center py-8">
                <CardContent>
                  <p className="text-muted-foreground mb-4">No models yet</p>
                  <Button size="sm" onClick={() => navigate('/auth')}>Create the first</Button>
                </CardContent>
              </Card>
            )}

            {/* CTA Card */}
            <Card className="mt-6 bg-primary/5 border-primary/20">
              <CardContent className="pt-6 text-center">
                <h3 className="font-semibold mb-2">Ready to start trading?</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Join thousands of traders and developers building the future of quantitative finance.
                </p>
                <Button className="w-full" onClick={() => navigate('/auth')}>
                  Create Free Account
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
