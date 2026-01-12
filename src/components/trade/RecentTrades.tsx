import { useAuth } from '@/hooks/useAuth';
import { useAlpacaOrders } from '@/hooks/useAlpaca';
import { useActiveBrokerageAccount } from '@/hooks/useBrokerageAccounts';
import { useTradingMode } from '@/hooks/useTradingMode';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowUpRight, ArrowDownRight, Clock, Link2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export function RecentTrades() {
  const { user } = useAuth();
  const { mode, isPaper } = useTradingMode();
  const { data: activeAccount, isLoading: accountCheckLoading } = useActiveBrokerageAccount(mode);
  const { data: orders, isLoading } = useAlpacaOrders('all');

  const hasConnectedAccount = !!activeAccount;

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

  if (!hasConnectedAccount && !accountCheckLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5" /> Recent Trades
            </CardTitle>
            <Badge variant={isPaper ? 'secondary' : 'default'}>
              {isPaper ? 'Paper' : 'Live'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Link2 className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">
              No {mode} account connected. Connect your brokerage to see trades.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isLoading || accountCheckLoading) {
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

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'filled':
        return 'default';
      case 'partially_filled':
        return 'secondary';
      case 'canceled':
      case 'expired':
        return 'outline';
      case 'rejected':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5" /> Recent Trades
          </CardTitle>
          <Badge variant={isPaper ? 'secondary' : 'default'}>
            {isPaper ? 'Paper' : 'Live'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {orders && orders.length > 0 ? (
          <div className="space-y-3 max-h-[300px] overflow-y-auto">
            {orders.slice(0, 10).map((order) => (
              <div 
                key={order.id}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-full ${
                    order.side === 'buy' 
                      ? 'bg-profit/10 text-profit' 
                      : 'bg-loss/10 text-loss'
                  }`}>
                    {order.side === 'buy' ? (
                      <ArrowUpRight className="h-4 w-4" />
                    ) : (
                      <ArrowDownRight className="h-4 w-4" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">
                        {order.symbol}
                      </span>
                      <Badge variant="outline" className="text-xs capitalize">
                        {order.side}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {order.filled_qty || order.qty} shares
                      {order.filled_avg_price && ` @ $${parseFloat(order.filled_avg_price).toFixed(2)}`}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <Badge 
                    variant={getStatusBadgeVariant(order.status)}
                    className="capitalize"
                  >
                    {order.status.replace('_', ' ')}
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
