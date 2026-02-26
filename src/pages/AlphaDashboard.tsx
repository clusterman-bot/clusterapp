import { useState } from 'react';
import { SystemBotsTab } from '@/components/alpha/SystemBotsTab';
import { FeedbackTab } from '@/components/alpha/FeedbackTab';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useIsAlpha, useAllUsersForAlpha, useMuteUser, useFreezeTrading, usePlatformSettings, useUpdatePlatformSetting, useSetRoleForUser } from '@/hooks/useAlpha';
import { useMarketingBotConfig, useMarketingBotLogs, useSaveMarketingBotConfig, useTriggerMarketingBot } from '@/hooks/useMarketingBot';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Shield, Search, VolumeX, Volume2, TrendingDown,
  Lock, Unlock, UserX, Users, MessageSquareOff, MessageSquare,
  ArrowLeft, AlertTriangle, CheckCircle, UserCog, Instagram,
  Bot, Play, Save, Clock, Calendar, CheckCircle2, XCircle, RefreshCw,
  MessageSquarePlus,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { formatDistanceToNow } from 'date-fns';

function ExpandableError({ message }: { message: string }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = message.length > 80;

  return (
    <div className="break-words whitespace-pre-wrap">
      <span>{expanded || !isLong ? message : `${message.slice(0, 80)}…`}</span>
      {isLong && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="ml-1 text-muted-foreground hover:text-foreground underline text-[10px]"
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  );
}

const CAPTURABLE_PAGES = [
  { path: '/', label: 'Landing Page' },
  { path: '/trade', label: 'Trade Dashboard' },
  { path: '/community', label: 'Community Feed' },
  { path: '/trade/portfolio', label: 'Portfolio' },
  { path: '/trade/orders', label: 'Orders' },
  { path: '/explore', label: 'Explore' },
];

function MarketingBotTab() {
  const { toast } = useToast();
  const { data: config, isLoading: configLoading } = useMarketingBotConfig();
  const { data: logs, isLoading: logsLoading } = useMarketingBotLogs();
  const saveConfig = useSaveMarketingBotConfig();
  const triggerBot = useTriggerMarketingBot();

  const [isActive, setIsActive] = useState(false);
  const [intervalHours, setIntervalHours] = useState(24);
  const [selectedPages, setSelectedPages] = useState<string[]>(['/trade', '/community']);
  const [stockTickers, setStockTickers] = useState<string[]>([]);
  const [tickerInput, setTickerInput] = useState('');
  const [igAccountId, setIgAccountId] = useState('');
  const [igToken, setIgToken] = useState('');
  const [captionTemplate, setCaptionTemplate] = useState('');
  const [initialized, setInitialized] = useState(false);

  // Initialize form from config once loaded
  if (config && !initialized) {
    setIsActive(config.is_active);
    setIntervalHours(config.interval_hours);
    const savedPages = Array.isArray(config.pages_to_capture) ? config.pages_to_capture as string[] : ['/trade', '/community'];
    // Separate stock pages from regular pages
    const stockPages = savedPages.filter((p) => p.startsWith('/trade/stocks/'));
    const regularPages = savedPages.filter((p) => !p.startsWith('/trade/stocks/'));
    setSelectedPages(regularPages);
    setStockTickers(stockPages.map((p) => p.replace('/trade/stocks/', '').toUpperCase()));
    setIgAccountId(config.instagram_account_id || '');
    setCaptionTemplate(config.caption_template || '');
    setInitialized(true);
  }

  const togglePage = (path: string) => {
    setSelectedPages((prev) =>
      prev.includes(path) ? prev.filter((p) => p !== path) : [...prev, path]
    );
  };

  const addTicker = () => {
    const ticker = tickerInput.trim().toUpperCase();
    if (ticker && !stockTickers.includes(ticker)) {
      setStockTickers((prev) => [...prev, ticker]);
    }
    setTickerInput('');
  };

  const removeTicker = (ticker: string) => {
    setStockTickers((prev) => prev.filter((t) => t !== ticker));
  };

  // Combine regular pages + stock ticker pages
  const allPagesToCapture = [
    ...selectedPages,
    ...stockTickers.map((t) => `/trade/stocks/${t}`),
  ];

  const handleSave = async () => {
    if (allPagesToCapture.length === 0) {
      toast({ title: 'No pages selected', description: 'Select at least one page or stock to capture.', variant: 'destructive' });
      return;
    }
    try {
      await saveConfig.mutateAsync({
        is_active: isActive,
        interval_hours: Math.max(1, Math.min(168, intervalHours)),
        pages_to_capture: allPagesToCapture,
        instagram_account_id: igAccountId,
        ig_access_token_plaintext: igToken || undefined,
        caption_template: captionTemplate,
      });
      setIgToken('');
      toast({ title: 'Settings saved', description: 'Marketing bot configuration updated.' });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  const handlePostNow = async () => {
    if (!config?.id) {
      toast({ title: 'Save settings first', description: 'Please save your configuration before posting.', variant: 'destructive' });
      return;
    }
    try {
      toast({ title: 'Posting…', description: 'Taking screenshots and posting to Instagram. This may take 30–60 seconds.' });
      await triggerBot.mutateAsync(config.id);
      toast({ title: 'Posted!', description: 'Successfully posted to Instagram.' });
    } catch (e: any) {
      toast({ title: 'Post failed', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Status card */}
      {config && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Bot Status</CardTitle>
              <Badge className={config.is_active ? 'bg-primary/20 text-primary border-primary/30' : 'bg-muted text-muted-foreground'}>
                {config.is_active ? '● Active' : '○ Paused'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="h-4 w-4 shrink-0" />
                <span>Last posted: {config.last_posted_at
                  ? formatDistanceToNow(new Date(config.last_posted_at), { addSuffix: true })
                  : 'Never'}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="h-4 w-4 shrink-0" />
                <span>Next post: {config.next_post_at
                  ? formatDistanceToNow(new Date(config.next_post_at), { addSuffix: true })
                  : 'Not scheduled'}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Config card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Instagram className="h-5 w-5" />
            Bot Configuration
          </CardTitle>
          <CardDescription>
            Configure your automated Instagram marketing bot. Screenshots are posted as carousels.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {configLoading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : (
            <>
              {/* Master toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <Label className="font-medium">Automatic Posting</Label>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {isActive
                      ? `Bot will auto-post every ${intervalHours}h. You can also post manually anytime.`
                      : 'Disabled — use "Post Now" to post manually.'}
                  </p>
                </div>
                <Switch checked={isActive} onCheckedChange={setIsActive} />
              </div>

              {/* Interval — only visible when auto-posting is on */}
              {isActive && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <Label>Post every N hours</Label>
                    <div className="flex items-center gap-3">
                      <Input
                        type="number"
                        min={1}
                        max={168}
                        value={intervalHours}
                        onChange={(e) => setIntervalHours(Number(e.target.value))}
                        className="w-28"
                      />
                      <span className="text-sm text-muted-foreground">hours (1–168)</span>
                    </div>
                  </div>
                </>
              )}

              <Separator />

              {/* Pages */}
              <div className="space-y-3">
                <Label>Pages to capture</Label>
                <div className="grid grid-cols-2 gap-2">
                  {CAPTURABLE_PAGES.map(({ path, label }) => (
                    <div key={path} className="flex items-center gap-2">
                      <Checkbox
                        id={`page-${path}`}
                        checked={selectedPages.includes(path)}
                        onCheckedChange={() => togglePage(path)}
                      />
                      <label htmlFor={`page-${path}`} className="text-sm cursor-pointer select-none">
                        {label}
                        <span className="block text-xs text-muted-foreground">{path}</span>
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Stock tickers */}
              <div className="space-y-3">
                <Label>Stock pages to capture</Label>
                <p className="text-xs text-muted-foreground">
                  Add stock symbols to screenshot their detail pages (e.g. AAPL, TSLA)
                </p>
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="e.g. AAPL"
                    value={tickerInput}
                    onChange={(e) => setTickerInput(e.target.value.toUpperCase())}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTicker(); } }}
                    className="w-36"
                  />
                  <Button type="button" variant="outline" size="sm" onClick={addTicker} disabled={!tickerInput.trim()}>
                    Add
                  </Button>
                </div>
                {stockTickers.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {stockTickers.map((ticker) => (
                      <Badge key={ticker} variant="secondary" className="gap-1 pl-2 pr-1 py-1">
                        {ticker}
                        <button
                          onClick={() => removeTicker(ticker)}
                          className="ml-1 hover:text-destructive rounded-full"
                        >
                          <XCircle className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <Separator />

              {/* Instagram credentials */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="ig-account-id">Instagram Business Account ID</Label>
                  <Input
                    id="ig-account-id"
                    placeholder="e.g. 17841400123456789"
                    value={igAccountId}
                    onChange={(e) => setIgAccountId(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Found via Graph API: GET /&#123;page-id&#125;?fields=instagram_business_account
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ig-token">Instagram Long-Lived Access Token</Label>
                  <Input
                    id="ig-token"
                    type="password"
                    placeholder={config?.ig_access_token_encrypted ? '●●●●●●●● (saved — paste to update)' : 'Paste your 60-day token…'}
                    value={igToken}
                    onChange={(e) => setIgToken(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Stored encrypted. Requires scopes: instagram_basic, instagram_content_publish
                  </p>
                </div>
              </div>

              <Separator />

              {/* Caption template */}
              <div className="space-y-2">
                <Label htmlFor="caption-template">Caption prefix (optional)</Label>
                <Textarea
                  id="caption-template"
                  placeholder="e.g. 🚀 Check out our latest AI trading signals! AI will append hashtags."
                  value={captionTemplate}
                  onChange={(e) => setCaptionTemplate(e.target.value)}
                  className="min-h-[80px]"
                />
              </div>

              {/* Setup instructions */}
              <div className="p-4 bg-muted/50 rounded-lg border text-sm space-y-1">
                <p className="font-medium">Setup checklist</p>
                <p className="text-muted-foreground">1. Sign up at <a href="https://browserless.io" target="_blank" rel="noreferrer" className="text-primary underline">browserless.io</a> — add your key as <code className="bg-muted px-1 rounded">BROWSERLESS_API_KEY</code> secret ✓</p>
                <p className="text-muted-foreground">2. Create a Meta Business app → add Instagram Graph API product</p>
                <p className="text-muted-foreground">3. Generate a long-lived token with scopes: <code className="bg-muted px-1 rounded">instagram_basic, instagram_content_publish</code></p>
                <p className="text-muted-foreground">4. Paste your Business Account ID + token above and save</p>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <Button onClick={handleSave} disabled={saveConfig.isPending} className="gap-2">
                  <Save className="h-4 w-4" />
                  {saveConfig.isPending ? 'Saving…' : 'Save Settings'}
                </Button>
                <Button
                  variant="outline"
                  onClick={handlePostNow}
                  disabled={triggerBot.isPending || !config?.id}
                  className="gap-2"
                >
                  {triggerBot.isPending ? (
                    <><RefreshCw className="h-4 w-4 animate-spin" /> Posting…</>
                  ) : (
                    <><Play className="h-4 w-4" /> Post Now</>
                  )}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Logs */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Bot className="h-4 w-4" />
              Post History
            </CardTitle>
            <span className="text-xs text-muted-foreground">Auto-refreshes every 30s</span>
          </div>
        </CardHeader>
        <CardContent>
          {logsLoading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : !logs || logs.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <Bot className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No posts yet — use "Post Now" or wait for the scheduler</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Pages</TableHead>
                  <TableHead>Post ID</TableHead>
                  <TableHead>Error</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                    </TableCell>
                    <TableCell>
                      {log.status === 'success' ? (
                        <span className="flex items-center gap-1 text-primary text-xs">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Success
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-destructive text-xs">
                          <XCircle className="h-3.5 w-3.5" /> Error
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      {(Array.isArray(log.pages_captured) ? log.pages_captured : []).join(', ') || '—'}
                    </TableCell>
                    <TableCell className="text-xs font-mono">
                      {log.instagram_post_id
                        ? <a href={`https://www.instagram.com/p/${log.instagram_post_id}/`} target="_blank" rel="noreferrer" className="text-primary underline">{log.instagram_post_id.slice(0, 12)}…</a>
                        : '—'}
                    </TableCell>
                    <TableCell className="text-xs text-destructive max-w-[300px]">
                      {log.error_message ? (
                        <ExpandableError message={log.error_message} />
                      ) : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function AlphaDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: isAlpha, isLoading: alphaLoading } = useIsAlpha();
  const { data: users, isLoading: usersLoading } = useAllUsersForAlpha();
  const { data: settings, isLoading: settingsLoading } = usePlatformSettings();
  const muteUser = useMuteUser();
  const freezeTrading = useFreezeTrading();
  const updateSetting = useUpdatePlatformSetting();
  const setRoleForUser = useSetRoleForUser();
  const [searchQuery, setSearchQuery] = useState('');
  const [pendingRoleChange, setPendingRoleChange] = useState<{ userId: string; username: string; newRole: string } | null>(null);

  if (alphaLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!user || !isAlpha) {
    navigate('/trade');
    return null;
  }

  const handleMuteUser = async (userId: string, currentlyMuted: boolean) => {
    try {
      await muteUser.mutateAsync({ userId, muted: !currentlyMuted });
      toast({
        title: currentlyMuted ? 'User unmuted' : 'User muted',
        description: currentlyMuted ? 'User can now post in the community.' : 'User is now muted from the community.',
      });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleFreezeTrading = async (userId: string, currentlyFrozen: boolean) => {
    try {
      await freezeTrading.mutateAsync({ userId, frozen: !currentlyFrozen });
      toast({
        title: currentlyFrozen ? 'Trading unfrozen' : 'Trading frozen',
        description: currentlyFrozen ? 'User can now trade.' : 'User trading capabilities are frozen.',
      });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleUpdateSetting = async (key: string, value: boolean) => {
    try {
      await updateSetting.mutateAsync({ key, value });
      toast({
        title: 'Platform setting updated',
        description: `${key === 'community_muted' ? 'Community chat' : 'Onboarding'} is now ${value ? 'disabled' : 'enabled'}.`,
      });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleConfirmRoleChange = async () => {
    if (!pendingRoleChange) return;
    try {
      await setRoleForUser.mutateAsync({ userId: pendingRoleChange.userId, role: pendingRoleChange.newRole });
      toast({
        title: 'Role updated',
        description: `@${pendingRoleChange.username} is now ${pendingRoleChange.newRole.replace('_', ' ')}.`,
      });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setPendingRoleChange(null);
    }
  };

  const filteredUsers = (users as any[] | undefined)?.filter((u) =>
    u.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.display_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const mutedCount = (users as any[] | undefined)?.filter((u) => u.is_muted).length || 0;
  const frozenCount = (users as any[] | undefined)?.filter((u) => u.trading_frozen).length || 0;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border sticky top-0 bg-background z-50">
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate('/trade')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <div className="flex items-center gap-2">
              <Shield className="h-6 w-6 text-primary" />
              <span className="text-xl font-bold">Alpha Control</span>
              <Badge className="ml-1 bg-primary/20 text-primary border border-primary/30">
                Alpha
              </Badge>
            </div>
          </div>
        </div>
      </header>

      <main className="container py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Alpha Dashboard</h1>
          <p className="text-muted-foreground">Platform-wide moderation and control</p>
        </div>

        {/* Stats row */}
        <div className="grid gap-4 md:grid-cols-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{usersLoading ? '...' : (users as any[])?.length || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Muted Users</CardTitle>
              <VolumeX className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{usersLoading ? '...' : mutedCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Trading Frozen</CardTitle>
              <Lock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{usersLoading ? '...' : frozenCount}</div>
            </CardContent>
          </Card>
          <Card className={settings?.community_muted || settings?.onboarding_frozen ? 'border-destructive/50' : ''}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Platform Status</CardTitle>
              {settings?.community_muted || settings?.onboarding_frozen
                ? <AlertTriangle className="h-4 w-4 text-destructive" />
                : <CheckCircle className="h-4 w-4 text-primary" />
              }
            </CardHeader>
            <CardContent>
              <div className="text-sm font-medium">
                {settings?.community_muted && settings?.onboarding_frozen
                  ? 'Chat + Onboard locked'
                  : settings?.community_muted
                  ? 'Community muted'
                  : settings?.onboarding_frozen
                  ? 'Onboarding frozen'
                  : 'All systems normal'}
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="users">
          <TabsList>
            <TabsTrigger value="users">User Moderation</TabsTrigger>
            <TabsTrigger value="platform">Platform Controls</TabsTrigger>
            <TabsTrigger value="system-bots">
              <Bot className="h-3.5 w-3.5 mr-1.5" />
              System Bots
            </TabsTrigger>
            <TabsTrigger value="marketing-bot">
              <Instagram className="h-3.5 w-3.5 mr-1.5" />
              Marketing Bot
            </TabsTrigger>
            <TabsTrigger value="feedback">
              <MessageSquarePlus className="h-3.5 w-3.5 mr-1.5" />
              Feedback
            </TabsTrigger>
          </TabsList>

          {/* User Moderation */}
          <TabsContent value="users">
            <Card>
              <CardHeader>
                <CardTitle>User Moderation</CardTitle>
                <CardDescription>
                  Mute users from posting, or freeze their trading capabilities
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search users..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>

                {usersLoading ? (
                  <div className="space-y-3">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="flex items-center gap-4 p-4 border rounded-lg">
                        <Skeleton className="h-10 w-10 rounded-full" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-3 w-24" />
                        </div>
                        <Skeleton className="h-9 w-24" />
                        <Skeleton className="h-9 w-28" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredUsers?.map((u: any) => (
                      <div
                        key={u.id}
                        className={`flex items-center justify-between p-4 border rounded-lg transition-colors ${
                          u.is_muted || u.trading_frozen ? 'bg-muted/30 border-muted' : ''
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={u.avatar_url || undefined} />
                            <AvatarFallback>
                              {u.display_name?.[0] || u.username?.[0] || '?'}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-sm">
                                {u.display_name || u.username || 'Unknown'}
                              </p>
                              {u.role && (
                                <Badge variant="outline" className="text-xs py-0">
                                  {u.role.replace('_', ' ')}
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">@{u.username}</p>
                          </div>
                          <div className="flex gap-1 ml-2">
                            {u.is_muted && (
                              <Badge variant="secondary" className="text-xs gap-1">
                                <VolumeX className="h-3 w-3" />
                                Muted
                              </Badge>
                            )}
                            {u.trading_frozen && (
                              <Badge variant="destructive" className="text-xs gap-1 bg-destructive/20 text-destructive border-destructive/30">
                                <Lock className="h-3 w-3" />
                                Frozen
                              </Badge>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap justify-end">
                          {/* Role selector */}
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center gap-1">
                                  <UserCog className="h-4 w-4 text-muted-foreground shrink-0" />
                                  <Select
                                    value={u.role || ''}
                                    onValueChange={(newRole) => {
                                      if (u.id === user.id) return;
                                      setPendingRoleChange({ userId: u.id, username: u.username, newRole });
                                    }}
                                    disabled={u.id === user.id || setRoleForUser.isPending}
                                  >
                                    <SelectTrigger className="w-36 h-8 text-xs">
                                      <SelectValue placeholder="Assign role..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="retail_trader">Retail Trader</SelectItem>
                                      <SelectItem value="developer">Developer</SelectItem>
                                      <SelectItem value="admin">Admin</SelectItem>
                                      <SelectItem value="alpha">Alpha</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              </TooltipTrigger>
                              {u.id === user.id && (
                                <TooltipContent>Cannot change your own role</TooltipContent>
                              )}
                            </Tooltip>
                          </TooltipProvider>

                          {/* Mute toggle */}
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant={u.is_muted ? 'default' : 'outline'}
                                size="sm"
                                className="gap-1.5"
                                disabled={muteUser.isPending}
                              >
                                {u.is_muted ? (
                                  <><Volume2 className="h-3.5 w-3.5" /> Unmute</>
                                ) : (
                                  <><VolumeX className="h-3.5 w-3.5" /> Mute</>
                                )}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  {u.is_muted ? 'Unmute' : 'Mute'} @{u.username}?
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  {u.is_muted
                                    ? 'This will restore their ability to post in the community.'
                                    : 'This will prevent them from posting or commenting in the community.'}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleMuteUser(u.id, u.is_muted)}>
                                  Confirm
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>

                          {/* Freeze trading toggle */}
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant={u.trading_frozen ? 'default' : 'outline'}
                                size="sm"
                                className={`gap-1.5 ${u.trading_frozen ? '' : 'border-destructive/40 text-destructive hover:bg-destructive/10'}`}
                                disabled={freezeTrading.isPending}
                              >
                                {u.trading_frozen ? (
                                  <><Unlock className="h-3.5 w-3.5" /> Unfreeze</>
                                ) : (
                                  <><TrendingDown className="h-3.5 w-3.5" /> Freeze Trading</>
                                )}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  {u.trading_frozen ? 'Unfreeze' : 'Freeze'} trading for @{u.username}?
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  {u.trading_frozen
                                    ? 'This will restore their ability to place trades on the platform.'
                                    : 'This will block them from placing any buy or sell orders.'}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleFreezeTrading(u.id, u.trading_frozen)}>
                                  Confirm
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    ))}

                    {/* Global role change confirmation dialog */}
                    <AlertDialog open={!!pendingRoleChange} onOpenChange={(open) => { if (!open) setPendingRoleChange(null); }}>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle className="flex items-center gap-2">
                            {pendingRoleChange?.newRole === 'alpha' && <AlertTriangle className="h-5 w-5 text-destructive" />}
                            Change role for @{pendingRoleChange?.username}?
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            {pendingRoleChange?.newRole === 'alpha'
                              ? `⚠️ You are about to grant full Alpha access to @${pendingRoleChange?.username}. Alpha accounts have unrestricted platform control including the ability to mute users, freeze trading, and change any role.`
                              : `This will change @${pendingRoleChange?.username}'s role to "${pendingRoleChange?.newRole?.replace('_', ' ')}". This takes effect on their next login or page refresh.`}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={handleConfirmRoleChange}
                            className={pendingRoleChange?.newRole === 'alpha' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
                          >
                            {pendingRoleChange?.newRole === 'alpha' ? 'Grant Alpha Access' : 'Confirm'}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>

                    {filteredUsers?.length === 0 && (
                      <div className="text-center py-10 text-muted-foreground">
                        <UserX className="h-10 w-10 mx-auto mb-3 opacity-50" />
                        <p>No users found</p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Platform Controls */}
          <TabsContent value="platform">
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Global Platform Controls</CardTitle>
                  <CardDescription>
                    These controls affect all users on the platform except Alpha accounts
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {settingsLoading ? (
                    <div className="space-y-4">
                      <Skeleton className="h-16 w-full" />
                      <Skeleton className="h-16 w-full" />
                    </div>
                  ) : (
                    <>
                      {/* Community mute */}
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            {settings?.community_muted
                              ? <MessageSquareOff className="h-4 w-4 text-destructive" />
                              : <MessageSquare className="h-4 w-4 text-muted-foreground" />
                            }
                            <Label className="font-medium">Mute Community Chat</Label>
                            {settings?.community_muted && (
                              <Badge variant="destructive" className="text-xs">Active</Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Prevents all non-Alpha users from posting or commenting in the community feed.
                            Alpha accounts can still post.
                          </p>
                        </div>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Switch
                              checked={!!settings?.community_muted}
                              className="ml-6"
                            />
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                {settings?.community_muted ? 'Re-enable' : 'Mute'} Community Chat?
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                {settings?.community_muted
                                  ? 'All users will be able to post and comment in the community again.'
                                  : 'This will immediately prevent all non-Alpha users from posting or commenting. This affects the entire platform.'}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleUpdateSetting('community_muted', !settings?.community_muted)}
                                className={!settings?.community_muted ? 'bg-destructive hover:bg-destructive/90 text-destructive-foreground' : 'bg-primary text-primary-foreground'}
                              >
                                Confirm
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>

                      <Separator />

                      {/* Freeze onboarding */}
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            {settings?.onboarding_frozen
                              ? <Lock className="h-4 w-4 text-destructive" />
                              : <Unlock className="h-4 w-4 text-muted-foreground" />
                            }
                            <Label className="font-medium">Freeze New Account Onboarding</Label>
                            {settings?.onboarding_frozen && (
                              <Badge variant="destructive" className="text-xs opacity-80">Active</Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Blocks new users from completing account setup. Users who sign up will be
                            stuck at the onboarding screen until this is disabled.
                          </p>
                        </div>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Switch
                              checked={!!settings?.onboarding_frozen}
                              className="ml-6"
                            />
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                {settings?.onboarding_frozen ? 'Resume' : 'Freeze'} Onboarding?
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                {settings?.onboarding_frozen
                                  ? 'New users will be able to complete account setup again.'
                                  : 'New users who sign up will not be able to complete onboarding and join the platform. Existing users are unaffected.'}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleUpdateSetting('onboarding_frozen', !settings?.onboarding_frozen)}
                                className={!settings?.onboarding_frozen ? 'bg-destructive hover:bg-destructive/90 text-destructive-foreground' : 'bg-primary text-primary-foreground'}
                              >
                                Confirm
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              <div className="p-4 bg-muted/50 rounded-lg border">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium mb-1">Alpha accounts are always exempt</p>
                    <p className="text-sm text-muted-foreground">
                      All restrictions (community mute, frozen trading, frozen onboarding) do not apply
                      to users with the Alpha role. Alpha accounts retain full platform access at all times.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* System Bots */}
          <TabsContent value="system-bots">
            <SystemBotsTab />
          </TabsContent>

          {/* Marketing Bot */}
          <TabsContent value="marketing-bot">
            <MarketingBotTab />
          </TabsContent>

          {/* Feedback */}
          <TabsContent value="feedback">
            <FeedbackTab />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
