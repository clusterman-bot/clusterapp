import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useFollow, useUnfollow, useIsFollowing } from '@/hooks/useSocial';
import { useState } from 'react';

function FollowButton({ userId }: { userId: string }) {
  const { user } = useAuth();
  const { data: isFollowing, isLoading } = useIsFollowing(userId);
  const follow = useFollow();
  const unfollow = useUnfollow();
  const queryClient = useQueryClient();
  const [isOptimistic, setIsOptimistic] = useState<boolean | null>(null);

  const handleFollow = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) return;
    
    const currentlyFollowing = isOptimistic !== null ? isOptimistic : isFollowing;
    setIsOptimistic(!currentlyFollowing);
    
    try {
      if (currentlyFollowing) {
        await unfollow.mutateAsync(userId);
      } else {
        await follow.mutateAsync(userId);
      }
      queryClient.invalidateQueries({ queryKey: ['following', user.id, userId] });
      queryClient.invalidateQueries({ queryKey: ['suggested-users'] });
    } catch (error) {
      setIsOptimistic(null);
      console.error('Follow error:', error);
    }
  };

  const displayFollowing = isOptimistic !== null ? isOptimistic : isFollowing;

  return (
    <Button 
      size="sm" 
      variant={displayFollowing ? "secondary" : "outline"} 
      className="rounded-full text-xs h-8"
      onClick={handleFollow}
      disabled={isLoading || follow.isPending || unfollow.isPending}
    >
      {displayFollowing ? 'Following' : 'Follow'}
    </Button>
  );
}

export function WhoToFollow() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: suggestedUsers = [] } = useQuery({
    queryKey: ['suggested-users', user?.id],
    queryFn: async () => {
      // Use public_profiles view to respect privacy settings
      const { data, error } = await supabase
        .from('public_profiles')
        .select('id, username, display_name, avatar_url, is_verified, bio, total_followers')
        .neq('id', user?.id || '')
        .order('total_followers', { ascending: false })
        .limit(3);
      
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  if (suggestedUsers.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Who to follow</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {suggestedUsers.map((profile) => (
          <div key={profile.id} className="flex items-start gap-3">
            <Avatar 
              className="h-10 w-10 cursor-pointer"
              onClick={() => navigate(`/profile/${profile.id}`)}
            >
              <AvatarImage src={profile.avatar_url || undefined} />
              <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/10 text-primary font-semibold text-sm">
                {profile.display_name?.[0] || profile.username?.[0] || '?'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1">
                <span 
                  className="font-semibold text-sm truncate cursor-pointer hover:underline"
                  onClick={() => navigate(`/profile/${profile.id}`)}
                >
                  {profile.display_name || profile.username}
                </span>
                {profile.is_verified && (
                  <Badge variant="secondary" className="text-[10px] px-1 py-0">✓</Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground truncate">@{profile.username}</p>
            </div>
            {profile.id && <FollowButton userId={profile.id} />}
          </div>
        ))}
        <Button 
          variant="link" 
          className="p-0 h-auto text-primary text-sm"
          onClick={() => navigate('/explore')}
        >
          Show more
        </Button>
      </CardContent>
    </Card>
  );
}
