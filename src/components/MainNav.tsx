import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { LineChart, LogOut, Briefcase, ClipboardList, Settings, Users, User } from 'lucide-react';
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
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSignOut = async () => {
    queryClient.clear();
    await signOut();
    navigate('/auth?signout=true', { replace: true });
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <header className="border-b border-border sticky top-0 bg-background z-50">
      <div className="container flex items-center justify-between h-16">
        <div className="flex items-center gap-8">
          <div 
            className="flex items-center gap-2 cursor-pointer" 
            onClick={() => navigate('/trade')}
          >
            <img src="/favicon.png" alt="Cluster" className="h-7 w-7" />
            <span className="text-xl font-bold">Cluster</span>
          </div>

          <nav className="hidden md:flex items-center gap-1">
            <Button 
              variant={location.pathname.startsWith('/trade') ? 'secondary' : 'ghost'} 
              size="sm"
              onClick={() => navigate('/trade')}
            >
              <LineChart className="mr-2 h-4 w-4" />
              Trade
            </Button>
            <Button 
              variant={isActive('/trade/portfolio') ? 'secondary' : 'ghost'} 
              size="sm"
              onClick={() => navigate('/trade/portfolio')}
            >
              <Briefcase className="mr-2 h-4 w-4" />
              Portfolio
            </Button>
            <Button 
              variant={isActive('/trade/orders') ? 'secondary' : 'ghost'} 
              size="sm"
              onClick={() => navigate('/trade/orders')}
            >
              <ClipboardList className="mr-2 h-4 w-4" />
              Orders
            </Button>
            <Button 
              variant={isActive('/community') ? 'secondary' : 'ghost'} 
              size="sm"
              onClick={() => navigate('/community')}
            >
              <Users className="mr-2 h-4 w-4" />
              Community
            </Button>
            <Button 
              variant={isActive('/settings/brokerage') ? 'secondary' : 'ghost'} 
              size="sm"
              onClick={() => navigate('/settings/brokerage')}
            >
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </Button>
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
                    <p className="font-medium">{profile?.display_name || profile?.username || 'User'}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/profile')}>
                  <User className="mr-2 h-4 w-4" />
                  Profile
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button onClick={() => navigate('/auth')}>Sign In</Button>
          )}
        </div>
      </div>
    </header>
  );
}
