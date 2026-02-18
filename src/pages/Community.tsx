import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useEmailVerified } from '@/hooks/useEmailVerified';
import { useIsAlpha, usePlatformSettings } from '@/hooks/useAlpha';
import { EmailVerificationBanner } from '@/components/EmailVerificationBanner';
import { usePublicFeed, useLikePost, useUnlikePost, useLikesForPosts } from '@/hooks/useSocial';
import { MainNav } from '@/components/MainNav';
import { SocialPostCard } from '@/components/SocialPostCard';
import { CreatePostBox } from '@/components/CreatePostBox';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, Sparkles, LogIn, MessageSquareOff } from 'lucide-react';

export default function Community() {
  const { user } = useAuth();
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
      <main className="container max-w-2xl py-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Community</h1>
            <p className="text-sm text-muted-foreground">See what traders are talking about</p>
          </div>
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

        {/* Feed */}
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
      </main>
    </div>
  );
}
