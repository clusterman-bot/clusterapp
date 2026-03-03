import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { usePaperBalance, useCreateAllocation, useUpdateAllocation, useAllocationForSubscription } from '@/hooks/useAllocations';
import { useBrokerageAccounts, BrokerageAccount } from '@/hooks/useBrokerageAccounts';
import type { AlpacaAccount } from '@/hooks/useAlpaca';
import { useAuth } from '@/hooks/useAuth';
import { TradingModeSelector } from '@/components/model/TradingModeSelector';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { Wallet, TrendingUp, AlertCircle, LinkIcon, Swords } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTradingMode } from '@/hooks/useTradingMode';

interface AllocationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subscriptionId: string;
  modelId: string;
  modelName: string;
  minAllocation?: number;
  maxAllocation?: number;
  brokerageAccounts?: BrokerageAccount[];
  loadingAccounts?: boolean;
}

export function AllocationDialog({
  open,
  onOpenChange,
  subscriptionId,
  modelId,
  modelName,
  minAllocation = 100,
  maxAllocation = 10000,
  brokerageAccounts: externalAccounts,
  loadingAccounts: externalLoading,
}: AllocationDialogProps) {
  const { data: balance } = usePaperBalance();
  const { data: fallbackAccounts, isLoading: fallbackLoading } = useBrokerageAccounts();
  const brokerageAccounts = externalAccounts ?? fallbackAccounts;
  const loadingAccounts = externalLoading ?? fallbackLoading;
  const createAllocation = useCreateAllocation();
  const updateAllocation = useUpdateAllocation();
  const { data: existingAllocation } = useAllocationForSubscription(subscriptionId);
  const navigate = useNavigate();
  const { mode: globalMode } = useTradingMode();

  const isEditing = !!existingAllocation;

  const hasLiveAccount = brokerageAccounts?.some(a => a.account_type === 'live' && a.is_active);
  const hasPaperAccount = brokerageAccounts?.some(a => a.account_type === 'paper' && a.is_active);
  const hasAnyAccount = brokerageAccounts?.some(a => a.is_active);

  // Trading mode state - sync with global mode
  const [tradingMode, setTradingMode] = useState<'paper' | 'live'>(globalMode);
  const [allowShorting, setAllowShorting] = useState(false);

  // Sync mode when accounts load
  useEffect(() => {
    if (!loadingAccounts) {
      if (globalMode === 'live' && hasLiveAccount) setTradingMode('live');
      else if (hasPaperAccount) setTradingMode('paper');
      else if (hasLiveAccount) setTradingMode('live');
    }
  }, [loadingAccounts, hasLiveAccount, hasPaperAccount, globalMode]);

  // Fetch Alpaca account data for the LOCALLY selected trading mode (not global)
  const { user } = useAuth();
  const localIsPaper = tradingMode === 'paper';
  const { data: alpacaAccount } = useQuery({
    queryKey: ['alpaca-account-dialog', user?.id, localIsPaper],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('alpaca-trading/account', {
        body: { isPaper: localIsPaper },
      });
      if (data?.needsConnection || data?.needsReconnect) return null;
      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      return data.account as AlpacaAccount;
    },
    enabled: !!user && hasAnyAccount,
  });

  const isLiveMode = tradingMode === 'live';
  const availableBalance = isLiveMode
    ? (alpacaAccount?.buying_power ?? 0)
    : (balance?.paper_balance ?? 100000) - (balance?.allocated_balance ?? 0) + (isEditing ? existingAllocation.allocated_amount : 0);

  const effectiveMin = Math.min(minAllocation, availableBalance);
  const effectiveMax = Math.min(maxAllocation, availableBalance);
  const clampAmount = (v: number) => Math.max(effectiveMin, Math.min(v, effectiveMax));
  
  const [amount, setAmount] = useState(() => clampAmount(isEditing ? existingAllocation.allocated_amount : effectiveMin));
  const [percentage, setPercentage] = useState(() =>
    effectiveMax > 0 ? Math.round((clampAmount(isEditing ? existingAllocation.allocated_amount : effectiveMin) / effectiveMax) * 100) : 0
  );

  // Reset amounts when trading mode changes
  useEffect(() => {
    const newAmount = clampAmount(isEditing ? existingAllocation?.allocated_amount ?? effectiveMin : effectiveMin);
    setAmount(newAmount);
    setPercentage(effectiveMax > 0 ? Math.round((newAmount / effectiveMax) * 100) : 0);
  }, [tradingMode, availableBalance]);

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
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto bg-background">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            {isEditing ? 'Update Allocation' : 'Allocate Funds'} — {modelName}
          </DialogTitle>
          <DialogDescription>
            {isEditing 
              ? 'Adjust how much capital is allocated to mirror this model\'s trades.'
              : 'Choose how much to allocate to mirror this model\'s trades.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* No brokerage account warning */}
          {!loadingAccounts && !hasAnyAccount && (
            <div className="flex flex-col gap-3 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-destructive">No Brokerage Account Connected</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Connect a brokerage account to mirror trades.
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

          {/* Trading mode toggle */}
          {hasAnyAccount && (
            <TradingModeSelector
              mode={tradingMode}
              onModeChange={setTradingMode}
              brokerageAccounts={brokerageAccounts}
              isLoading={loadingAccounts}
            />
          )}

          {/* Balances */}
          <div className="p-3 bg-muted rounded-lg space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {isLiveMode ? 'Buying Power' : 'Available Balance'}
              </span>
              <span className="text-lg font-bold">${availableBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
            {isLiveMode && alpacaAccount && (
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Portfolio Value</span>
                <span>${(alpacaAccount.portfolio_value ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
            )}
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
          <div className="space-y-3">
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

          {/* Allow shorting */}
          <div className="flex items-start gap-3 p-3 border rounded-lg">
            <Checkbox
              id="allow-shorting"
              checked={allowShorting}
              onCheckedChange={(checked) => setAllowShorting(checked === true)}
            />
            <div className="space-y-1">
              <Label htmlFor="allow-shorting" className="flex items-center gap-1.5 cursor-pointer text-sm font-medium">
                <Swords className="h-4 w-4" />
                Allow Short Selling
              </Label>
              <p className="text-xs text-muted-foreground">
                Enable the bot to open short positions when sell signals are generated. Disabled by default.
              </p>
            </div>
          </div>

          {/* Large allocation warning */}
          {percentage > 50 && (
            <div className="flex items-start gap-2 p-2 bg-warning/10 border border-warning/20 rounded-lg">
              <AlertCircle className="h-4 w-4 text-warning flex-shrink-0 mt-0.5" />
              <p className="text-xs text-warning">
                You're allocating more than 50% of the maximum. Consider diversifying across multiple models.
              </p>
            </div>
          )}

          {/* How it works */}
          <div className="p-3 border rounded-lg space-y-1.5">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              How it works
            </h4>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>• Trades are mirrored proportionally from your allocated funds</li>
              <li>• Executes on your {tradingMode === 'live' ? 'live' : 'paper'} Alpaca account</li>
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