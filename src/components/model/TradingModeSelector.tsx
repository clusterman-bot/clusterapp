import { Badge } from '@/components/ui/badge';
import { AlertCircle, Shield, Zap, ChevronDown } from 'lucide-react';
import { BrokerageAccount } from '@/hooks/useBrokerageAccounts';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

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
  const activeAccounts = brokerageAccounts?.filter(a => a.is_active) ?? [];
  const paperAccounts = activeAccounts.filter(a => a.account_type === 'paper');
  const liveAccounts = activeAccounts.filter(a => a.account_type === 'live');
  const hasLive = liveAccounts.length > 0;
  const isLive = mode === 'live';

  const currentAccount = activeAccounts.find(a => a.account_type === mode);
  const getLabel = (a: BrokerageAccount) => {
    const suffix = a.account_id ? ` (…${a.account_id.slice(-4)})` : '';
    return `${a.broker_name}${suffix}`;
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
          <span className="text-sm font-medium">Trading Account</span>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <span className="text-xs">
                {currentAccount ? getLabel(currentAccount) : (isLive ? 'Live' : 'Paper')}
              </span>
              <Badge
                variant={isLive ? 'default' : 'secondary'}
                className={`text-[10px] ${isLive ? 'bg-green-500/20 text-green-500 border-green-500/30' : 'bg-blue-500/20 text-blue-500 border-blue-500/30'}`}
              >
                {isLive ? 'LIVE' : 'PAPER'}
              </Badge>
              <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            {paperAccounts.length > 0 && (
              <>
                <DropdownMenuLabel className="text-xs">Paper Accounts</DropdownMenuLabel>
                {paperAccounts.map((a) => (
                  <DropdownMenuItem key={a.id} onClick={() => onModeChange('paper')} className={mode === 'paper' ? 'bg-accent' : ''}>
                    {getLabel(a)}
                  </DropdownMenuItem>
                ))}
              </>
            )}
            {paperAccounts.length > 0 && liveAccounts.length > 0 && <DropdownMenuSeparator />}
            {liveAccounts.length > 0 && (
              <>
                <DropdownMenuLabel className="text-xs">Live Accounts</DropdownMenuLabel>
                {liveAccounts.map((a) => (
                  <DropdownMenuItem key={a.id} onClick={() => onModeChange('live')} className={mode === 'live' ? 'bg-accent' : ''}>
                    {getLabel(a)}
                  </DropdownMenuItem>
                ))}
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Mode description */}
      <p className="text-xs text-muted-foreground">
        {isLive
          ? 'Trades will execute with real money on your live Alpaca account.'
          : 'Trades will execute with simulated funds on your paper Alpaca account.'}
      </p>

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
