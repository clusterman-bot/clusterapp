import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useUserRole } from '@/hooks/useUserRole';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  TrendingUp, Home, Compass, MessageSquare, 
  LayoutDashboard, LogOut, User 
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function MainNav() {
  const { user, signOut } = useAuth();
  const { data: profile } = useProfile();
  const { data: userRole } = useUserRole();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const isActive = (path: string) => location.pathname === path;

  // Determine dashboard path based on role
  const getDashboardPath = () => {
    if (userRole?.role === 'admin') return '/admin';
    if (userRole?.role === 'retail_trader') return '/trader-dashboard';
    return '/dashboard';
  };

  const dashboardPath = getDashboardPath();

  return (
    <header className="border-b border-border sticky top-0 bg-background z-50">
      <div className="container flex items-center justify-between h-16">
        <div className="flex items-center gap-8">
          <div 
            className="flex items-center gap-2 cursor-pointer" 
            onClick={() => navigate('/')}
          >
            <TrendingUp className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">Cluster</span>
          </div>

          <nav className="hidden md:flex items-center gap-1">
            <Button 
              variant={isActive('/') ? 'secondary' : 'ghost'} 
              size="sm"
              onClick={() => navigate('/')}
            >
              <Home className="mr-2 h-4 w-4" />
              Home
            </Button>
            <Button 
              variant={isActive('/explore') ? 'secondary' : 'ghost'} 
              size="sm"
              onClick={() => navigate('/explore')}
            >
              <Compass className="mr-2 h-4 w-4" />
              Explore
            </Button>
            <Button 
              variant={isActive('/feed') ? 'secondary' : 'ghost'} 
              size="sm"
              onClick={() => navigate('/feed')}
            >
              <MessageSquare className="mr-2 h-4 w-4" />
              Feed
            </Button>
            {user && (
              <Button 
                variant={location.pathname === dashboardPath ? 'secondary' : 'ghost'} 
                size="sm"
                onClick={() => navigate(dashboardPath)}
              >
                <LayoutDashboard className="mr-2 h-4 w-4" />
                Dashboard
              </Button>
            )}
          </nav>
        </div>

        <div className="flex items-center gap-4">
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={profile?.avatar_url || undefined} />
                    <AvatarFallback>
                      {profile?.display_name?.[0] || profile?.username?.[0] || '?'}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56 bg-popover" align="end">
                <div className="flex items-center justify-start gap-2 p-2">
                  <div className="flex flex-col space-y-1 leading-none">
                    <p className="font-medium">{profile?.display_name || profile?.username}</p>
                    <p className="text-xs text-muted-foreground">@{profile?.username}</p>
                  </div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/profile')}>
                  <User className="mr-2 h-4 w-4" />
                  Profile
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate(dashboardPath)}>
                  <LayoutDashboard className="mr-2 h-4 w-4" />
                  Dashboard
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button onClick={() => navigate('/auth')}>Get Started</Button>
          )}
        </div>
      </div>
    </header>
  );
}
