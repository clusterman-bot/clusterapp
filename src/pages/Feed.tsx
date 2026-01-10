import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { useFeed, useCreatePost, useLikePost, useUnlikePost, Post as SocialPost } from '@/hooks/useSocial';
import { MainNav } from '@/components/MainNav';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  TrendingUp, Heart, MessageCircle, Share2, Send, 
  Code, LineChart
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export default function Feed() {
  const { user, signOut } = useAuth();
  const { data: userRole } = useUserRole();
  const { data: feedPosts, isLoading, refetch } = useFeed();
  const createPost = useCreatePost();
  const likePost = useLikePost();
  const unlikePost = useUnlikePost();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [newPostContent, setNewPostContent] = useState('');
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());

  const isDeveloper = userRole?.role === 'developer';

  // Subscribe to realtime updates
  useEffect(() => {
    const channel = supabase
      .channel('posts-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'posts' },
        () => {
          refetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetch]);

  // Fetch liked posts
  useEffect(() => {
    if (!user?.id) return;

    const fetchLikedPosts = async () => {
      const { data } = await supabase
        .from('post_likes')
        .select('post_id')
        .eq('user_id', user.id);

      if (data) {
        setLikedPosts(new Set(data.map(like => like.post_id)));
      }
    };

    fetchLikedPosts();
  }, [user?.id]);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
    }
  }, [user, navigate]);

  if (!user) {
    return null;
  }

  const handleCreatePost = async () => {
    if (!newPostContent.trim()) return;

    try {
      await createPost.mutateAsync({
        content: newPostContent,
        post_type: isDeveloper ? 'model_update' : 'update',
      });
      setNewPostContent('');
      toast({ title: 'Posted!', description: 'Your post has been published' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleLike = async (postId: string) => {
    try {
      if (likedPosts.has(postId)) {
        await unlikePost.mutateAsync(postId);
        setLikedPosts(prev => {
          const next = new Set(prev);
          next.delete(postId);
          return next;
        });
      } else {
        await likePost.mutateAsync(postId);
        setLikedPosts(prev => new Set([...prev, postId]));
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  // Filter posts for different tabs
  const allPosts = feedPosts || [];
  const developerPosts = allPosts.filter(
    (p) => p.post_type === 'model_update' || p.post_type === 'announcement'
  );
  const retailPosts = allPosts.filter(
    (p) => p.post_type === 'update' || p.post_type === 'insight'
  );

  const PostCard = ({ post }: { post: SocialPost }) => (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div 
            className="flex items-center gap-3 cursor-pointer"
            onClick={() => navigate(`/profile/${post.profiles?.id}`)}
          >
            <Avatar>
              <AvatarImage src={post.profiles?.avatar_url || undefined} />
              <AvatarFallback>
                {post.profiles?.display_name?.[0] || post.profiles?.username?.[0] || '?'}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium">{post.profiles?.display_name || post.profiles?.username}</span>
                {post.profiles?.is_verified && (
                  <Badge variant="secondary" className="text-xs">Verified</Badge>
                )}
                {post.post_type === 'model_update' && (
                  <Badge variant="outline" className="text-xs">
                    <Code className="h-3 w-3 mr-1" />
                    Developer
                  </Badge>
                )}
              </div>
              <span className="text-sm text-muted-foreground">
                @{post.profiles?.username} • {post.created_at && formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
              </span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <p className="whitespace-pre-wrap mb-4">{post.content}</p>

        {post.models && (
          <Card 
            className="mb-4 cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={() => navigate(`/models/${post.models?.id}`)}
          >
            <CardContent className="py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  <span className="font-medium">{post.models.name}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex items-center gap-6 text-muted-foreground">
          <button 
            className={`flex items-center gap-2 hover:text-primary transition-colors ${likedPosts.has(post.id) ? 'text-red-500' : ''}`}
            onClick={() => handleLike(post.id)}
          >
            <Heart className={`h-4 w-4 ${likedPosts.has(post.id) ? 'fill-current' : ''}`} />
            <span className="text-sm">{post.likes_count || 0}</span>
          </button>
          <button className="flex items-center gap-2 hover:text-primary transition-colors">
            <MessageCircle className="h-4 w-4" />
            <span className="text-sm">{post.comments_count || 0}</span>
          </button>
          <button className="flex items-center gap-2 hover:text-primary transition-colors">
            <Share2 className="h-4 w-4" />
          </button>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-background">
      <MainNav />

      <main className="container py-6">
        <div className="max-w-2xl mx-auto">
          {/* Create Post */}
          <Card className="mb-6">
            <CardContent className="pt-4">
              <Textarea
                placeholder={isDeveloper ? "Share an update about your models..." : "What's on your mind?"}
                value={newPostContent}
                onChange={(e) => setNewPostContent(e.target.value)}
                rows={3}
                className="mb-3"
              />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {isDeveloper ? (
                    <Badge variant="outline">
                      <Code className="h-3 w-3 mr-1" />
                      Posting as Developer
                    </Badge>
                  ) : (
                    <Badge variant="outline">
                      <LineChart className="h-3 w-3 mr-1" />
                      Posting as Trader
                    </Badge>
                  )}
                </div>
                <Button 
                  onClick={handleCreatePost} 
                  disabled={!newPostContent.trim() || createPost.isPending}
                >
                  <Send className="h-4 w-4 mr-2" />
                  Post
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Feed Tabs */}
          <Tabs defaultValue="all">
            <TabsList className="grid w-full grid-cols-3 mb-6">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="developers">
                <Code className="h-4 w-4 mr-2" />
                Developers
              </TabsTrigger>
              <TabsTrigger value="traders">
                <LineChart className="h-4 w-4 mr-2" />
                Traders
              </TabsTrigger>
            </TabsList>

            <TabsContent value="all">
              {isLoading ? (
                <p className="text-center text-muted-foreground py-8">Loading feed...</p>
              ) : allPosts.length > 0 ? (
                allPosts.map((post) => <PostCard key={post.id} post={post} />)
              ) : (
                <div className="text-center py-12">
                  <p className="text-muted-foreground mb-4">No posts yet</p>
                  <p className="text-sm text-muted-foreground">Follow some users to see their updates here!</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="developers">
              {developerPosts.length > 0 ? (
                developerPosts.map((post) => <PostCard key={post.id} post={post} />)
              ) : (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">No developer posts yet</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="traders">
              {retailPosts.length > 0 ? (
                retailPosts.map((post) => <PostCard key={post.id} post={post} />)
              ) : (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">No trader posts yet</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
