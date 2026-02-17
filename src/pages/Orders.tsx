import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useEmailVerified } from '@/hooks/useEmailVerified';
import { EmailVerificationBanner } from '@/components/EmailVerificationBanner';
import { MainNav } from '@/components/MainNav';
import { BackButton } from '@/components/BackButton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Clock, CheckCircle, XCircle, AlertCircle,
  ArrowRight, Calendar, ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import { useAlpacaOrders, useAlpacaCancelOrder, AlpacaOrder } from '@/hooks/useAlpaca';
import { useTradingMode } from '@/hooks/useTradingMode';
import { TradingModeIndicator } from '@/components/TradingModeToggle';
import { formatDistanceToNow } from 'date-fns';

function getStatusIcon(status: string) {
  switch (status) {
    case 'filled':
      return <CheckCircle className="h-4 w-4 text-profit" />;
    case 'canceled':
    case 'expired':
      return <XCircle className="h-4 w-4 text-muted-foreground" />;
    case 'rejected':
      return <AlertCircle className="h-4 w-4 text-loss" />;
    default:
      return <Clock className="h-4 w-4 text-yellow-500" />;
  }
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'filled':
      return <Badge className="bg-profit/20 text-profit border-profit/30 capitalize">{status}</Badge>;
    case 'canceled':
    case 'expired':
      return <Badge variant="secondary" className="capitalize">{status}</Badge>;
    case 'rejected':
      return <Badge variant="destructive" className="capitalize">{status}</Badge>;
    default:
      return <Badge className="bg-yellow-500/20 text-yellow-600 border-yellow-500/30 capitalize">{status.replace('_', ' ')}</Badge>;
  }
}

function OrderRow({ order, onCancel }: { order: AlpacaOrder; onCancel: (id: string) => void }) {
  const qty = parseFloat(order.filled_qty) || parseFloat(order.qty);
  const price = order.filled_avg_price ? parseFloat(order.filled_avg_price) : null;

  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 hover:bg-muted/50 rounded-lg transition-colors border-b last:border-b-0">
      <div className="flex items-start gap-4">
        {getStatusIcon(order.status)}
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold">{order.symbol}</span>
            <Badge variant={order.side === 'buy' ? 'default' : 'secondary'} className={order.side === 'buy' ? 'bg-profit/20 text-profit' : 'bg-loss/20 text-loss'}>
              {order.side.toUpperCase()}
            </Badge>
            <Badge variant="outline" className="capitalize text-xs">
              {order.type.replace('_', ' ')}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {qty} shares{price ? ` @ $${price.toFixed(2)}` : ''}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {formatDistanceToNow(new Date(order.created_at), { addSuffix: true })}
          </p>
        </div>
      </div>
      
      <div className="flex items-center gap-4 ml-8 md:ml-0">
        <div className="text-right">
          <p className="font-semibold">
            {price ? `$${(price * qty).toFixed(2)}` : '—'}
          </p>
          {getStatusBadge(order.status)}
        </div>
        
        {['new', 'accepted', 'pending_new', 'partially_filled'].includes(order.status) && (
          <Button 
            variant="outline" 
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onCancel(order.id);
            }}
          >
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}

export default function Orders() {
  const { user } = useAuth();
  const { isVerified } = useEmailVerified();
  const navigate = useNavigate();
  const { isPaper } = useTradingMode();
  const [activeTab, setActiveTab] = useState('all');
  
  const { data: orders, isLoading } = useAlpacaOrders(activeTab === 'all' ? 'all' : activeTab);
  const cancelOrder = useAlpacaCancelOrder();

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <MainNav />
        <main className="container py-6">
          <div className="text-center py-16">
            <Clock className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-2xl font-bold mb-2">Sign in to view your orders</h2>
            <p className="text-muted-foreground mb-4">Track your trading history and pending orders</p>
            <Button onClick={() => navigate('/auth')}>Sign In</Button>
          </div>
        </main>
      </div>
    );
  }

  if (!isVerified) {
    return (
      <div className="min-h-screen bg-background">
        <MainNav />
        <main className="container py-6">
          <EmailVerificationBanner />
          <div className="text-center py-16">
            <Clock className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-2xl font-bold mb-2">Verify your email</h2>
            <p className="text-muted-foreground mb-4">You need to verify your email before accessing your orders.</p>
          </div>
        </main>
      </div>
    );
  }

  const allOrders = orders || [];
  const pendingOrders = allOrders.filter(o => ['new', 'accepted', 'pending_new', 'partially_filled'].includes(o.status));
  const filledOrders = allOrders.filter(o => o.status === 'filled');
  const cancelledOrders = allOrders.filter(o => ['canceled', 'expired', 'rejected'].includes(o.status));

  return (
    <div className="min-h-screen bg-background">
      <MainNav />

      <main className="container py-6">
        <BackButton />

        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">Orders</h1>
            <TradingModeIndicator />
          </div>
          <Button onClick={() => navigate('/trade')}>
            Trade <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-3 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-4 w-4 text-yellow-500" />
                <p className="text-sm text-muted-foreground">Pending</p>
              </div>
              <p className="text-2xl font-bold">{pendingOrders.length}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="h-4 w-4 text-profit" />
                <p className="text-sm text-muted-foreground">Filled</p>
              </div>
              <p className="text-2xl font-bold">{filledOrders.length}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-2">
                <XCircle className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Cancelled</p>
              </div>
              <p className="text-2xl font-bold">{cancelledOrders.length}</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList>
                <TabsTrigger value="all">
                  All Orders
                  {allOrders.length > 0 && (
                    <Badge variant="secondary" className="ml-2">{allOrders.length}</Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="open">
                  Pending
                  {pendingOrders.length > 0 && (
                    <Badge variant="secondary" className="ml-2">{pendingOrders.length}</Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="closed">Filled</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="animate-pulse flex items-center justify-between p-4 bg-muted rounded-lg">
                    <div className="flex items-center gap-4">
                      <div className="w-4 h-4 rounded-full bg-muted-foreground/20" />
                      <div>
                        <div className="h-4 bg-muted-foreground/20 rounded w-16 mb-2" />
                        <div className="h-3 bg-muted-foreground/20 rounded w-32" />
                      </div>
                    </div>
                    <div className="h-6 bg-muted-foreground/20 rounded w-20" />
                  </div>
                ))}
              </div>
            ) : allOrders.length > 0 ? (
              <div className="space-y-1">
                {allOrders.map((order) => (
                  <OrderRow 
                    key={order.id} 
                    order={order} 
                    onCancel={(id) => cancelOrder.mutate(id)}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground mb-4">
                  {activeTab === 'all' ? 'No orders yet' : `No ${activeTab} orders`}
                </p>
                <Button onClick={() => navigate('/trade')}>Start Trading</Button>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
