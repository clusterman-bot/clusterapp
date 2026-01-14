import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { Post } from './useSocial';

// Repost hooks
export function useRepost() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async (postId: string) => {
      if (!user?.id) throw new Error('Not authenticated');
      
      const { error } = await supabase
        .from('reposts')
        .insert({
          post_id: postId,
          user_id: user.id,
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      queryClient.invalidateQueries({ queryKey: ['public-feed'] });
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      queryClient.invalidateQueries({ queryKey: ['reposts'] });
      queryClient.invalidateQueries({ queryKey: ['user-reposts'] });
    },
  });
}

export function useUnrepost() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async (postId: string) => {
      if (!user?.id) throw new Error('Not authenticated');
      
      const { error } = await supabase
        .from('reposts')
        .delete()
        .eq('post_id', postId)
        .eq('user_id', user.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      queryClient.invalidateQueries({ queryKey: ['public-feed'] });
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      queryClient.invalidateQueries({ queryKey: ['reposts'] });
      queryClient.invalidateQueries({ queryKey: ['user-reposts'] });
    },
  });
}

export function useRepostsForPosts(postIds: string[]) {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['reposts', user?.id, postIds],
    queryFn: async () => {
      if (!user?.id || postIds.length === 0) return [];
      
      const { data, error } = await supabase
        .from('reposts')
        .select('post_id')
        .eq('user_id', user.id)
        .in('post_id', postIds);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id && postIds.length > 0,
  });
}

export function useUserReposts(userId: string | undefined) {
  return useQuery({
    queryKey: ['user-reposts', userId],
    queryFn: async () => {
      if (!userId) return [];
      
      const { data, error } = await supabase
        .from('reposts')
        .select(`
          id,
          created_at,
          post_id,
          posts:post_id (
            *,
            profiles:user_id (
              id,
              username,
              display_name,
              avatar_url,
              is_verified
            ),
            models:model_id (
              id,
              name
            )
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      // Transform data to include repost info
      return (data || []).map(repost => ({
        ...repost.posts,
        reposted_at: repost.created_at,
        repost_id: repost.id,
        is_repost: true,
        reposter_id: userId,
      })) as (Post & { is_repost: boolean; reposted_at: string; reposter_id: string })[];
    },
    enabled: !!userId,
  });
}

// Bookmark hooks
export function useBookmark() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async (postId: string) => {
      if (!user?.id) throw new Error('Not authenticated');
      
      const { error } = await supabase
        .from('bookmarks')
        .insert({
          post_id: postId,
          user_id: user.id,
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookmarks'] });
      queryClient.invalidateQueries({ queryKey: ['user-bookmarks'] });
    },
  });
}

export function useUnbookmark() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async (postId: string) => {
      if (!user?.id) throw new Error('Not authenticated');
      
      const { error } = await supabase
        .from('bookmarks')
        .delete()
        .eq('post_id', postId)
        .eq('user_id', user.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookmarks'] });
      queryClient.invalidateQueries({ queryKey: ['user-bookmarks'] });
    },
  });
}

export function useBookmarksForPosts(postIds: string[]) {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['bookmarks', user?.id, postIds],
    queryFn: async () => {
      if (!user?.id || postIds.length === 0) return [];
      
      const { data, error } = await supabase
        .from('bookmarks')
        .select('post_id')
        .eq('user_id', user.id)
        .in('post_id', postIds);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id && postIds.length > 0,
  });
}

export function useUserBookmarks() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['user-bookmarks', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('bookmarks')
        .select(`
          id,
          created_at,
          post_id,
          posts:post_id (
            *,
            profiles:user_id (
              id,
              username,
              display_name,
              avatar_url,
              is_verified
            ),
            models:model_id (
              id,
              name
            )
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      return (data || []).map(bookmark => ({
        ...bookmark.posts,
        bookmarked_at: bookmark.created_at,
      })) as (Post & { bookmarked_at: string })[];
    },
    enabled: !!user?.id,
  });
}

// Liked posts hook
export function useUserLikedPosts(userId: string | undefined) {
  return useQuery({
    queryKey: ['user-liked-posts', userId],
    queryFn: async () => {
      if (!userId) return [];
      
      const { data, error } = await supabase
        .from('post_likes')
        .select(`
          id,
          created_at,
          post_id,
          posts:post_id (
            *,
            profiles:user_id (
              id,
              username,
              display_name,
              avatar_url,
              is_verified
            ),
            models:model_id (
              id,
              name
            )
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      return (data || []).map(like => ({
        ...like.posts,
        liked_at: like.created_at,
      })) as (Post & { liked_at: string })[];
    },
    enabled: !!userId,
  });
}