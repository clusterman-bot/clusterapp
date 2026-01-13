import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useComments, useCreateComment, Comment } from '@/hooks/useSocial';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDistanceToNow } from 'date-fns';
import { Send, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface CommentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  postId: string;
  postContent?: string;
  postAuthor?: string;
}

export function CommentDialog({
  open,
  onOpenChange,
  postId,
  postContent,
  postAuthor,
}: CommentDialogProps) {
  const { user } = useAuth();
  const { data: comments, isLoading } = useComments(postId);
  const createComment = useCreateComment();
  const [newComment, setNewComment] = useState('');
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !user) return;

    try {
      await createComment.mutateAsync({
        postId,
        content: newComment.trim(),
      });
      setNewComment('');
      toast({ title: 'Comment posted!' });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Comments</DialogTitle>
        </DialogHeader>

        {/* Original post preview */}
        {postContent && (
          <div className="p-3 bg-muted/50 rounded-lg text-sm mb-2">
            <p className="text-xs text-muted-foreground mb-1">
              Replying to {postAuthor}
            </p>
            <p className="line-clamp-2">{postContent}</p>
          </div>
        )}

        {/* Comments list */}
        <ScrollArea className="flex-1 max-h-[300px] pr-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : comments && comments.length > 0 ? (
            <div className="space-y-4">
              {comments.map((comment: Comment) => (
                <div key={comment.id} className="flex gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={comment.profiles?.avatar_url || undefined} />
                    <AvatarFallback className="text-xs">
                      {comment.profiles?.display_name?.[0] ||
                        comment.profiles?.username?.[0] ||
                        '?'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">
                        {comment.profiles?.display_name || comment.profiles?.username}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        @{comment.profiles?.username}
                      </span>
                      <span className="text-xs text-muted-foreground">·</span>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(comment.created_at), {
                          addSuffix: true,
                        })}
                      </span>
                    </div>
                    <p className="text-sm mt-1">{comment.content}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p>No comments yet</p>
              <p className="text-sm">Be the first to comment!</p>
            </div>
          )}
        </ScrollArea>

        {/* New comment form */}
        {user ? (
          <form onSubmit={handleSubmit} className="mt-4 flex gap-2">
            <Textarea
              placeholder="Write a comment..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              className="resize-none min-h-[60px]"
              maxLength={500}
            />
            <Button
              type="submit"
              size="icon"
              disabled={!newComment.trim() || createComment.isPending}
              className="shrink-0"
            >
              {createComment.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </form>
        ) : (
          <p className="text-center text-sm text-muted-foreground mt-4">
            Sign in to comment
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
