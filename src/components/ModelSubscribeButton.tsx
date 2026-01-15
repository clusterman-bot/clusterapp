import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { useSubscribeToModel, useIsSubscribed, useUnsubscribeFromModel, useMySubscriptions } from '@/hooks/useSubscriptions';
import { useAllocationForSubscription } from '@/hooks/useAllocations';
import { AllocationDialog } from '@/components/model/AllocationDialog';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { Check, Plus, Loader2, Wallet } from 'lucide-react';
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
  className?: string;
  size?: 'default' | 'sm' | 'lg';
}

export function ModelSubscribeButton({ 
  modelId, 
  modelName, 
  performanceFee, 
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
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showUnsubscribeDialog, setShowUnsubscribeDialog] = useState(false);

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
    } else {
      setShowConfirmDialog(true);
    }
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

      {/* Subscribe Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="bg-background">
          <DialogHeader>
            <DialogTitle>Subscribe to {modelName}</DialogTitle>
            <DialogDescription>
              You're about to subscribe to this trading model.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <span className="text-sm font-medium">Performance Fee</span>
              <Badge variant="secondary" className="text-base">
                {performanceFee}%
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              By subscribing, you'll receive trading signals from this model. 
              A {performanceFee}% performance fee will be charged on profitable trades.
            </p>
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

      {/* Show allocated amount for subscribed users */}
      {isSubscribed && allocation && (
        <Badge variant="secondary" className="ml-2">
          <Wallet className="h-3 w-3 mr-1" />
          ${allocation.current_value.toLocaleString()} allocated
        </Badge>
      )}
    </>
  );
}
