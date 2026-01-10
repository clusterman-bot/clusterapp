import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { MainNav } from '@/components/MainNav';
import { BackButton } from '@/components/BackButton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Clock, CheckCircle, XCircle, AlertCircle,
  TrendingUp, TrendingDown, ArrowRight, Calendar
} from 'lucide-react';
import { useOrders, useCancelOrder, Order } from '@/hooks/useTrading';
import { format } from 'date-fns';

function formatPrice(price: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(price);
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'executed':
      return <CheckCircle className="h-4 w-4 text-profit" />;
    case 'cancelled':
      return <XCircle className="h-4 w-4 text-muted-foreground" />;
    case 'failed':
      return <AlertCircle className="h-4 w-4 text-loss" />;
    default:
      return <Clock className="h-4 w-4 text-yellow-500" />;
  }
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'executed':
      return <Badge className="bg-profit/20 text-profit border-profit/30">Executed</Badge>;
    case 'cancelled':
      return <Badge variant="secondary">Cancelled</Badge>;
    case 'failed':
      return <Badge variant="destructive">Failed</Badge>;
    default:
      return <Badge className="bg-yellow-500/20 text-yellow-600 border-yellow-500/30">Pending</Badge>;
  }
}

function OrderRow({ order, onCancel }: { order: Order; onCancel: (id: string) => void }) {
  const navigate = useNavigate();
  
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 hover:bg-muted/50 rounded-lg transition-colors border-b last:border-b-0">
      <div className="flex items-start gap-4">
        {getStatusIcon(order.status)}
        <div>
          <div className="flex items-center gap-2">
            <span 
              className="font-semibold cursor-pointer hover:text-primary transition-colors"
              onClick={() => navigate(`/trade/stocks/${order.stocks?.symbol}`)}
            >
              {order.stocks?.symbol}
            </span>
            <Badge variant={order.order_side === 'buy' ? 'default' : 'secondary'} className={order.order_side === 'buy' ? 'bg-profit/20 text-profit' : 'bg-loss/20 text-loss'}>
              {order.order_side.toUpperCase()}
            </Badge>
            <Badge variant="outline" className="capitalize">
              {order.order_type.replace('_', ' ')}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {order.quantity} shares @ {formatPrice(order.executed_price || order.price || 0)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {format(new Date(order.created_at), 'MMM d, yyyy h:mm a')}
          </p>
        </div>
      </div>
      
      <div className="flex items-center gap-4 ml-8 md:ml-0">
        <div className="text-right">
          <p className="font-semibold">
            {formatPrice((order.executed_price || order.price || 0) * order.quantity)}
          </p>
          {getStatusBadge(order.status)}
        </div>
        
        {order.status === 'pending' && (
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
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('all');
  
  const { data: orders, isLoading } = useOrders(activeTab === 'all' ? undefined : activeTab);
  const cancelOrder = useCancelOrder();

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

  const pendingOrders = orders?.filter(o => o.status === 'pending') || [];
  const executedOrders = orders?.filter(o => o.status === 'executed') || [];
  const cancelledOrders = orders?.filter(o => o.status === 'cancelled' || o.status === 'failed') || [];

  return (
    <div className="min-h-screen bg-background">
      <MainNav />

      <main className="container py-6">
        <BackButton />

        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">Orders</h1>
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
                <p className="text-sm text-muted-foreground">Executed</p>
              </div>
              <p className="text-2xl font-bold">{executedOrders.length}</p>
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
                  {orders && orders.length > 0 && (
                    <Badge variant="secondary" className="ml-2">{orders.length}</Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="pending">
                  Pending
                  {pendingOrders.length > 0 && (
                    <Badge variant="secondary" className="ml-2">{pendingOrders.length}</Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="executed">Executed</TabsTrigger>
                <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
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
            ) : orders && orders.length > 0 ? (
              <div className="space-y-1">
                {orders.map((order) => (
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
