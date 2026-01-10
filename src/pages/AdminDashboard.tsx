import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { 
  useIsAdmin, useAllUsers, useAdminStats, useUpdateUserRole, 
  useAllModels, useAdminUpdateModel, useAdminDeleteModel, AppRole 
} from '@/hooks/useUserRole';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
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
  TrendingUp, Users, BarChart3, FileText, LogOut, 
  Search, Shield, Code, LineChart, ArrowLeft, Trash2, Eye, EyeOff,
  Settings, Bell, Lock, Globe
} from 'lucide-react';

interface UserWithRole {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string | null;
  role: AppRole | null;
}

interface ModelWithProfile {
  id: string;
  name: string;
  description: string | null;
  status: string | null;
  is_public: boolean | null;
  total_subscribers: number | null;
  created_at: string | null;
  profiles: {
    id: string;
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
}

export default function AdminDashboard() {
  const { user, signOut } = useAuth();
  const { isAdmin, isLoading: adminLoading } = useIsAdmin();
  const { data: stats, isLoading: statsLoading } = useAdminStats();
  const { data: users, isLoading: usersLoading } = useAllUsers();
  const { data: models, isLoading: modelsLoading } = useAllModels();
  const updateUserRole = useUpdateUserRole();
  const updateModel = useAdminUpdateModel();
  const deleteModel = useAdminDeleteModel();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [modelSearchQuery, setModelSearchQuery] = useState('');

  // Platform settings state (prototype - stored locally)
  const [settings, setSettings] = useState({
    allowNewSignups: true,
    requireEmailVerification: false,
    allowPublicModels: true,
    maintenanceMode: false,
    maxModelsPerUser: 10,
    defaultPerformanceFee: 20,
  });

  if (adminLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!user || !isAdmin) {
    navigate('/dashboard');
    return null;
  }

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const handleRoleChange = async (userId: string, newRole: AppRole) => {
    try {
      await updateUserRole.mutateAsync({ userId, role: newRole });
      toast({ title: 'Role Updated', description: 'User role has been updated successfully' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleModelStatusChange = async (modelId: string, status: string) => {
    try {
      await updateModel.mutateAsync({ id: modelId, updates: { status } });
      toast({ title: 'Model Updated', description: 'Model status has been updated' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleModelVisibilityChange = async (modelId: string, isPublic: boolean) => {
    try {
      await updateModel.mutateAsync({ id: modelId, updates: { is_public: isPublic } });
      toast({ title: 'Model Updated', description: `Model is now ${isPublic ? 'public' : 'private'}` });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleDeleteModel = async (modelId: string) => {
    try {
      await deleteModel.mutateAsync(modelId);
      toast({ title: 'Model Deleted', description: 'Model has been permanently deleted' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleSettingChange = (key: keyof typeof settings, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    toast({ title: 'Setting Updated', description: 'Platform setting has been updated (prototype)' });
  };

  const filteredUsers = (users as UserWithRole[] | undefined)?.filter(u => 
    u.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.display_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredModels = (models as ModelWithProfile[] | undefined)?.filter(m =>
    m.name?.toLowerCase().includes(modelSearchQuery.toLowerCase()) ||
    m.profiles?.username?.toLowerCase().includes(modelSearchQuery.toLowerCase()) ||
    m.profiles?.display_name?.toLowerCase().includes(modelSearchQuery.toLowerCase())
  );

  const getRoleIcon = (role: string | null) => {
    switch (role) {
      case 'admin': return <Shield className="h-4 w-4" />;
      case 'developer': return <Code className="h-4 w-4" />;
      default: return <LineChart className="h-4 w-4" />;
    }
  };

  const getRoleBadgeVariant = (role: string | null): "default" | "secondary" | "destructive" | "outline" => {
    switch (role) {
      case 'admin': return 'destructive';
      case 'developer': return 'default';
      default: return 'secondary';
    }
  };

  const getStatusBadgeVariant = (status: string | null): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case 'published': return 'default';
      case 'draft': return 'secondary';
      case 'archived': return 'outline';
      default: return 'secondary';
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate('/')}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Home
            </Button>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-6 w-6 text-primary" />
              <span className="text-xl font-bold">Cluster</span>
              <Badge variant="destructive" className="ml-2">Admin</Badge>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={handleSignOut}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <main className="container py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Admin Dashboard</h1>
          <p className="text-muted-foreground">Manage users, models, and platform settings</p>
        </div>

        <div className="grid gap-4 md:grid-cols-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {statsLoading ? '...' : stats?.totalUsers || 0}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Models</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {statsLoading ? '...' : stats?.totalModels || 0}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Posts</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {statsLoading ? '...' : stats?.totalPosts || 0}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Subscriptions</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {statsLoading ? '...' : stats?.totalSubscriptions || 0}
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="users">
          <TabsList>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="models">Models</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="users">
            <Card>
              <CardHeader>
                <CardTitle>User Management</CardTitle>
                <CardDescription>View and manage platform users</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search users..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>

                {usersLoading ? (
                  <p className="text-muted-foreground">Loading users...</p>
                ) : (
                  <div className="space-y-4">
                    {filteredUsers?.map((u) => (
                      <div key={u.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-4">
                          <Avatar>
                            <AvatarImage src={u.avatar_url || undefined} />
                            <AvatarFallback>
                              {u.display_name?.[0] || u.username?.[0] || '?'}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{u.display_name || u.username}</p>
                            <p className="text-sm text-muted-foreground">@{u.username}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            {getRoleIcon(u.role)}
                            <Badge variant={getRoleBadgeVariant(u.role)}>
                              {(u.role || 'retail_trader').replace('_', ' ')}
                            </Badge>
                          </div>
                          <Select
                            value={u.role || 'retail_trader'}
                            onValueChange={(value) => handleRoleChange(u.id, value as AppRole)}
                          >
                            <SelectTrigger className="w-[140px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="retail_trader">Retail Trader</SelectItem>
                              <SelectItem value="developer">Developer</SelectItem>
                              <SelectItem value="admin">Admin</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="models">
            <Card>
              <CardHeader>
                <CardTitle>Model Management</CardTitle>
                <CardDescription>Review and moderate trading models</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search models by name or creator..."
                      value={modelSearchQuery}
                      onChange={(e) => setModelSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>

                {modelsLoading ? (
                  <p className="text-muted-foreground">Loading models...</p>
                ) : filteredModels?.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No models found</p>
                ) : (
                  <div className="space-y-4">
                    {filteredModels?.map((model) => (
                      <div key={model.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-4">
                          <Avatar>
                            <AvatarImage src={model.profiles?.avatar_url || undefined} />
                            <AvatarFallback>
                              {model.profiles?.display_name?.[0] || model.profiles?.username?.[0] || '?'}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{model.name}</p>
                            <p className="text-sm text-muted-foreground">
                              by @{model.profiles?.username || 'unknown'} • {model.total_subscribers || 0} subscribers
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant={getStatusBadgeVariant(model.status)}>
                            {model.status || 'draft'}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleModelVisibilityChange(model.id, !model.is_public)}
                            title={model.is_public ? 'Make private' : 'Make public'}
                          >
                            {model.is_public ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                          </Button>
                          <Select
                            value={model.status || 'draft'}
                            onValueChange={(value) => handleModelStatusChange(model.id, value)}
                          >
                            <SelectTrigger className="w-[120px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="draft">Draft</SelectItem>
                              <SelectItem value="published">Published</SelectItem>
                              <SelectItem value="archived">Archived</SelectItem>
                            </SelectContent>
                          </Select>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Model</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete "{model.name}"? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction 
                                  onClick={() => handleDeleteModel(model.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings">
            <div className="grid gap-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    <CardTitle>User Settings</CardTitle>
                  </div>
                  <CardDescription>Configure user registration and authentication</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Allow New Signups</Label>
                      <p className="text-sm text-muted-foreground">Enable or disable new user registrations</p>
                    </div>
                    <Switch 
                      checked={settings.allowNewSignups}
                      onCheckedChange={(checked) => handleSettingChange('allowNewSignups', checked)}
                    />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Require Email Verification</Label>
                      <p className="text-sm text-muted-foreground">Users must verify email before accessing the platform</p>
                    </div>
                    <Switch 
                      checked={settings.requireEmailVerification}
                      onCheckedChange={(checked) => handleSettingChange('requireEmailVerification', checked)}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    <CardTitle>Model Settings</CardTitle>
                  </div>
                  <CardDescription>Configure model creation and publishing rules</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Allow Public Models</Label>
                      <p className="text-sm text-muted-foreground">Allow developers to make their models public</p>
                    </div>
                    <Switch 
                      checked={settings.allowPublicModels}
                      onCheckedChange={(checked) => handleSettingChange('allowPublicModels', checked)}
                    />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Max Models Per User</Label>
                      <p className="text-sm text-muted-foreground">Maximum number of models a developer can create</p>
                    </div>
                    <Input 
                      type="number" 
                      className="w-24"
                      value={settings.maxModelsPerUser}
                      onChange={(e) => handleSettingChange('maxModelsPerUser', parseInt(e.target.value) || 0)}
                    />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Default Performance Fee (%)</Label>
                      <p className="text-sm text-muted-foreground">Default performance fee for new models</p>
                    </div>
                    <Input 
                      type="number" 
                      className="w-24"
                      value={settings.defaultPerformanceFee}
                      onChange={(e) => handleSettingChange('defaultPerformanceFee', parseInt(e.target.value) || 0)}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    <CardTitle>Platform Settings</CardTitle>
                  </div>
                  <CardDescription>General platform configuration</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="flex items-center gap-2">
                        <Lock className="h-4 w-4" />
                        Maintenance Mode
                      </Label>
                      <p className="text-sm text-muted-foreground">Temporarily disable access for non-admin users</p>
                    </div>
                    <Switch 
                      checked={settings.maintenanceMode}
                      onCheckedChange={(checked) => handleSettingChange('maintenanceMode', checked)}
                    />
                  </div>
                </CardContent>
              </Card>

              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground text-center">
                  <Globe className="inline h-4 w-4 mr-1" />
                  Settings are stored locally for this prototype. In production, these would be persisted to the database.
                </p>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}