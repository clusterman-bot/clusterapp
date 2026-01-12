import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { MainNav } from '@/components/MainNav';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  TrendingUp, Search, BarChart3, Users, TrendingDown, 
  Target, ArrowUpRight, Filter 
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export default function Explore() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('return');
  const [filterType, setFilterType] = useState('all');

  // Fetch all public models (regardless of status for marketplace visibility)
  const { data: models, isLoading } = useQuery({
    queryKey: ['models', 'marketplace'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('models')
        .select(`
          *,
          profiles:user_id (
            id,
            username,
            display_name,
            avatar_url,
            is_verified
          )
        `)
        .eq('is_public', true)
        .order('total_subscribers', { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  const filteredModels = models?.filter(model => {
    const matchesSearch = model.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      model.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === 'all' || model.model_type === filterType;
    return matchesSearch && matchesType;
  }).sort((a, b) => {
    switch (sortBy) {
      case 'return':
        return (b.total_return || 0) - (a.total_return || 0);
      case 'sharpe':
        return (b.sharpe_ratio || 0) - (a.sharpe_ratio || 0);
      case 'subscribers':
        return (b.total_subscribers || 0) - (a.total_subscribers || 0);
      case 'winrate':
        return (b.win_rate || 0) - (a.win_rate || 0);
      default:
        return 0;
    }
  });

  return (
    <div className="min-h-screen bg-background">
      <MainNav />

      <main className="container py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Model Marketplace</h1>
          <p className="text-muted-foreground">
            Discover proven trading strategies from top quants and developers
          </p>
        </div>

        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search models..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2">
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[140px]">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="sandbox">Sandbox</SelectItem>
                <SelectItem value="no-code">No-Code</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="return">Highest Return</SelectItem>
                <SelectItem value="sharpe">Best Sharpe</SelectItem>
                <SelectItem value="subscribers">Most Subscribers</SelectItem>
                <SelectItem value="winrate">Highest Win Rate</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader>
                  <div className="h-6 bg-muted rounded w-3/4" />
                  <div className="h-4 bg-muted rounded w-1/2 mt-2" />
                </CardHeader>
                <CardContent>
                  <div className="h-20 bg-muted rounded" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredModels && filteredModels.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredModels.map((model) => (
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
                        <ArrowUpRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {model.description || 'No description'}
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className="capitalize">
                      {model.model_type}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Return</p>
                        <p className={`font-medium ${(model.total_return || 0) >= 0 ? 'text-profit' : 'text-loss'}`}>
                          {((model.total_return || 0) * 100).toFixed(1)}%
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Sharpe</p>
                        <p className="font-medium">{(model.sharpe_ratio || 0).toFixed(2)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <TrendingDown className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Drawdown</p>
                        <p className="font-medium text-loss">
                          {((model.max_drawdown || 0) * 100).toFixed(1)}%
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Target className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Win Rate</p>
                        <p className="font-medium">{((model.win_rate || 0) * 100).toFixed(0)}%</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-4 pt-4 border-t">
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
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <p className="text-muted-foreground mb-4">
              {searchQuery || filterType !== 'all' 
                ? 'No models match your search criteria' 
                : 'No public models available yet'}
            </p>
            {user && (
              <Button onClick={() => navigate('/models/new')}>
                Be the first to create one
              </Button>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
