import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { useSubscribeToModel, useIsSubscribed, useUnsubscribeFromModel } from '@/hooks/useSubscriptions';
import { useAllocationForSubscription } from '@/hooks/useAllocations';
import { AllocationDialog } from '@/components/model/AllocationDialog';
import { TradingModeSelector } from '@/components/model/TradingModeSelector';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { useBrokerageAccounts } from '@/hooks/useBrokerageAccounts';
import { Check, Plus, Loader2, Wallet, Link } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface ModelSubscribeButtonProps {
  modelId: string;
  modelName: string;
  performanceFee: number;
  minAllocation?: number;
  maxAllocation?: number;
  className?: string;
  size?: 'default' | 'sm' | 'lg';
}

export function ModelSubscribeButton({ 
  modelId, 
  modelName, 
  performanceFee,
  minAllocation = 100,
  maxAllocation = 10000,
  className = '',
  size = 'default'
}: ModelSubscribeButtonProps) {
  const { user } = useAuth();
  const { data: userRole } = useUserRole();
  const { data: subscription, isLoading: checkingSubscription } = useIsSubscribed(modelId);
  const subscribe = useSubscribeToModel();
  const unsubscribe = useUnsubscribeFromModel();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { data: brokerageAccounts, isLoading: loadingAccounts } = useBrokerageAccounts();
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showUnsubscribeDialog, setShowUnsubscribeDialog] = useState(false);
  const [showNoBrokerageDialog, setShowNoBrokerageDialog] = useState(false);

  // Determine default trading mode based on available accounts
  const hasLiveAccount = brokerageAccounts?.some(a => a.account_type === 'live' && a.is_active);
  const hasPaperAccount = brokerageAccounts?.some(a => a.account_type === 'paper' && a.is_active);
  const defaultMode = hasLiveAccount ? 'live' as const : 'paper' as const;
  const [tradingMode, setTradingMode] = useState<'paper' | 'live'>(defaultMode);

  const isSubscribed = !!subscription;
  const isRetailTrader = userRole?.role === 'retail_trader';
  
  // Check allocation for this subscription
  const { data: allocation } = useAllocationForSubscription(subscription?.id);
  const [showAllocationDialog, setShowAllocationDialog] = useState(false);

  const handleClick = () => {
    if (!user) {
      navigate('/auth');
      return;
    }
    
    if (isSubscribed) {
      setShowUnsubscribeDialog(true);
      return;
    }

    const hasActiveBrokerage = brokerageAccounts?.some(a => a.is_active);
    if (!hasActiveBrokerage) {
      setShowNoBrokerageDialog(true);
      return;
    }

    setShowConfirmDialog(true);
  };

  const handleSubscribe = async () => {
    try {
      await subscribe.mutateAsync({ modelId, performanceFee });
      toast({
        title: 'Subscribed!',
        description: `You're now following ${modelName}`,
      });
      setShowConfirmDialog(false);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleUnsubscribe = async () => {
    if (!subscription) return;
    try {
      await unsubscribe.mutateAsync(subscription.id);
      toast({
        title: 'Unsubscribed',
        description: `You've unsubscribed from ${modelName}`,
      });
      setShowUnsubscribeDialog(false);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  if (checkingSubscription) {
    return (
      <Button variant="outline" size={size} className={className} disabled>
        <Loader2 className="h-4 w-4 animate-spin" />
      </Button>
    );
  }

  return (
    <>
      <Button
        variant={isSubscribed ? 'outline' : 'default'}
        size={size}
        className={`${className} ${isSubscribed ? 'border-green-500 text-green-500 hover:bg-green-500/10' : ''}`}
        onClick={handleClick}
      >
        {isSubscribed ? (
          <>
            <Check className="h-4 w-4 mr-1" />
            Subscribed
          </>
        ) : (
          <>
            <Plus className="h-4 w-4 mr-1" />
            Subscribe
          </>
        )}
      </Button>

      {/* No Brokerage Account Dialog */}
      <Dialog open={showNoBrokerageDialog} onOpenChange={setShowNoBrokerageDialog}>
        <DialogContent className="bg-background">
          <DialogHeader>
            <DialogTitle>Brokerage Account Required</DialogTitle>
            <DialogDescription>
              You need to connect a brokerage account before subscribing to models.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              Model trades are mirrored automatically through your connected Alpaca account. Connect your Alpaca paper or live account to get started.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNoBrokerageDialog(false)}>
              Cancel
            </Button>
            <Button onClick={() => { setShowNoBrokerageDialog(false); navigate('/settings/brokerage'); }}>
              <Link className="h-4 w-4 mr-2" />
              Connect Brokerage
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Subscribe Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="bg-background">
          <DialogHeader>
            <DialogTitle>Subscribe to {modelName}</DialogTitle>
            <DialogDescription>
              You're about to subscribe to this trading model.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-3">
            <TradingModeSelector
              mode={tradingMode}
              onModeChange={setTradingMode}
              brokerageAccounts={brokerageAccounts}
              isLoading={loadingAccounts}
            />
            <p className="text-sm text-muted-foreground">
              By subscribing, you'll receive trading signals from this model and your connected Alpaca account will automatically mirror its trades.
            </p>
            <div className="rounded-lg border bg-muted/40 p-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Initial allocation</span>
                <span className="font-medium">${minAllocation.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Max allocation</span>
                <span className="font-medium">${maxAllocation.toLocaleString()}</span>
              </div>
              <p className="text-xs text-muted-foreground pt-1">
                Your allocation controls how much capital is committed to trade-mirroring. You can adjust it after subscribing.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubscribe} disabled={subscribe.isPending}>
              {subscribe.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Subscribing...
                </>
              ) : (
                'Confirm Subscribe'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unsubscribe Confirmation Dialog */}
      <Dialog open={showUnsubscribeDialog} onOpenChange={setShowUnsubscribeDialog}>
        <DialogContent className="bg-background">
          <DialogHeader>
            <DialogTitle>Unsubscribe from {modelName}?</DialogTitle>
            <DialogDescription>
              Are you sure you want to unsubscribe from this trading model?
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              You will no longer receive trading signals from this model. 
              You can resubscribe at any time.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUnsubscribeDialog(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleUnsubscribe} 
              disabled={unsubscribe.isPending}
            >
              {unsubscribe.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Unsubscribing...
                </>
              ) : (
                'Unsubscribe'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Allocation Dialog - shown after subscribing for retail traders */}
      {subscription && (
        <AllocationDialog
          open={showAllocationDialog}
          onOpenChange={setShowAllocationDialog}
          subscriptionId={subscription.id}
          modelId={modelId}
          modelName={modelName}
          minAllocation={minAllocation}
          maxAllocation={maxAllocation}
          brokerageAccounts={brokerageAccounts}
          loadingAccounts={loadingAccounts}
        />
      )}

      {/* Show allocate button for subscribed retail traders */}
      {isSubscribed && isRetailTrader && !allocation && (
        <Button
          variant="outline"
          size={size}
          className={`ml-2 ${className}`}
          onClick={() => setShowAllocationDialog(true)}
        >
          <Wallet className="h-4 w-4 mr-1" />
          Allocate Funds
        </Button>
      )}

      {/* Show allocated amount for subscribed users — click to edit */}
      {isSubscribed && allocation && (
        <Button
          variant="secondary"
          size={size}
          className="ml-2 gap-1"
          onClick={() => setShowAllocationDialog(true)}
        >
          <Wallet className="h-3 w-3" />
          ${allocation.current_value.toLocaleString()} allocated
        </Button>
      )}
    </>
  );
}
