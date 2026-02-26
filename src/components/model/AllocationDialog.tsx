import { useState, useEffect } from 'react';
import { usePaperBalance, useCreateAllocation, useUpdateAllocation, useAllocationForSubscription } from '@/hooks/useAllocations';
import { useBrokerageAccounts } from '@/hooks/useBrokerageAccounts';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Wallet, TrendingUp, AlertCircle, LinkIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface AllocationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subscriptionId: string;
  modelId: string;
  modelName: string;
  minAllocation?: number;
  maxAllocation?: number;
}

export function AllocationDialog({
  open,
  onOpenChange,
  subscriptionId,
  modelId,
  modelName,
  minAllocation = 100,
  maxAllocation = 10000,
}: AllocationDialogProps) {
  const { data: balance } = usePaperBalance();
  const { data: brokerageAccounts, isLoading: loadingAccounts } = useBrokerageAccounts();
  const createAllocation = useCreateAllocation();
  const updateAllocation = useUpdateAllocation();
  const { data: existingAllocation } = useAllocationForSubscription(subscriptionId);
  const navigate = useNavigate();

  const isEditing = !!existingAllocation;

  const hasLiveAccount = brokerageAccounts?.some(a => a.account_type === 'live' && a.is_active);
  const hasPaperAccount = brokerageAccounts?.some(a => a.account_type === 'paper' && a.is_active);
  const hasAnyAccount = brokerageAccounts?.some(a => a.is_active);
  
  const availableBalance = (balance?.paper_balance ?? 100000) - (balance?.allocated_balance ?? 0) + (isEditing ? existingAllocation.allocated_amount : 0);
  const effectiveMin = Math.min(minAllocation, availableBalance);
  const effectiveMax = Math.min(maxAllocation, availableBalance);
  const clampAmount = (v: number) => Math.max(effectiveMin, Math.min(v, effectiveMax));
  
  const [amount, setAmount] = useState(() => clampAmount(isEditing ? existingAllocation.allocated_amount : effectiveMin));
  const [percentage, setPercentage] = useState(() =>
    effectiveMax > 0 ? Math.round((clampAmount(isEditing ? existingAllocation.allocated_amount : effectiveMin) / effectiveMax) * 100) : 0
  );

  // Sync when dialog opens with existing allocation
  useEffect(() => {
    if (open && existingAllocation) {
      const amt = clampAmount(existingAllocation.allocated_amount);
      setAmount(amt);
      setPercentage(effectiveMax > 0 ? Math.round((amt / effectiveMax) * 100) : 0);
    }
  }, [open, existingAllocation?.id]);

  const handlePercentageChange = (value: number[]) => {
    const pct = value[0];
    setPercentage(pct);
    setAmount(Math.round((pct / 100) * effectiveMax));
  };

  const handleAmountChange = (value: string) => {
    const numValue = parseFloat(value) || 0;
    setAmount(numValue);
    setPercentage(effectiveMax > 0 ? Math.round((numValue / effectiveMax) * 100) : 0);
  };

  const handleAllocate = () => {
    if (isEditing) {
      updateAllocation.mutate(
        { allocationId: existingAllocation.id, newAmount: amount },
        { onSuccess: () => onOpenChange(false) }
      );
    } else {
      createAllocation.mutate(
        { subscriptionId, modelId, amount },
        { onSuccess: () => onOpenChange(false) }
      );
    }
  };

  const isPending = createAllocation.isPending || updateAllocation.isPending;

  const isBelowMin = amount < effectiveMin;
  const isAboveMax = amount > effectiveMax;
  const isInvalid = amount <= 0 || isBelowMin || isAboveMax || amount > availableBalance || !hasAnyAccount;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-background">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            {isEditing ? 'Update Allocation' : 'Allocate Funds'} — {modelName}
          </DialogTitle>
          <DialogDescription>
            {isEditing 
              ? 'Adjust how much capital is allocated to mirror this model\'s trades.'
              : 'Choose how much to allocate from your paper balance to mirror this model\'s trades.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* No brokerage account warning */}
          {!loadingAccounts && !hasAnyAccount && (
            <div className="flex flex-col gap-3 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-destructive">No Brokerage Account Connected</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    You need a connected brokerage account to mirror trades. Connect one to continue.
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => { onOpenChange(false); navigate('/settings/brokerage'); }}
              >
                <LinkIcon className="h-4 w-4 mr-2" />
                Connect Brokerage Account
              </Button>
            </div>
          )}

          {/* Paper-only info (not blocking) */}
          {!loadingAccounts && hasPaperAccount && !hasLiveAccount && (
            <div className="flex flex-col gap-3 p-4 bg-muted/50 border border-border rounded-lg">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Paper Account Connected</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Trades will execute on your paper account. You can connect a live account later for real trading.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Balances */}
          <div className="p-4 bg-muted rounded-lg space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Available Balance</span>
              <span className="text-lg font-bold">${availableBalance.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Model min allocation</span>
              <span>${minAllocation.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Model max allocation</span>
              <span>${maxAllocation.toLocaleString()}</span>
            </div>
          </div>

          {/* Slider between min and max */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Allocation Amount</Label>
              <span className="text-sm text-muted-foreground">{percentage}% of max</span>
            </div>
            <Slider
              value={[percentage]}
              min={0}
              max={100}
              step={1}
              onValueChange={handlePercentageChange}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>${effectiveMin.toLocaleString()}</span>
              <span>${effectiveMax.toLocaleString()}</span>
            </div>
          </div>

          {/* Amount Input */}
          <div className="space-y-2">
            <Label htmlFor="amount">Amount ($)</Label>
            <Input
              id="amount"
              type="number"
              value={amount}
              onChange={(e) => handleAmountChange(e.target.value)}
              min={effectiveMin}
              max={effectiveMax}
            />
            {isBelowMin && (
              <p className="text-xs text-destructive">Minimum allocation is ${effectiveMin.toLocaleString()}</p>
            )}
            {isAboveMax && (
              <p className="text-xs text-destructive">Maximum allocation is ${effectiveMax.toLocaleString()}</p>
            )}
          </div>

          {/* Large allocation warning */}
          {percentage > 50 && (
            <div className="flex items-start gap-2 p-3 bg-warning/10 border border-warning/20 rounded-lg">
              <AlertCircle className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
              <p className="text-sm text-warning">
                You're allocating more than 50% of the maximum. Consider diversifying across multiple models.
              </p>
            </div>
          )}

          {/* How it works */}
          <div className="p-4 border rounded-lg space-y-2">
            <h4 className="font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              How it works
            </h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Trades are mirrored proportionally from your allocated funds</li>
              <li>• Executes automatically on your connected Alpaca account</li>
              <li>• If funds run low, trades are blocked and you'll be notified once by email</li>
              <li>• You can adjust or remove your allocation at any time</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleAllocate} 
            disabled={isInvalid || isPending}
          >
            {isPending ? (isEditing ? 'Updating...' : 'Allocating...') : `${isEditing ? 'Update' : 'Allocate'} $${amount.toLocaleString()}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
