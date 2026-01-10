import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useMyModels } from '@/hooks/useModels';
import { useIsFollowing, useFollow, useUnfollow } from '@/hooks/useSocial';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  TrendingUp, ArrowLeft, Users, BarChart3, Settings, 
  CheckCircle, UserPlus, UserMinus 
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export default function Profile() {
  const { userId } = useParams<{ userId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  // If no userId, show current user's profile
  const profileId = userId || user?.id;
  const isOwnProfile = !userId || userId === user?.id;

  const { data: ownProfile } = useProfile();
  
  // Fetch the target profile if viewing someone else's
  const { data: targetProfile, isLoading: profileLoading } = useQuery({
    queryKey: ['profile', profileId],
    queryFn: async () => {
      if (!profileId) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', profileId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!profileId && !isOwnProfile,
  });

  const profile = isOwnProfile ? ownProfile : targetProfile;

  // Fetch user's models
  const { data: userModels } = useQuery({
    queryKey: ['user-models', profileId],
    queryFn: async () => {
      if (!profileId) return [];
      const { data, error } = await supabase
        .from('models')
        .select('*')
        .eq('user_id', profileId)
        .eq('is_public', true)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!profileId,
  });

  const { data: isFollowing } = useIsFollowing(profileId || '');
  const follow = useFollow();
  const unfollow = useUnfollow();

  if (!user && !userId) {
    navigate('/auth');
    return null;
  }

  if (profileLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Profile not found</p>
          <Button onClick={() => navigate('/')}>Go Home</Button>
        </div>
      </div>
    );
  }

  const handleFollow = async () => {
    if (!profileId) return;
    if (isFollowing) {
      await unfollow.mutateAsync(profileId);
    } else {
      await follow.mutateAsync(profileId);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="container flex items-center h-16">
          <Button variant="ghost" onClick={() => navigate(-1)}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </Button>
          <div className="flex items-center gap-2 ml-4">
            <TrendingUp className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">Cluster</span>
          </div>
        </div>
      </header>

      <main className="container py-8">
        <div className="max-w-4xl mx-auto">
          <Card className="mb-8">
            <CardContent className="pt-6">
              <div className="flex flex-col md:flex-row items-start gap-6">
                <Avatar className="h-24 w-24">
                  <AvatarImage src={profile.avatar_url || undefined} />
                  <AvatarFallback className="text-2xl">
                    {profile.display_name?.[0] || profile.username?.[0] || '?'}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h1 className="text-2xl font-bold">
                      {profile.display_name || profile.username}
                    </h1>
                    {profile.is_verified && (
                      <CheckCircle className="h-5 w-5 text-primary" />
                    )}
                    <Badge variant="outline" className="capitalize">
                      {profile.user_type || 'developer'}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground mb-4">
                    @{profile.username}
                  </p>
                  {profile.bio && (
                    <p className="text-foreground mb-4">{profile.bio}</p>
                  )}
                  <div className="flex gap-6 text-sm">
                    <div>
                      <span className="font-bold">{profile.total_followers || 0}</span>
                      <span className="text-muted-foreground ml-1">Followers</span>
                    </div>
                    <div>
                      <span className="font-bold">{profile.total_following || 0}</span>
                      <span className="text-muted-foreground ml-1">Following</span>
                    </div>
                    <div>
                      <span className="font-bold">{userModels?.length || 0}</span>
                      <span className="text-muted-foreground ml-1">Models</span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  {isOwnProfile ? (
                    <Button variant="outline" onClick={() => navigate('/settings')}>
                      <Settings className="mr-2 h-4 w-4" /> Edit Profile
                    </Button>
                  ) : user && (
                    <Button 
                      variant={isFollowing ? 'outline' : 'default'}
                      onClick={handleFollow}
                      disabled={follow.isPending || unfollow.isPending}
                    >
                      {isFollowing ? (
                        <>
                          <UserMinus className="mr-2 h-4 w-4" /> Unfollow
                        </>
                      ) : (
                        <>
                          <UserPlus className="mr-2 h-4 w-4" /> Follow
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Tabs defaultValue="models">
            <TabsList>
              <TabsTrigger value="models">Models</TabsTrigger>
              <TabsTrigger value="about">About</TabsTrigger>
            </TabsList>

            <TabsContent value="models">
              <div className="grid gap-4 md:grid-cols-2">
                {userModels && userModels.length > 0 ? (
                  userModels.map((model) => (
                    <Card 
                      key={model.id} 
                      className="cursor-pointer hover:border-primary transition-colors"
                      onClick={() => navigate(`/models/${model.id}`)}
                    >
                      <CardHeader>
                        <CardTitle>{model.name}</CardTitle>
                        <CardDescription>{model.description}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-1">
                              <TrendingUp className="h-4 w-4 text-muted-foreground" />
                              <span className={`font-medium ${(model.total_return || 0) >= 0 ? 'text-profit' : 'text-loss'}`}>
                                {((model.total_return || 0) * 100).toFixed(1)}%
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <BarChart3 className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">{(model.sharpe_ratio || 0).toFixed(2)}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Users className="h-4 w-4" />
                            {model.total_subscribers || 0}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <div className="col-span-2 text-center py-12">
                    <p className="text-muted-foreground">No public models yet</p>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="about">
              <Card>
                <CardContent className="pt-6 space-y-4">
                  <div>
                    <h3 className="font-medium mb-1">Experience Level</h3>
                    <p className="text-muted-foreground capitalize">
                      {profile.experience_level || 'Not specified'}
                    </p>
                  </div>
                  {profile.trading_philosophy && (
                    <div>
                      <h3 className="font-medium mb-1">Trading Philosophy</h3>
                      <p className="text-muted-foreground">{profile.trading_philosophy}</p>
                    </div>
                  )}
                  <div>
                    <h3 className="font-medium mb-1">Member Since</h3>
                    <p className="text-muted-foreground">
                      {new Date(profile.created_at!).toLocaleDateString('en-US', { 
                        month: 'long', 
                        year: 'numeric' 
                      })}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
