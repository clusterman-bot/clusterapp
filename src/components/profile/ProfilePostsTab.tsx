import { Post, useUserPosts, useLikesForPosts, useLikePost, useUnlikePost } from '@/hooks/useSocial';
import { useUserReposts, useRepostsForPosts, useRepost, useUnrepost } from '@/hooks/useBookmarksAndReposts';
import { SocialPostCard } from '@/components/SocialPostCard';
import { useAuth } from '@/hooks/useAuth';
import { Repeat2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface ProfilePostsTabProps {
  userId: string;
  displayName?: string;
}

export function ProfilePostsTab({ userId, displayName }: ProfilePostsTabProps) {
  const { user } = useAuth();
  const { data: userPosts } = useUserPosts(userId);
  const { data: userReposts } = useUserReposts(userId);
  const likePost = useLikePost();
  const unlikePost = useUnlikePost();
  
  // Combine posts and reposts, sorted by date
  const allPosts = [
    ...(userPosts || []).map(post => ({ ...post, is_repost: false, reposted_at: null })),
    ...(userReposts || []).map(post => ({ ...post })),
  ].sort((a, b) => {
    const dateA = new Date(a.is_repost ? a.reposted_at! : a.created_at);
    const dateB = new Date(b.is_repost ? b.reposted_at! : b.created_at);
    return dateB.getTime() - dateA.getTime();
  });
  
  const postIds = allPosts.map(p => p.id);
  const { data: likedPosts } = useLikesForPosts(postIds);
  const { data: repostedPosts } = useRepostsForPosts(postIds);
  
  const likedPostIds = new Set(likedPosts?.map(l => l.post_id) || []);
  const repostedPostIds = new Set(repostedPosts?.map(r => r.post_id) || []);
  
  const handleLike = async (postId: string) => {
    if (!user) return;
    if (likedPostIds.has(postId)) {
      await unlikePost.mutateAsync(postId);
    } else {
      await likePost.mutateAsync(postId);
    }
  };
  
  if (!allPosts.length) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No posts yet</p>
      </div>
    );
  }
  
  return (
    <div className="space-y-0 divide-y divide-border border rounded-lg">
      {allPosts.map((post) => (
        <div key={post.is_repost ? `repost-${post.id}` : post.id}>
          {post.is_repost && (
            <div className="px-4 pt-2 flex items-center gap-2 text-sm text-muted-foreground">
              <Repeat2 className="h-4 w-4" />
              <span>{displayName || 'User'} reposted</span>
            </div>
          )}
          <SocialPostCard
            post={post as Post}
            isLiked={likedPostIds.has(post.id)}
            onLike={handleLike}
          />
        </div>
      ))}
    </div>
  );
}