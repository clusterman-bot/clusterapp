import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useEmailVerified } from '@/hooks/useEmailVerified';
import { useIsAlpha, usePlatformSettings } from '@/hooks/useAlpha';
import { EmailVerificationBanner } from '@/components/EmailVerificationBanner';
import { usePublicFeed, useLikePost, useUnlikePost, useLikesForPosts } from '@/hooks/useSocial';
import { usePublicModels } from '@/hooks/useModels';
import { MainNav } from '@/components/MainNav';
import { SocialPostCard } from '@/components/SocialPostCard';
import { CreatePostBox } from '@/components/CreatePostBox';
import { ModelMarketplaceCard } from '@/components/community/ModelMarketplaceCard';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, Sparkles, LogIn, MessageSquareOff, Bot, MessageSquare, Plus } from 'lucide-react';
import { TradingModeToggle } from '@/components/TradingModeToggle';

export default function Community() {
  const { user } = useAuth();
  const { data: publicModels, isLoading: modelsLoading } = usePublicModels();
  const { isVerified } = useEmailVerified();
  const { data: isAlpha } = useIsAlpha();
  const { data: settings } = usePlatformSettings();
  const navigate = useNavigate();
  const { data: posts, isLoading, refetch } = usePublicFeed();
  const likePost = useLikePost();
  const unlikePost = useUnlikePost();

  const postIds = posts?.map(p => p.id) || [];
  const { data: likedPostsData } = useLikesForPosts(postIds);
  const likedPostIds = new Set(likedPostsData?.map(l => l.post_id) || []);

  // Community muted globally for non-Alpha users
  const isCommunityMuted = !!settings?.community_muted && !isAlpha;

  const handleLike = async (postId: string) => {
    if (!user || !isVerified) {
      if (!user) navigate('/auth');
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

  return (
    <div className="min-h-screen bg-background">
      <MainNav />
      <main className="container max-w-3xl py-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Community</h1>
              <p className="text-sm text-muted-foreground">Discover models and see what traders are talking about</p>
            </div>
          </div>
          {user && <TradingModeToggle />}
        </div>

        {/* Verification banner for unverified users */}
        {user && !isVerified && <EmailVerificationBanner />}

        {/* Community muted banner — shown to all non-Alpha users when muted */}
        {isCommunityMuted && (
          <Card className="mb-4 border-destructive/30 bg-destructive/5">
            <CardContent className="py-4 flex items-center gap-3">
              <MessageSquareOff className="h-5 w-5 text-destructive shrink-0" />
              <p className="text-sm text-destructive">Community posting has been temporarily paused by an administrator.</p>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="models">
          <TabsList className="mb-4">
            <TabsTrigger value="models" className="gap-2">
              <Bot className="h-4 w-4" />
              Models
            </TabsTrigger>
            <TabsTrigger value="feed" className="gap-2">
              <MessageSquare className="h-4 w-4" />
              Feed
            </TabsTrigger>
          </TabsList>

          {/* ===== MODELS TAB ===== */}
          <TabsContent value="models">
            {/* Tab header row */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Bot className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Community trading models</span>
              </div>
              {user && isVerified && (
                <Button size="sm" onClick={() => navigate('/models/new')}>
                  <Plus className="h-4 w-4" />
                  Create Model
                </Button>
              )}
            </div>

            {!user && (
              <Card className="mb-4">
                <CardContent className="py-4 flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">Sign in to subscribe to models and mirror trades.</p>
                  <Button size="sm" onClick={() => navigate('/auth')}>
                    <LogIn className="h-4 w-4 mr-2" />
                    Sign In
                  </Button>
                </CardContent>
              </Card>
            )}
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
                          <Skeleton className="h-4 w-2/3" />
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
              <Card className="text-center py-12">
                <CardContent>
                  <Bot className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-lg font-medium mb-2">No models published yet</p>
                  <p className="text-muted-foreground text-sm">Be the first to share your trading model with the community!</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ===== FEED TAB ===== */}
          <TabsContent value="feed">
            {/* Create post box — blocked when community is muted (Alpha users bypass) */}
            {user && isVerified && !isCommunityMuted && (
              <CreatePostBox onPostCreated={() => refetch()} placeholder="Share with the community..." />
            )}

            {/* Sign in prompt for guests */}
            {!user && (
              <Card className="mb-4">
                <CardContent className="py-4 flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">Join the conversation — sign in to post, like, and comment.</p>
                  <Button size="sm" onClick={() => navigate('/auth')}>
                    <LogIn className="h-4 w-4 mr-2" />
                    Sign In
                  </Button>
                </CardContent>
              </Card>
            )}

            <div className="mt-4">
              {isLoading ? (
                <div className="space-y-4">
                  {[...Array(4)].map((_, i) => (
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
                <Card className="text-center py-12">
                  <CardContent>
                    <Sparkles className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-lg font-medium mb-2">No posts yet</p>
                    <p className="text-muted-foreground text-sm">Be the first to share something!</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
