import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { User } from 'lucide-react';

export function UserProfileSidebar() {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const navigate = useNavigate();

  if (!user || !profile) return null;

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
          
          <p className="text-sm text-muted-foreground mb-4">
            @{profile.username}
          </p>

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
