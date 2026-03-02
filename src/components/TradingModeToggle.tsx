import { useTradingMode } from '@/hooks/useTradingMode';
import { useBrokerageAccounts } from '@/hooks/useBrokerageAccounts';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, TestTube2, ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

export function TradingModeToggle() {
  const { mode, setMode, isPaper } = useTradingMode();
  const { data: accounts } = useBrokerageAccounts();

  const activeAccounts = accounts?.filter(a => a.is_active) ?? [];
  const paperAccounts = activeAccounts.filter(a => a.account_type === 'paper');
  const liveAccounts = activeAccounts.filter(a => a.account_type === 'live');

  // Find the current account details
  const currentAccount = activeAccounts.find(a => a.account_type === mode);

  const getAccountLabel = (account: typeof activeAccounts[0]) => {
    const suffix = account.account_id ? ` (…${account.account_id.slice(-4)})` : '';
    return `${account.broker_name}${suffix}`;
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          data-tour="trading-mode-toggle"
          variant="outline"
          size="sm"
          className="gap-2 shrink-0"
        >
          {isPaper ? (
            <TestTube2 className="h-4 w-4 text-blue-500" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          )}
          <span className="hidden sm:inline text-xs font-medium">
            {currentAccount ? getAccountLabel(currentAccount) : (isPaper ? 'Paper' : 'Live')}
          </span>
          <Badge
            variant={isPaper ? 'secondary' : 'destructive'}
            className={`text-[10px] px-1.5 ${isPaper ? 'bg-blue-500/10 text-blue-600 border-blue-500/20' : ''}`}
          >
            {isPaper ? 'PAPER' : 'LIVE'}
          </Badge>
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {paperAccounts.length > 0 && (
          <>
            <DropdownMenuLabel className="text-xs text-muted-foreground flex items-center gap-1.5">
              <TestTube2 className="h-3 w-3" /> Paper Accounts
            </DropdownMenuLabel>
            {paperAccounts.map((account) => (
              <DropdownMenuItem
                key={account.id}
                onClick={() => setMode('paper')}
                className={mode === 'paper' ? 'bg-accent' : ''}
              >
                <span className="text-sm">{getAccountLabel(account)}</span>
                {mode === 'paper' && (
                  <Badge variant="secondary" className="ml-auto text-[10px] bg-blue-500/10 text-blue-600">
                    Active
                  </Badge>
                )}
              </DropdownMenuItem>
            ))}
          </>
        )}
        {paperAccounts.length > 0 && liveAccounts.length > 0 && <DropdownMenuSeparator />}
        {liveAccounts.length > 0 && (
          <>
            <DropdownMenuLabel className="text-xs text-muted-foreground flex items-center gap-1.5">
              <AlertTriangle className="h-3 w-3" /> Live Accounts
            </DropdownMenuLabel>
            {liveAccounts.map((account) => (
              <DropdownMenuItem
                key={account.id}
                onClick={() => setMode('live')}
                className={mode === 'live' ? 'bg-accent' : ''}
              >
                <span className="text-sm">{getAccountLabel(account)}</span>
                {mode === 'live' && (
                  <Badge variant="destructive" className="ml-auto text-[10px]">
                    Active
                  </Badge>
                )}
              </DropdownMenuItem>
            ))}
          </>
        )}
        {activeAccounts.length === 0 && (
          <DropdownMenuItem disabled className="text-xs text-muted-foreground">
            No accounts connected
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function TradingModeIndicator() {
  const { isPaper } = useTradingMode();

  return (
    <Badge
      variant={isPaper ? 'secondary' : 'destructive'}
      className={`${isPaper
        ? 'bg-blue-500/10 text-blue-600 border-blue-500/20 hover:bg-blue-500/20'
        : 'animate-pulse'
      }`}
    >
      {isPaper ? (
        <>
          <TestTube2 className="h-3 w-3 mr-1" />
          Paper
        </>
      ) : (
        <>
          <AlertTriangle className="h-3 w-3 mr-1" />
          LIVE
        </>
      )}
    </Badge>
  );
}
