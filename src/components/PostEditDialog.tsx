import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useUpdatePost } from '@/hooks/useSocial';
import { useToast } from '@/hooks/use-toast';

interface PostEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  postId: string;
  initialContent: string;
}

export function PostEditDialog({ 
  open, 
  onOpenChange, 
  postId, 
  initialContent 
}: PostEditDialogProps) {
  const [content, setContent] = useState(initialContent);
  const updatePost = useUpdatePost();
  const { toast } = useToast();

  const handleSave = async () => {
    if (!content.trim()) {
      toast({ title: 'Error', description: 'Content cannot be empty', variant: 'destructive' });
      return;
    }

    try {
      await updatePost.mutateAsync({ postId, content: content.trim() });
      toast({ title: 'Success', description: 'Post updated successfully' });
      onOpenChange(false);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Post</DialogTitle>
          <DialogDescription>
            Make changes to your post content.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="What's on your mind?"
            className="min-h-[120px] resize-none"
            maxLength={1000}
          />
          <p className="text-xs text-muted-foreground mt-2 text-right">
            {content.length}/1000
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={updatePost.isPending || !content.trim()}
          >
            {updatePost.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
