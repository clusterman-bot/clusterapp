import { useUserBookmarks } from '@/hooks/useBookmarksAndReposts';
import { useLikesForPosts, useLikePost, useUnlikePost, Post } from '@/hooks/useSocial';
import { SocialPostCard } from '@/components/SocialPostCard';
import { useAuth } from '@/hooks/useAuth';
import { Bookmark } from 'lucide-react';

export function ProfileBookmarksTab() {
  const { user } = useAuth();
  const { data: bookmarkedPosts, isLoading } = useUserBookmarks();
  const likePost = useLikePost();
  const unlikePost = useUnlikePost();
  
  const postIds = bookmarkedPosts?.map(p => p.id) || [];
  const { data: currentUserLikes } = useLikesForPosts(postIds);
  
  const likedPostIds = new Set(currentUserLikes?.map(l => l.post_id) || []);
  
  const handleLike = async (postId: string) => {
    if (!user) return;
    if (likedPostIds.has(postId)) {
      await unlikePost.mutateAsync(postId);
    } else {
      await likePost.mutateAsync(postId);
    }
  };
  
  if (isLoading) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }
  
  if (!bookmarkedPosts?.length) {
    return (
      <div className="text-center py-12">
        <Bookmark className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground">No saved posts yet</p>
        <p className="text-sm text-muted-foreground mt-1">Save posts to read them later</p>
      </div>
    );
  }
  
  return (
    <div className="space-y-0 divide-y divide-border border rounded-lg">
      {bookmarkedPosts.map((post) => (
        <SocialPostCard
          key={post.id}
          post={post as Post}
          isLiked={likedPostIds.has(post.id)}
          onLike={handleLike}
        />
      ))}
    </div>
  );
}