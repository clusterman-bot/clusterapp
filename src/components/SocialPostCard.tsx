import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Heart, MessageCircle, Share2, Bookmark, MoreHorizontal,
  Code, LineChart, TrendingUp, Repeat2, Pencil, Trash2, Shield
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Post as SocialPost, useFollow, useUnfollow, useIsFollowing } from '@/hooks/useSocial';
import { useAuth } from '@/hooks/useAuth';
import { useIsAdmin } from '@/hooks/useUserRole';
import { useRepost, useUnrepost, useRepostsForPosts, useBookmark, useUnbookmark, useBookmarksForPosts } from '@/hooks/useBookmarksAndReposts';
import { PostEditDialog } from '@/components/PostEditDialog';
import { DeletePostDialog } from '@/components/DeletePostDialog';
import { CommentDialog } from '@/components/CommentDialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

interface SocialPostCardProps {
  post: SocialPost;
  isLiked: boolean;
  onLike: (postId: string) => void;
  onComment?: (postId: string) => void;
  onShare?: (postId: string) => void;
  onBookmark?: (postId: string) => void;
  showEngagement?: boolean;
}

export function SocialPostCard({ 
  post, 
  isLiked, 
  onLike, 
  onComment,
  onShare,
  onBookmark,
  showEngagement = true 
}: SocialPostCardProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdmin } = useIsAdmin();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showCommentDialog, setShowCommentDialog] = useState(false);

  // Repost and Bookmark hooks
  const repost = useRepost();
  const unrepost = useUnrepost();
  const bookmark = useBookmark();
  const unbookmark = useUnbookmark();
  const { data: repostedPosts } = useRepostsForPosts([post.id]);
  const { data: bookmarkedPosts } = useBookmarksForPosts([post.id]);
  
  const isReposted = repostedPosts?.some(r => r.post_id === post.id) || false;
  const isBookmarked = bookmarkedPosts?.some(b => b.post_id === post.id) || false;

  // Get the profile ID from post data
  const profileId = post.profiles?.id || post.user_id;
  
  const isOwnPost = user?.id === post.user_id;
  const canModify = isOwnPost || isAdmin;
  const isDeveloper = post.post_type === 'model_update' || post.post_type === 'announcement';
  
  // Follow state for dropdown menu
  const { data: isFollowing } = useIsFollowing(profileId);
  const follow = useFollow();
  const unfollow = useUnfollow();

  const handleFollowFromDropdown = async () => {
    if (!profileId || isOwnPost) return;
    try {
      if (isFollowing) {
        await unfollow.mutateAsync(profileId);
      } else {
        await follow.mutateAsync(profileId);
      }
      queryClient.invalidateQueries({ queryKey: ['following'] });
    } catch (error) {
      console.error('Follow error:', error);
    }
  };
  
  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: `Post by ${post.profiles?.display_name || post.profiles?.username}`,
        text: post.content.slice(0, 100),
        url: window.location.href,
      });
    } else {
      navigator.clipboard.writeText(window.location.href);
    }
    onShare?.(post.id);
  };

  const handleRepost = async () => {
    if (!user) return;
    try {
      if (isReposted) {
        await unrepost.mutateAsync(post.id);
        toast({ title: 'Removed repost' });
      } else {
        await repost.mutateAsync(post.id);
        toast({ title: 'Reposted!' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to repost', variant: 'destructive' });
    }
  };

  const handleBookmark = async () => {
    if (!user) return;
    try {
      if (isBookmarked) {
        await unbookmark.mutateAsync(post.id);
        toast({ title: 'Removed from saved' });
      } else {
        await bookmark.mutateAsync(post.id);
        toast({ title: 'Saved!' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to save', variant: 'destructive' });
    }
    onBookmark?.(post.id);
  };

  return (
    <Card className="hover:bg-muted/30 transition-colors border-b first:rounded-t-lg last:rounded-b-lg rounded-none border-x-0 first:border-t last:border-b">
      <CardHeader className="pb-3 pt-4 px-4">
        <div className="flex items-start gap-3">
          {/* Avatar */}
          <Avatar 
            className="h-12 w-12 cursor-pointer ring-2 ring-transparent hover:ring-primary/20 transition-all"
            onClick={() => navigate(`/profile/${post.profiles?.id}`)}
          >
            <AvatarImage src={post.profiles?.avatar_url || undefined} />
            <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/10 text-primary font-semibold">
              {post.profiles?.display_name?.[0] || post.profiles?.username?.[0] || '?'}
            </AvatarFallback>
          </Avatar>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 flex-wrap">
                <span 
                  className="font-semibold hover:underline cursor-pointer"
                  onClick={() => navigate(`/profile/${post.profiles?.id}`)}
                >
                  {post.profiles?.display_name || post.profiles?.username}
                </span>
                {post.profiles?.is_verified && (
                  <Badge variant="secondary" className="text-xs px-1.5 py-0">
                    ✓
                  </Badge>
                )}
                <span className="text-muted-foreground text-sm">
                  @{post.profiles?.username}
                </span>
                <span className="text-muted-foreground text-sm">·</span>
                <span className="text-muted-foreground text-sm hover:underline cursor-pointer">
                  {post.created_at && formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                </span>
              </div>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-popover">
                  {!isOwnPost && user && (
                    <>
                      <DropdownMenuItem onClick={handleFollowFromDropdown}>
                        {isFollowing ? 'Unfollow' : 'Follow'} @{post.profiles?.username}
                      </DropdownMenuItem>
                      <DropdownMenuItem>Mute @{post.profiles?.username}</DropdownMenuItem>
                    </>
                  )}
                  {canModify && (
                    <>
                      {!isOwnPost && <DropdownMenuSeparator />}
                      <DropdownMenuItem onClick={() => setShowEditDialog(true)}>
                        <Pencil className="h-4 w-4 mr-2" />
                        Edit post
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => setShowDeleteDialog(true)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete post
                      </DropdownMenuItem>
                    </>
                  )}
                  {isAdmin && !isOwnPost && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-amber-600">
                        <Shield className="h-4 w-4 mr-2" />
                        Admin action
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>Report post</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Role Badge */}
            {isDeveloper && (
              <Badge variant="outline" className="text-xs mt-1 bg-primary/5 border-primary/20">
                <Code className="h-3 w-3 mr-1" />
                Developer Update
              </Badge>
            )}

            {/* Post Content */}
            <p className="mt-2 text-[15px] leading-relaxed whitespace-pre-wrap">{post.content}</p>

            {/* Attached Model Card */}
            {post.models && (
              <Card 
                className="mt-3 cursor-pointer hover:bg-muted/50 transition-colors border-primary/20"
                onClick={() => navigate(`/models/${post.models?.id}`)}
              >
                <CardContent className="py-3 px-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
                      <TrendingUp className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-sm">{post.models.name}</p>
                      <p className="text-xs text-muted-foreground">Trading Model</p>
                    </div>
                    <Badge variant="secondary" className="text-xs">View</Badge>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Engagement Actions */}
            {showEngagement && (
              <div className="flex items-center justify-between mt-3 max-w-md">
                {/* Comment */}
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-muted-foreground hover:text-primary hover:bg-primary/10 gap-2 px-2"
                  onClick={() => setShowCommentDialog(true)}
                >
                  <MessageCircle className="h-[18px] w-[18px]" />
                  <span className="text-sm">{post.comments_count || ''}</span>
                </Button>

                {/* Repost */}
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className={`gap-2 px-2 ${
                    isReposted 
                      ? 'text-green-500 hover:text-green-600 hover:bg-green-500/10' 
                      : 'text-muted-foreground hover:text-green-500 hover:bg-green-500/10'
                  }`}
                  onClick={handleRepost}
                  disabled={repost.isPending || unrepost.isPending}
                >
                  <Repeat2 className={`h-[18px] w-[18px] ${isReposted ? 'fill-current' : ''}`} />
                  <span className="text-sm">{(post as any).reposts_count || ''}</span>
                </Button>

                {/* Like */}
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className={`gap-2 px-2 ${
                    isLiked 
                      ? 'text-red-500 hover:text-red-600 hover:bg-red-500/10' 
                      : 'text-muted-foreground hover:text-red-500 hover:bg-red-500/10'
                  }`}
                  onClick={() => onLike(post.id)}
                >
                  <Heart className={`h-[18px] w-[18px] ${isLiked ? 'fill-current' : ''}`} />
                  <span className="text-sm">{post.likes_count || ''}</span>
                </Button>

                {/* Bookmark */}
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className={`gap-2 px-2 ${
                    isBookmarked 
                      ? 'text-primary hover:text-primary hover:bg-primary/10' 
                      : 'text-muted-foreground hover:text-primary hover:bg-primary/10'
                  }`}
                  onClick={handleBookmark}
                >
                  <Bookmark className={`h-[18px] w-[18px] ${isBookmarked ? 'fill-current' : ''}`} />
                </Button>

                {/* Share */}
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-muted-foreground hover:text-primary hover:bg-primary/10 px-2"
                  onClick={handleShare}
                >
                  <Share2 className="h-[18px] w-[18px]" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </CardHeader>

      {/* Edit Dialog */}
      <PostEditDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        postId={post.id}
        initialContent={post.content}
      />

      {/* Delete Dialog */}
      <DeletePostDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        postId={post.id}
        isAdminAction={isAdmin && !isOwnPost}
      />

      {/* Comment Dialog */}
      <CommentDialog
        open={showCommentDialog}
        onOpenChange={setShowCommentDialog}
        postId={post.id}
        postContent={post.content}
        postAuthor={post.profiles?.display_name || post.profiles?.username || 'Unknown'}
      />
    </Card>
  );
}
