import { useState } from 'react';
import { usePaperBalance, useCreateAllocation } from '@/hooks/useAllocations';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Wallet, TrendingUp, AlertCircle } from 'lucide-react';

interface AllocationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subscriptionId: string;
  modelId: string;
  modelName: string;
}

export function AllocationDialog({
  open,
  onOpenChange,
  subscriptionId,
  modelId,
  modelName,
}: AllocationDialogProps) {
  const { data: balance } = usePaperBalance();
  const createAllocation = useCreateAllocation();
  
  const availableBalance = (balance?.paper_balance ?? 100000) - (balance?.allocated_balance ?? 0);
  const [amount, setAmount] = useState(Math.min(10000, availableBalance));
  const [percentage, setPercentage] = useState(
    Math.round((Math.min(10000, availableBalance) / availableBalance) * 100)
  );

  const handlePercentageChange = (value: number[]) => {
    const pct = value[0];
    setPercentage(pct);
    setAmount(Math.round((pct / 100) * availableBalance));
  };

  const handleAmountChange = (value: string) => {
    const numValue = parseFloat(value) || 0;
    setAmount(numValue);
    setPercentage(Math.round((numValue / availableBalance) * 100));
  };

  const handleAllocate = () => {
    createAllocation.mutate(
      { subscriptionId, modelId, amount },
      { onSuccess: () => onOpenChange(false) }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Allocate Funds to {modelName}
          </DialogTitle>
          <DialogDescription>
            Allocate paper trading money to mirror this model's trades.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Available Balance */}
          <div className="p-4 bg-muted rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Available Balance</span>
              <span className="text-lg font-bold">${availableBalance.toLocaleString()}</span>
            </div>
          </div>

          {/* Amount Slider */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Allocation Amount</Label>
              <span className="text-sm text-muted-foreground">{percentage}% of available</span>
            </div>
            <Slider
              value={[percentage]}
              min={1}
              max={100}
              step={1}
              onValueChange={handlePercentageChange}
            />
          </div>

          {/* Amount Input */}
          <div className="space-y-2">
            <Label htmlFor="amount">Amount ($)</Label>
            <Input
              id="amount"
              type="number"
              value={amount}
              onChange={(e) => handleAmountChange(e.target.value)}
              min={0}
              max={availableBalance}
            />
          </div>

          {/* Warning if allocating large amount */}
          {percentage > 50 && (
            <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
              <AlertCircle className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-yellow-600 dark:text-yellow-400">
                You're allocating more than 50% of your available balance to this model. 
                Consider diversifying across multiple models.
              </p>
            </div>
          )}

          {/* Expected Behavior */}
          <div className="p-4 border rounded-lg space-y-2">
            <h4 className="font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              How it works
            </h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Your allocation mirrors the model's trades proportionally</li>
              <li>• Trades are executed automatically on your paper account</li>
              <li>• You can adjust or remove allocation at any time</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleAllocate} 
            disabled={amount <= 0 || amount > availableBalance || createAllocation.isPending}
          >
            {createAllocation.isPending ? 'Allocating...' : `Allocate $${amount.toLocaleString()}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
