import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowUpRight, ArrowDownRight, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Order {
  id: string;
  order_side: 'buy' | 'sell';
  order_type: string;
  quantity: number;
  executed_price: number | null;
  price: number | null;
  status: string;
  created_at: string;
  executed_at: string | null;
  stocks: {
    symbol: string;
    name: string;
  } | null;
}

export function RecentTrades() {
  const { user } = useAuth();

  const { data: recentOrders, isLoading } = useQuery({
    queryKey: ['recent-orders', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          order_side,
          order_type,
          quantity,
          executed_price,
          price,
          status,
          created_at,
          executed_at,
          stocks (
            symbol,
            name
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      return data as Order[];
    },
    enabled: !!user?.id,
  });

  if (!user) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5" /> Recent Trades
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-4">
            Sign in to see your trades
          </p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5" /> Recent Trades
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Clock className="h-5 w-5" /> Recent Trades
        </CardTitle>
      </CardHeader>
      <CardContent>
        {recentOrders && recentOrders.length > 0 ? (
          <div className="space-y-3">
            {recentOrders.map((order) => (
              <div 
                key={order.id}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-full ${
                    order.order_side === 'buy' 
                      ? 'bg-profit/10 text-profit' 
                      : 'bg-loss/10 text-loss'
                  }`}>
                    {order.order_side === 'buy' ? (
                      <ArrowUpRight className="h-4 w-4" />
                    ) : (
                      <ArrowDownRight className="h-4 w-4" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">
                        {order.stocks?.symbol || 'Unknown'}
                      </span>
                      <Badge variant="outline" className="text-xs capitalize">
                        {order.order_side}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {order.quantity} shares @ ${(order.executed_price || order.price || 0).toFixed(2)}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <Badge 
                    variant={order.status === 'executed' ? 'default' : 'secondary'}
                    className="capitalize"
                  >
                    {order.status}
                  </Badge>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDistanceToNow(new Date(order.created_at), { addSuffix: true })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No trades yet</p>
            <p className="text-sm">Your trading history will appear here</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
