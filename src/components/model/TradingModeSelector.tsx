import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Shield, Zap } from 'lucide-react';
import { BrokerageAccount } from '@/hooks/useBrokerageAccounts';

interface TradingModeSelectorProps {
  mode: 'paper' | 'live';
  onModeChange: (mode: 'paper' | 'live') => void;
  brokerageAccounts: BrokerageAccount[] | undefined;
  isLoading?: boolean;
}

export function TradingModeSelector({
  mode,
  onModeChange,
  brokerageAccounts,
  isLoading,
}: TradingModeSelectorProps) {
  const hasLive = brokerageAccounts?.some(a => a.account_type === 'live' && a.is_active);
  const hasPaper = brokerageAccounts?.some(a => a.account_type === 'paper' && a.is_active);
  const isLive = mode === 'live';

  const handleToggle = (checked: boolean) => {
    const newMode = checked ? 'live' : 'paper';
    // Only allow switching to live if they have a live account
    if (newMode === 'live' && !hasLive) return;
    if (newMode === 'paper' && !hasPaper) return;
    onModeChange(newMode);
  };

  if (isLoading) return null;

  return (
    <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isLive ? (
            <Zap className="h-4 w-4 text-green-500" />
          ) : (
            <Shield className="h-4 w-4 text-blue-500" />
          )}
          <span className="text-sm font-medium">Trading Mode</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-medium ${!isLive ? 'text-blue-500' : 'text-muted-foreground'}`}>
            Paper
          </span>
          <Switch
            checked={isLive}
            onCheckedChange={handleToggle}
            disabled={!hasLive || !hasPaper}
          />
          <span className={`text-xs font-medium ${isLive ? 'text-green-500' : 'text-muted-foreground'}`}>
            Live
          </span>
        </div>
      </div>

      {/* Mode description */}
      <div className="flex items-start gap-2">
        <Badge variant={isLive ? 'default' : 'secondary'} className={`text-[10px] ${isLive ? 'bg-green-500/20 text-green-500 border-green-500/30' : 'bg-blue-500/20 text-blue-500 border-blue-500/30'}`}>
          {isLive ? 'LIVE' : 'PAPER'}
        </Badge>
        <p className="text-xs text-muted-foreground">
          {isLive
            ? 'Trades will execute with real money on your live Alpaca account.'
            : 'Trades will execute with simulated funds on your paper Alpaca account.'}
        </p>
      </div>

      {/* Warning if live */}
      {isLive && (
        <div className="flex items-start gap-2 p-2 bg-destructive/10 border border-destructive/20 rounded-md">
          <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
          <p className="text-xs text-destructive">
            Real money will be used. Losses are permanent.
          </p>
        </div>
      )}

      {/* No live account hint */}
      {!hasLive && (
        <p className="text-xs text-muted-foreground italic">
          Connect a live brokerage account to enable live trading.
        </p>
      )}
    </div>
  );
}
