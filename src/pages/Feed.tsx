import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { useFeed, useLikePost, useUnlikePost, Post as SocialPost } from '@/hooks/useSocial';
import { MainNav } from '@/components/MainNav';
import { SocialPostCard } from '@/components/SocialPostCard';
import { CreatePostBox } from '@/components/CreatePostBox';
import { WhoToFollow } from '@/components/WhoToFollow';
import { TrendingTopics } from '@/components/TrendingTopics';
import { UserProfileSidebar } from '@/components/UserProfileSidebar';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { Search, Code, LineChart, Sparkles } from 'lucide-react';

export default function Feed() {
  const { user, signOut } = useAuth();
  const { data: userRole } = useUserRole();
  const { data: feedPosts, isLoading, refetch } = useFeed();
  const likePost = useLikePost();
  const unlikePost = useUnlikePost();
  const navigate = useNavigate();
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

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
      console.error('Error liking post:', error);
    }
  };

  // Filter posts for different tabs
  const allPosts = feedPosts || [];
  const developerPosts = allPosts.filter(
    (p) => p.post_type === 'model_update' || p.post_type === 'announcement'
  );
  const retailPosts = allPosts.filter(
    (p) => p.post_type === 'update' || p.post_type === 'insight'
  );

  // Filter by search query
  const filterPosts = (posts: SocialPost[]) => {
    if (!searchQuery.trim()) return posts;
    const query = searchQuery.toLowerCase();
    return posts.filter(
      p => 
        p.content.toLowerCase().includes(query) ||
        p.profiles?.username?.toLowerCase().includes(query) ||
        p.profiles?.display_name?.toLowerCase().includes(query)
    );
  };

  const renderPosts = (posts: SocialPost[]) => {
    const filtered = filterPosts(posts);
    if (isLoading) {
      return (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="h-32" />
            </Card>
          ))}
        </div>
      );
    }
    
    if (filtered.length === 0) {
      return (
        <Card className="text-center py-12">
          <CardContent>
            <Sparkles className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-lg font-medium mb-2">No posts yet</p>
            <p className="text-muted-foreground text-sm">Be the first to share something!</p>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="divide-y divide-border rounded-lg border">
        {filtered.map((post) => (
          <SocialPostCard
            key={post.id}
            post={post}
            isLiked={likedPosts.has(post.id)}
            onLike={handleLike}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <MainNav />

      <main className="container py-4">
        <div className="grid lg:grid-cols-4 gap-6">
          {/* Left Sidebar */}
          <div className="hidden lg:block">
            <div className="sticky top-20">
              <UserProfileSidebar />
            </div>
          </div>

          {/* Main Feed */}
          <div className="lg:col-span-2">
            {/* Search */}
            <div className="mb-4 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search posts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Create Post */}
            <CreatePostBox onPostCreated={() => refetch()} />

            {/* Feed Tabs */}
            <Tabs defaultValue="for-you" className="mt-4">
              <TabsList className="w-full grid grid-cols-3 h-12 p-0 bg-transparent border-b rounded-none">
                <TabsTrigger 
                  value="for-you" 
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
                >
                  For You
                </TabsTrigger>
                <TabsTrigger 
                  value="developers"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
                >
                  <Code className="h-4 w-4 mr-2" />
                  Developers
                </TabsTrigger>
                <TabsTrigger 
                  value="traders"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
                >
                  <LineChart className="h-4 w-4 mr-2" />
                  Traders
                </TabsTrigger>
              </TabsList>

              <TabsContent value="for-you" className="mt-4">
                {renderPosts(allPosts)}
              </TabsContent>

              <TabsContent value="developers" className="mt-4">
                {renderPosts(developerPosts)}
              </TabsContent>

              <TabsContent value="traders" className="mt-4">
                {renderPosts(retailPosts)}
              </TabsContent>
            </Tabs>
          </div>

          {/* Right Sidebar */}
          <div className="hidden lg:block">
            <div className="sticky top-20 space-y-4">
              <TrendingTopics />
              <WhoToFollow />
              
              {/* Footer Links */}
              <div className="text-xs text-muted-foreground space-x-2 px-2">
                <a href="#" className="hover:underline">Terms</a>
                <a href="#" className="hover:underline">Privacy</a>
                <a href="#" className="hover:underline">About</a>
                <a href="#" className="hover:underline">Help</a>
                <span>© 2024 Cluster</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
