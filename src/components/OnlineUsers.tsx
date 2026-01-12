import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Users, Circle } from 'lucide-react';

interface OnlineUser {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  online_at: string;
}

export function OnlineUsers() {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const navigate = useNavigate();
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);

  useEffect(() => {
    if (!user || !profile) return;

    const channel = supabase.channel('online-users');

    channel
      .on('presence', { event: 'sync' }, () => {
        const presenceState = channel.presenceState();
        const users: OnlineUser[] = [];
        
        Object.values(presenceState).forEach((presences: any) => {
          presences.forEach((presence: OnlineUser) => {
            if (!users.find(u => u.id === presence.id)) {
              users.push(presence);
            }
          });
        });
        
        setOnlineUsers(users);
      })
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        console.log('User joined:', newPresences);
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        console.log('User left:', leftPresences);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            id: user.id,
            username: profile.username,
            display_name: profile.display_name,
            avatar_url: profile.avatar_url,
            online_at: new Date().toISOString(),
          });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, profile]);

  if (!user) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="h-4 w-4" />
          Online Now
          <Badge variant="secondary" className="ml-auto">
            {onlineUsers.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {onlineUsers.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-2">
            No users online
          </p>
        ) : (
          onlineUsers.slice(0, 10).map((onlineUser) => (
            <div
              key={onlineUser.id}
              className="flex items-center gap-3 cursor-pointer hover:bg-muted/50 p-2 rounded-lg transition-colors"
              onClick={() => navigate(`/profile/${onlineUser.id}`)}
            >
              <div className="relative">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={onlineUser.avatar_url || undefined} />
                  <AvatarFallback className="text-xs">
                    {onlineUser.display_name?.[0] || onlineUser.username?.[0] || 'U'}
                  </AvatarFallback>
                </Avatar>
                <Circle className="absolute -bottom-0.5 -right-0.5 h-3 w-3 fill-green-500 text-green-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {onlineUser.display_name || onlineUser.username || 'Anonymous'}
                </p>
                {onlineUser.username && (
                  <p className="text-xs text-muted-foreground truncate">
                    @{onlineUser.username}
                  </p>
                )}
              </div>
            </div>
          ))
        )}
        {onlineUsers.length > 10 && (
          <p className="text-xs text-muted-foreground text-center">
            +{onlineUsers.length - 10} more online
          </p>
        )}
      </CardContent>
    </Card>
  );
}
