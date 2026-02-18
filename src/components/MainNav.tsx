import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useIsAlpha } from '@/hooks/useAlpha';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { LineChart, LogOut, Briefcase, ClipboardList, Settings, Users, User, Shield, Menu, X } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';

export function MainNav() {
  const { user, signOut } = useAuth();
  const { data: profile } = useProfile();
  const { data: isAlpha } = useIsAlpha();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleSignOut = async () => {
    queryClient.clear();
    await signOut();
    navigate('/auth?signout=true', { replace: true });
  };

  const isActive = (path: string) => location.pathname === path;

  const navLinks = [
    { label: 'Trade', icon: LineChart, path: '/trade', match: (p: string) => p.startsWith('/trade') },
    { label: 'Portfolio', icon: Briefcase, path: '/trade/portfolio', match: (p: string) => p === '/trade/portfolio' },
    { label: 'Orders', icon: ClipboardList, path: '/trade/orders', match: (p: string) => p === '/trade/orders' },
    { label: 'Community', icon: Users, path: '/community', match: (p: string) => p === '/community' },
    { label: 'Settings', icon: Settings, path: '/settings/brokerage', match: (p: string) => p === '/settings/brokerage' },
  ];

  const handleMobileNav = (path: string) => {
    navigate(path);
    setMobileOpen(false);
  };

  return (
    <header className="border-b border-border sticky top-0 bg-background z-50">
      <div className="container flex items-center justify-between h-16">
        <div className="flex items-center gap-4 md:gap-8">
          {/* Mobile hamburger */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0">
              <div className="flex items-center gap-2 p-4 border-b border-border">
                <img src="/favicon.png" alt="Cluster" className="h-7 w-7" />
                <span className="text-xl font-bold">Cluster</span>
              </div>

              {/* User info in mobile drawer */}
              {user && (
                <div className="p-4 border-b border-border">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={profile?.avatar_url || undefined} />
                      <AvatarFallback>
                        {profile?.display_name?.[0] || profile?.username?.[0] || '?'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm">{profile?.display_name || profile?.username || 'User'}</p>
                        {isAlpha && (
                          <Badge className="text-xs py-0 px-1.5 bg-primary/20 text-primary border border-primary/30">Alpha</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Mobile nav links */}
              <nav className="flex flex-col p-2 gap-1">
                {navLinks.map(({ label, icon: Icon, path, match }) => (
                  <button
                    key={path}
                    onClick={() => handleMobileNav(path)}
                    className={`flex items-center gap-3 px-3 py-3 rounded-md text-sm font-medium transition-colors w-full text-left
                      ${match(location.pathname)
                        ? 'bg-secondary text-secondary-foreground'
                        : 'text-foreground hover:bg-muted'
                      }`}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </button>
                ))}

                {isAlpha && (
                  <button
                    onClick={() => handleMobileNav('/alpha')}
                    className={`flex items-center gap-3 px-3 py-3 rounded-md text-sm font-medium transition-colors w-full text-left
                      ${isActive('/alpha') ? 'bg-secondary text-secondary-foreground' : 'text-foreground hover:bg-muted'}`}
                  >
                    <Shield className="h-4 w-4 text-primary" />
                    Alpha Control
                  </button>
                )}
              </nav>

              <Separator />

              <div className="p-2">
                <button
                  onClick={() => { handleMobileNav('/profile'); }}
                  className="flex items-center gap-3 px-3 py-3 rounded-md text-sm font-medium transition-colors w-full text-left text-foreground hover:bg-muted"
                >
                  <User className="h-4 w-4" />
                  Profile
                </button>
                {user && (
                  <button
                    onClick={() => { setMobileOpen(false); handleSignOut(); }}
                    className="flex items-center gap-3 px-3 py-3 rounded-md text-sm font-medium transition-colors w-full text-left text-destructive hover:bg-muted"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </button>
                )}
              </div>
            </SheetContent>
          </Sheet>

          <div 
            className="flex items-center gap-2 cursor-pointer" 
            onClick={() => navigate('/trade')}
          >
            <img src="/favicon.png" alt="Cluster" className="h-7 w-7" />
            <span className="text-xl font-bold">Cluster</span>
          </div>

          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map(({ label, icon: Icon, path, match }) => (
              <Button
                key={path}
                variant={match(location.pathname) ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => navigate(path)}
              >
                <Icon className="mr-2 h-4 w-4" />
                {label}
              </Button>
            ))}
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
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{profile?.display_name || profile?.username || 'User'}</p>
                      {isAlpha && (
                        <Badge className="text-xs py-0 px-1.5 bg-primary/20 text-primary border border-primary/30">
                          Alpha
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/profile')}>
                  <User className="mr-2 h-4 w-4" />
                  Profile
                </DropdownMenuItem>
                {isAlpha && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => navigate('/alpha')}>
                      <Shield className="mr-2 h-4 w-4 text-primary" />
                      Alpha Control
                    </DropdownMenuItem>
                  </>
                )}
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

