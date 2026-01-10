import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useProfile, useUpdateProfile } from '@/hooks/useProfile';
import { useUserRole } from '@/hooks/useUserRole';
import { useIsFollowing, useFollow, useUnfollow } from '@/hooks/useSocial';
import { MainNav } from '@/components/MainNav';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { 
  TrendingUp, Users, BarChart3, Settings, 
  CheckCircle, UserPlus, UserMinus, TrendingDown, Target, Store,
  User, Calendar, Award, Briefcase
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export default function Profile() {
  const { userId } = useParams<{ userId: string }>();
  const { user } = useAuth();
  const { data: userRole } = useUserRole();
  const navigate = useNavigate();
  const { toast } = useToast();
  const updateProfile = useUpdateProfile();
  
  // Edit profile state
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    display_name: '',
    username: '',
    bio: '',
    trading_philosophy: '',
    experience_level: '',
  });
  
  // If no userId, show current user's profile
  const profileId = userId || user?.id;
  const isOwnProfile = !userId || userId === user?.id;
  const isRetailTrader = userRole?.role === 'retail_trader';
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

  // Fetch user's models (only for developers/admins)
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
    enabled: !!profileId && !isRetailTrader,
  });

  const { data: isFollowing } = useIsFollowing(profileId || '');
  const follow = useFollow();
  const unfollow = useUnfollow();

  // Initialize edit form when profile loads
  const handleOpenEdit = () => {
    if (profile) {
      setEditForm({
        display_name: profile.display_name || '',
        username: profile.username || '',
        bio: profile.bio || '',
        trading_philosophy: profile.trading_philosophy || '',
        experience_level: profile.experience_level || 'beginner',
      });
    }
    setIsEditOpen(true);
  };

  const handleSaveProfile = async () => {
    try {
      await updateProfile.mutateAsync({
        display_name: editForm.display_name || null,
        username: editForm.username || null,
        bio: editForm.bio || null,
        trading_philosophy: editForm.trading_philosophy || null,
        experience_level: editForm.experience_level || 'beginner',
      });
      toast({ title: 'Profile updated successfully' });
      setIsEditOpen(false);
    } catch (error: any) {
      toast({ 
        title: 'Failed to update profile', 
        description: error.message,
        variant: 'destructive' 
      });
    }
  };

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
      <MainNav />

      <main className="container py-8">
        <div className="max-w-4xl mx-auto">
          {/* Profile Header */}
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
                      {profile.user_type === 'retail_trader' ? 'Trader' : profile.user_type || 'developer'}
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
                    {!isRetailTrader && (
                      <div>
                        <span className="font-bold">{userModels?.length || 0}</span>
                        <span className="text-muted-foreground ml-1">Models</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  {isOwnProfile ? (
                    <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                      <DialogTrigger asChild>
                        <Button variant="outline" onClick={handleOpenEdit}>
                          <Settings className="mr-2 h-4 w-4" /> Edit Profile
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-[500px]">
                        <DialogHeader>
                          <DialogTitle>Edit Profile</DialogTitle>
                          <DialogDescription>
                            Update your profile information
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="space-y-2">
                            <Label htmlFor="display_name">Display Name</Label>
                            <Input
                              id="display_name"
                              value={editForm.display_name}
                              onChange={(e) => setEditForm(prev => ({ ...prev, display_name: e.target.value }))}
                              placeholder="Your display name"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="username">Username</Label>
                            <Input
                              id="username"
                              value={editForm.username}
                              onChange={(e) => setEditForm(prev => ({ ...prev, username: e.target.value }))}
                              placeholder="your_username"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="bio">Bio</Label>
                            <Textarea
                              id="bio"
                              value={editForm.bio}
                              onChange={(e) => setEditForm(prev => ({ ...prev, bio: e.target.value }))}
                              placeholder="Tell us about yourself..."
                              rows={3}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="experience">Experience Level</Label>
                            <Select 
                              value={editForm.experience_level} 
                              onValueChange={(v) => setEditForm(prev => ({ ...prev, experience_level: v }))}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select experience level" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="beginner">Beginner</SelectItem>
                                <SelectItem value="intermediate">Intermediate</SelectItem>
                                <SelectItem value="advanced">Advanced</SelectItem>
                                <SelectItem value="expert">Expert</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="philosophy">Trading Philosophy</Label>
                            <Textarea
                              id="philosophy"
                              value={editForm.trading_philosophy}
                              onChange={(e) => setEditForm(prev => ({ ...prev, trading_philosophy: e.target.value }))}
                              placeholder="Describe your trading approach..."
                              rows={3}
                            />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setIsEditOpen(false)}>
                            Cancel
                          </Button>
                          <Button 
                            onClick={handleSaveProfile}
                            disabled={updateProfile.isPending}
                          >
                            {updateProfile.isPending ? 'Saving...' : 'Save Changes'}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
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

          {/* Content Tabs - Different for retail vs developer */}
          {isRetailTrader && isOwnProfile ? (
            // Retail trader view - About section only
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" /> About
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <Award className="h-5 w-5 text-primary mt-0.5" />
                      <div>
                        <h3 className="font-medium">Experience Level</h3>
                        <p className="text-muted-foreground capitalize">
                          {profile.experience_level || 'Not specified'}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-3">
                      <Calendar className="h-5 w-5 text-primary mt-0.5" />
                      <div>
                        <h3 className="font-medium">Member Since</h3>
                        <p className="text-muted-foreground">
                          {new Date(profile.created_at!).toLocaleDateString('en-US', { 
                            month: 'long', 
                            year: 'numeric' 
                          })}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <Briefcase className="h-5 w-5 text-primary mt-0.5" />
                      <div>
                        <h3 className="font-medium">Account Type</h3>
                        <p className="text-muted-foreground">Retail Trader</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {profile.trading_philosophy && (
                      <div>
                        <h3 className="font-medium mb-2">Trading Philosophy</h3>
                        <p className="text-muted-foreground">{profile.trading_philosophy}</p>
                      </div>
                    )}
                    
                    {profile.bio && (
                      <div>
                        <h3 className="font-medium mb-2">Bio</h3>
                        <p className="text-muted-foreground">{profile.bio}</p>
                      </div>
                    )}

                    {!profile.trading_philosophy && !profile.bio && (
                      <div className="text-center py-8">
                        <p className="text-muted-foreground mb-4">
                          Complete your profile to share more about yourself
                        </p>
                        <Button variant="outline" onClick={handleOpenEdit}>
                          <Settings className="mr-2 h-4 w-4" /> Edit Profile
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            // Developer/Admin view - Marketplace and About tabs
            <Tabs defaultValue="marketplace">
              <TabsList>
                <TabsTrigger value="marketplace">
                  <Store className="h-4 w-4 mr-2" />
                  Marketplace
                </TabsTrigger>
                <TabsTrigger value="about">
                  <User className="h-4 w-4 mr-2" />
                  About
                </TabsTrigger>
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
                  <CardContent className="pt-6 space-y-6">
                    <div className="grid gap-6 md:grid-cols-2">
                      <div className="space-y-4">
                        <div className="flex items-start gap-3">
                          <Award className="h-5 w-5 text-primary mt-0.5" />
                          <div>
                            <h3 className="font-medium">Experience Level</h3>
                            <p className="text-muted-foreground capitalize">
                              {profile.experience_level || 'Not specified'}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-start gap-3">
                          <Calendar className="h-5 w-5 text-primary mt-0.5" />
                          <div>
                            <h3 className="font-medium">Member Since</h3>
                            <p className="text-muted-foreground">
                              {new Date(profile.created_at!).toLocaleDateString('en-US', { 
                                month: 'long', 
                                year: 'numeric' 
                              })}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        {profile.trading_philosophy && (
                          <div>
                            <h3 className="font-medium mb-2">Trading Philosophy</h3>
                            <p className="text-muted-foreground">{profile.trading_philosophy}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          )}
        </div>
      </main>
    </div>
  );
}
