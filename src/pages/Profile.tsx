import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useUserRole } from '@/hooks/useUserRole';
import { useIsFollowing, useFollow, useUnfollow } from '@/hooks/useSocial';
import { MainNav } from '@/components/MainNav';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  TrendingUp, Users, BarChart3, Settings, 
  CheckCircle, UserPlus, UserMinus, TrendingDown, Target, Store
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export default function Profile() {
  const { userId } = useParams<{ userId: string }>();
  const { user } = useAuth();
  const { data: userRole } = useUserRole();
  const navigate = useNavigate();
  
  // If no userId, show current user's profile
  const profileId = userId || user?.id;
  const isOwnProfile = !userId || userId === user?.id;
  const canCreateModels = userRole?.role === 'developer' || userRole?.role === 'admin';

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

  // Fetch user's models (all public models for marketplace)
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

  useEffect(() => {
    if (!user && !userId) {
      navigate('/auth');
    }
  }, [user, userId, navigate]);

  if (!user && !userId) {
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
      <MainNav />

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

          <Tabs defaultValue="marketplace">
            <TabsList>
              <TabsTrigger value="marketplace">
                <Store className="h-4 w-4 mr-2" />
                Marketplace
              </TabsTrigger>
              <TabsTrigger value="about">About</TabsTrigger>
            </TabsList>

            <TabsContent value="marketplace">
              <div className="mb-4">
                <h3 className="text-lg font-semibold mb-2">Trading Models</h3>
                <p className="text-sm text-muted-foreground">
                  Browse and subscribe to {profile.display_name || profile.username}'s trading strategies
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {userModels && userModels.length > 0 ? (
                  userModels.map((model) => (
                    <Card 
                      key={model.id} 
                      className="cursor-pointer hover:border-primary transition-colors group"
                      onClick={() => navigate(`/models/${model.id}`)}
                    >
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="flex items-center gap-2">
                              {model.name}
                              <Badge variant="outline" className="capitalize text-xs">
                                {model.model_type}
                              </Badge>
                            </CardTitle>
                            <CardDescription className="mt-1">
                              {model.description || 'No description'}
                            </CardDescription>
                          </div>
                          <Badge 
                            variant={model.status === 'published' ? 'default' : 'secondary'}
                            className="text-xs"
                          >
                            {model.status}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-4 gap-2 mb-4">
                          <div className="text-center">
                            <div className="flex items-center justify-center gap-1 mb-1">
                              <TrendingUp className="h-3 w-3 text-muted-foreground" />
                            </div>
                            <p className={`text-sm font-medium ${(model.total_return || 0) >= 0 ? 'text-profit' : 'text-loss'}`}>
                              {((model.total_return || 0) * 100).toFixed(1)}%
                            </p>
                            <p className="text-xs text-muted-foreground">Return</p>
                          </div>
                          <div className="text-center">
                            <div className="flex items-center justify-center gap-1 mb-1">
                              <BarChart3 className="h-3 w-3 text-muted-foreground" />
                            </div>
                            <p className="text-sm font-medium">{(model.sharpe_ratio || 0).toFixed(2)}</p>
                            <p className="text-xs text-muted-foreground">Sharpe</p>
                          </div>
                          <div className="text-center">
                            <div className="flex items-center justify-center gap-1 mb-1">
                              <TrendingDown className="h-3 w-3 text-muted-foreground" />
                            </div>
                            <p className="text-sm font-medium text-loss">
                              {((model.max_drawdown || 0) * 100).toFixed(1)}%
                            </p>
                            <p className="text-xs text-muted-foreground">Drawdown</p>
                          </div>
                          <div className="text-center">
                            <div className="flex items-center justify-center gap-1 mb-1">
                              <Target className="h-3 w-3 text-muted-foreground" />
                            </div>
                            <p className="text-sm font-medium">
                              {((model.win_rate || 0) * 100).toFixed(0)}%
                            </p>
                            <p className="text-xs text-muted-foreground">Win Rate</p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between pt-3 border-t">
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Users className="h-4 w-4" />
                            {model.total_subscribers || 0} subscribers
                          </div>
                          <span className="text-sm font-medium text-primary">
                            {model.performance_fee_percent}% fee
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <div className="col-span-2 text-center py-12">
                    <Store className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground mb-2">No public models yet</p>
                    {isOwnProfile && canCreateModels && (
                      <Button onClick={() => navigate('/models/new')}>
                        Create Your First Model
                      </Button>
                    )}
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
