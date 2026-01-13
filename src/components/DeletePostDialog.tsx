import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useDeletePost } from '@/hooks/useSocial';
import { useToast } from '@/hooks/use-toast';

interface DeletePostDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  postId: string;
  isAdminAction?: boolean;
}

export function DeletePostDialog({ 
  open, 
  onOpenChange, 
  postId,
  isAdminAction = false
}: DeletePostDialogProps) {
  const deletePost = useDeletePost();
  const { toast } = useToast();

  const handleDelete = async () => {
    try {
      await deletePost.mutateAsync(postId);
      toast({ 
        title: 'Success', 
        description: isAdminAction 
          ? 'Post removed by administrator' 
          : 'Post deleted successfully' 
      });
      onOpenChange(false);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {isAdminAction ? 'Remove Post (Admin Action)' : 'Delete Post'}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {isAdminAction 
              ? 'You are about to remove this post as an administrator. This action cannot be undone.'
              : 'Are you sure you want to delete this post? This action cannot be undone.'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction 
            onClick={handleDelete}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deletePost.isPending ? 'Deleting...' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
