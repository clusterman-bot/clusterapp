import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useSetUserRole, useUserRole, AppRole } from '@/hooks/useUserRole';
import { useProfile, useUpdateProfile } from '@/hooks/useProfile';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { TrendingUp, Code, LineChart, CheckCircle, ArrowRight, Twitter, Linkedin, Github, Globe } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

type OnboardingStep = 'username' | 'role' | 'social';

export default function Onboarding() {
  const { user, loading: authLoading } = useAuth();
  const { data: existingRole, isLoading: roleLoading } = useUserRole();
  const { data: profile, isLoading: profileLoading } = useProfile();
  const setUserRole = useSetUserRole();
  const updateProfile = useUpdateProfile();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [step, setStep] = useState<OnboardingStep>('username');
  const [selectedRole, setSelectedRole] = useState<AppRole | null>(null);
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [socialLinks, setSocialLinks] = useState({
    twitter_handle: '',
    linkedin_url: '',
    github_handle: '',
    website_url: '',
  });

  // Initialize form with profile data if available
  useEffect(() => {
    if (profile) {
      if (profile.username) setUsername(profile.username);
      if (profile.display_name) setDisplayName(profile.display_name);
      if (profile.twitter_handle) setSocialLinks(prev => ({ ...prev, twitter_handle: profile.twitter_handle || '' }));
      if (profile.linkedin_url) setSocialLinks(prev => ({ ...prev, linkedin_url: profile.linkedin_url || '' }));
      if (profile.github_handle) setSocialLinks(prev => ({ ...prev, github_handle: profile.github_handle || '' }));
      if (profile.website_url) setSocialLinks(prev => ({ ...prev, website_url: profile.website_url || '' }));
    }
  }, [profile]);

  // Redirect users appropriately
  useEffect(() => {
    if (authLoading || roleLoading || profileLoading) return;

    if (!user) {
      navigate('/auth');
      return;
    }

    // If user already has a role and username, redirect to appropriate dashboard
    if (existingRole && profile?.username) {
      if (existingRole.role === 'admin') {
        navigate('/admin');
      } else if (existingRole.role === 'retail_trader') {
        navigate('/trader-dashboard');
      } else {
        navigate('/dashboard');
      }
    }
  }, [user, existingRole, profile, authLoading, roleLoading, profileLoading, navigate]);

  // Check username availability
  const checkUsername = async (usernameToCheck: string) => {
    if (!usernameToCheck || usernameToCheck.length < 3) {
      setUsernameError('Username must be at least 3 characters');
      return false;
    }
    
    if (!/^[a-zA-Z0-9_]+$/.test(usernameToCheck)) {
      setUsernameError('Username can only contain letters, numbers, and underscores');
      return false;
    }

    setIsCheckingUsername(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', usernameToCheck.toLowerCase())
        .neq('id', user?.id || '')
        .maybeSingle();
      
      if (error) throw error;
      
      if (data) {
        setUsernameError('Username is already taken');
        return false;
      }
      
      setUsernameError('');
      return true;
    } catch (error) {
      console.error('Error checking username:', error);
      setUsernameError('Error checking username availability');
      return false;
    } finally {
      setIsCheckingUsername(false);
    }
  };

  const handleUsernameSubmit = async () => {
    const isValid = await checkUsername(username);
    if (!isValid) return;
    
    try {
      await updateProfile.mutateAsync({
        username: username.toLowerCase(),
        display_name: displayName || username,
      });
      setStep('role');
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleRoleSubmit = async () => {
    if (!selectedRole) {
      toast({ title: 'Select a role', description: 'Please choose how you want to use Cluster', variant: 'destructive' });
      return;
    }

    try {
      await setUserRole.mutateAsync(selectedRole);
      setStep('social');
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleSocialSubmit = async () => {
    try {
      await updateProfile.mutateAsync({
        twitter_handle: socialLinks.twitter_handle || null,
        linkedin_url: socialLinks.linkedin_url || null,
        github_handle: socialLinks.github_handle || null,
        website_url: socialLinks.website_url || null,
      });
      toast({ title: 'Welcome!', description: `You're all set up!` });
      // Redirect based on role
      if (selectedRole === 'retail_trader') {
        navigate('/trader-dashboard');
      } else {
        navigate('/dashboard');
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleSkipSocial = () => {
    toast({ title: 'Welcome!', description: `You're all set up!` });
    if (selectedRole === 'retail_trader') {
      navigate('/trader-dashboard');
    } else {
      navigate('/dashboard');
    }
  };

  if (authLoading || roleLoading || profileLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="container flex items-center h-16">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">Cluster</span>
          </div>
        </div>
      </header>

      <main className="container py-12">
        {/* Progress indicator */}
        <div className="max-w-md mx-auto mb-8">
          <div className="flex items-center justify-center gap-2">
            <div className={`w-3 h-3 rounded-full ${step === 'username' ? 'bg-primary' : 'bg-primary/30'}`} />
            <div className={`w-12 h-0.5 ${step !== 'username' ? 'bg-primary' : 'bg-muted'}`} />
            <div className={`w-3 h-3 rounded-full ${step === 'role' ? 'bg-primary' : step === 'social' ? 'bg-primary/30' : 'bg-muted'}`} />
            <div className={`w-12 h-0.5 ${step === 'social' ? 'bg-primary' : 'bg-muted'}`} />
            <div className={`w-3 h-3 rounded-full ${step === 'social' ? 'bg-primary' : 'bg-muted'}`} />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground mt-2 px-2">
            <span>Username</span>
            <span>Role</span>
            <span>Social</span>
          </div>
        </div>

        {/* Step 1: Username */}
        {step === 'username' && (
          <div className="max-w-md mx-auto">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold mb-2">Create your username</h1>
              <p className="text-muted-foreground">
                Choose a unique username for your Cluster profile
              </p>
            </div>

            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="displayName">Display Name</Label>
                  <Input
                    id="displayName"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Your name"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">@</span>
                    <Input
                      id="username"
                      value={username}
                      onChange={(e) => {
                        setUsername(e.target.value.replace(/\s/g, ''));
                        setUsernameError('');
                      }}
                      onBlur={() => username && checkUsername(username)}
                      placeholder="username"
                      className="pl-8"
                    />
                  </div>
                  {usernameError && (
                    <p className="text-sm text-destructive">{usernameError}</p>
                  )}
                  {!usernameError && username.length >= 3 && !isCheckingUsername && (
                    <p className="text-sm text-green-600">Username is available!</p>
                  )}
                </div>

                <Button 
                  className="w-full"
                  onClick={handleUsernameSubmit}
                  disabled={!username || username.length < 3 || !!usernameError || isCheckingUsername || updateProfile.isPending}
                >
                  {updateProfile.isPending ? 'Saving...' : 'Continue'}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Step 2: Role Selection */}
        {step === 'role' && (
          <>
            <div className="max-w-3xl mx-auto text-center mb-8">
              <h1 className="text-3xl font-bold mb-2">Welcome, @{username}!</h1>
              <p className="text-xl text-muted-foreground">
                Choose how you want to use the platform
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto mb-8">
              <Card 
                className={`cursor-pointer transition-all ${
                  selectedRole === 'developer' 
                    ? 'border-primary ring-2 ring-primary ring-offset-2' 
                    : 'hover:border-primary/50'
                }`}
                onClick={() => setSelectedRole('developer')}
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                      <Code className="h-6 w-6 text-primary" />
                    </div>
                    {selectedRole === 'developer' && (
                      <CheckCircle className="h-6 w-6 text-primary" />
                    )}
                  </div>
                  <CardTitle className="mt-4">Developer / Quant</CardTitle>
                  <CardDescription>
                    Build and monetize AI trading models
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                      Create trading strategies (code or no-code)
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                      Run backtests with professional metrics
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                      Publish models and earn performance fees
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                      Build your following and reputation
                    </li>
                  </ul>
                </CardContent>
              </Card>

              <Card 
                className={`cursor-pointer transition-all ${
                  selectedRole === 'retail_trader' 
                    ? 'border-primary ring-2 ring-primary ring-offset-2' 
                    : 'hover:border-primary/50'
                }`}
                onClick={() => setSelectedRole('retail_trader')}
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                      <LineChart className="h-6 w-6 text-primary" />
                    </div>
                    {selectedRole === 'retail_trader' && (
                      <CheckCircle className="h-6 w-6 text-primary" />
                    )}
                  </div>
                  <CardTitle className="mt-4">Retail Trader</CardTitle>
                  <CardDescription>
                    Subscribe to proven trading strategies
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                      Discover top-performing models
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                      Subscribe to strategies you trust
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                      Follow developers and get updates
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                      Track your portfolio performance
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </div>

            <div className="text-center">
              <Button 
                size="lg" 
                onClick={handleRoleSubmit}
                disabled={!selectedRole || setUserRole.isPending}
                className="min-w-[200px]"
              >
                {setUserRole.isPending ? 'Setting up...' : 'Continue'}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </>
        )}

        {/* Step 3: Social Links (Optional) */}
        {step === 'social' && (
          <div className="max-w-md mx-auto">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold mb-2">Connect your socials</h1>
              <p className="text-muted-foreground">
                Add your social media links to help others find you
              </p>
            </div>

            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="twitter" className="flex items-center gap-2">
                    <Twitter className="h-4 w-4" /> Twitter / X
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">@</span>
                    <Input
                      id="twitter"
                      value={socialLinks.twitter_handle}
                      onChange={(e) => setSocialLinks(prev => ({ ...prev, twitter_handle: e.target.value }))}
                      placeholder="username"
                      className="pl-8"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="github" className="flex items-center gap-2">
                    <Github className="h-4 w-4" /> GitHub
                  </Label>
                  <Input
                    id="github"
                    value={socialLinks.github_handle}
                    onChange={(e) => setSocialLinks(prev => ({ ...prev, github_handle: e.target.value }))}
                    placeholder="username"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="linkedin" className="flex items-center gap-2">
                    <Linkedin className="h-4 w-4" /> LinkedIn
                  </Label>
                  <Input
                    id="linkedin"
                    value={socialLinks.linkedin_url}
                    onChange={(e) => setSocialLinks(prev => ({ ...prev, linkedin_url: e.target.value }))}
                    placeholder="linkedin.com/in/username"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="website" className="flex items-center gap-2">
                    <Globe className="h-4 w-4" /> Website
                  </Label>
                  <Input
                    id="website"
                    value={socialLinks.website_url}
                    onChange={(e) => setSocialLinks(prev => ({ ...prev, website_url: e.target.value }))}
                    placeholder="yourwebsite.com"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <Button 
                    variant="outline"
                    className="flex-1"
                    onClick={handleSkipSocial}
                  >
                    Skip for now
                  </Button>
                  <Button 
                    className="flex-1"
                    onClick={handleSocialSubmit}
                    disabled={updateProfile.isPending}
                  >
                    {updateProfile.isPending ? 'Saving...' : 'Finish'}
                    <CheckCircle className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}