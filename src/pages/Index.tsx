import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useEffect } from 'react';
import { usePublicFeed, useLikePost, useUnlikePost, useLikesForPosts } from '@/hooks/useSocial';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { SocialPostCard } from '@/components/SocialPostCard';
import { TrendingUp, Sparkles, LogIn, Users } from 'lucide-react';

export default function Index() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { data: posts, isLoading: feedLoading } = usePublicFeed();
  const likePost = useLikePost();
  const unlikePost = useUnlikePost();

  const postIds = posts?.map(p => p.id) || [];
  const { data: likedPostsData } = useLikesForPosts(postIds);
  const likedPostIds = new Set(likedPostsData?.map(l => l.post_id) || []);

  useEffect(() => {
    if (!loading && user) {
      navigate('/trade', { replace: true });
    }
  }, [user, loading, navigate]);

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

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
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

      {/* Community Feed Section */}
      <div className="container max-w-2xl py-8 px-4">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Users className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold">Community</h2>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate('/community')}>
            View all
          </Button>
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
            {posts.slice(0, 5).map((post) => (
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
    </div>
  );
}
