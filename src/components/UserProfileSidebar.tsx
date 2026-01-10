import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useUserRole } from '@/hooks/useUserRole';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Code, LineChart, Settings, User } from 'lucide-react';

export function UserProfileSidebar() {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const { data: userRole } = useUserRole();
  const navigate = useNavigate();

  if (!user || !profile) return null;

  const roleDisplay = userRole?.role === 'developer' 
    ? { label: 'Developer', icon: Code, color: 'bg-blue-500/10 text-blue-500' }
    : userRole?.role === 'admin'
    ? { label: 'Admin', icon: Settings, color: 'bg-purple-500/10 text-purple-500' }
    : { label: 'Trader', icon: LineChart, color: 'bg-green-500/10 text-green-500' };

  const RoleIcon = roleDisplay.icon;

  return (
    <Card className="sticky top-20">
      <CardContent className="pt-6">
        <div className="flex flex-col items-center text-center">
          <Avatar className="h-16 w-16 mb-3">
            <AvatarImage src={profile.avatar_url || undefined} />
            <AvatarFallback className="text-lg">
              {profile.display_name?.[0] || profile.username?.[0] || '?'}
            </AvatarFallback>
          </Avatar>
          
          <h3 className="font-semibold text-lg">
            {profile.display_name || profile.username}
          </h3>
          
          <p className="text-sm text-muted-foreground mb-2">
            @{profile.username}
          </p>
          
          <Badge variant="secondary" className={`${roleDisplay.color} mb-4`}>
            <RoleIcon className="h-3 w-3 mr-1" />
            {roleDisplay.label}
          </Badge>

          {profile.bio && (
            <p className="text-sm text-muted-foreground mb-4 line-clamp-3">
              {profile.bio}
            </p>
          )}

          <Separator className="my-4 w-full" />

          <div className="grid grid-cols-2 gap-4 w-full text-center mb-4">
            <div>
              <p className="text-xl font-bold">{profile.total_followers || 0}</p>
              <p className="text-xs text-muted-foreground">Followers</p>
            </div>
            <div>
              <p className="text-xl font-bold">{profile.total_following || 0}</p>
              <p className="text-xs text-muted-foreground">Following</p>
            </div>
          </div>

          <Button 
            variant="outline" 
            className="w-full"
            onClick={() => navigate('/profile')}
          >
            <User className="h-4 w-4 mr-2" />
            View Profile
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
