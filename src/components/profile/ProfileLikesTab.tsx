import { useUserLikedPosts } from '@/hooks/useBookmarksAndReposts';
import { useLikesForPosts, useLikePost, useUnlikePost, Post } from '@/hooks/useSocial';
import { SocialPostCard } from '@/components/SocialPostCard';
import { useAuth } from '@/hooks/useAuth';
import { Heart } from 'lucide-react';

interface ProfileLikesTabProps {
  userId: string;
}

export function ProfileLikesTab({ userId }: ProfileLikesTabProps) {
  const { user } = useAuth();
  const { data: likedPosts, isLoading } = useUserLikedPosts(userId);
  const likePost = useLikePost();
  const unlikePost = useUnlikePost();
  
  const postIds = likedPosts?.map(p => p.id) || [];
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
  
  if (!likedPosts?.length) {
    return (
      <div className="text-center py-12">
        <Heart className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground">No liked posts yet</p>
      </div>
    );
  }
  
  return (
    <div className="space-y-0 divide-y divide-border border rounded-lg">
      {likedPosts.map((post) => (
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