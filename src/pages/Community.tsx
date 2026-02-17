import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { usePublicFeed, useLikePost, useUnlikePost, useLikesForPosts, Post as SocialPost } from '@/hooks/useSocial';
import { MainNav } from '@/components/MainNav';
import { SocialPostCard } from '@/components/SocialPostCard';
import { CreatePostBox } from '@/components/CreatePostBox';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, Sparkles, LogIn } from 'lucide-react';

export default function Community() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: posts, isLoading, refetch } = usePublicFeed();
  const likePost = useLikePost();
  const unlikePost = useUnlikePost();

  const postIds = posts?.map(p => p.id) || [];
  const { data: likedPostsData } = useLikesForPosts(postIds);
  const likedPostIds = new Set(likedPostsData?.map(l => l.post_id) || []);

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

        {/* Create post box for logged-in users */}
        {user && <CreatePostBox onPostCreated={() => refetch()} placeholder="Share with the community..." />}

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
