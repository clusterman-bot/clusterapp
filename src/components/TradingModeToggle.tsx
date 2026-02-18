import { useTradingMode } from '@/hooks/useTradingMode';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, TestTube2 } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export function TradingModeToggle() {
  const { mode, setMode, isPaper, isLive } = useTradingMode();

  return (
    <div data-tour="trading-mode-toggle" className="flex items-center gap-2 p-2 sm:p-3 rounded-lg border bg-card shrink-0">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-2">
              {isPaper ? (
                <TestTube2 className="h-4 w-4 text-blue-500" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-amber-500" />
              )}
              <Label htmlFor="trading-mode" className="text-xs sm:text-sm font-medium cursor-pointer hidden xs:block sm:block">
                {isPaper ? 'Paper Trading' : 'Live Trading'}
              </Label>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>{isPaper 
              ? 'Using simulated money - no real trades' 
              : 'Real money - trades execute on Alpaca'
            }</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      
      <Switch
        id="trading-mode"
        checked={isLive}
        onCheckedChange={(checked) => setMode(checked ? 'live' : 'paper')}
        className="data-[state=checked]:bg-amber-500"
      />
      
      <Badge 
        variant={isPaper ? 'secondary' : 'destructive'}
        className={isPaper ? 'bg-blue-500/10 text-blue-600 border-blue-500/20' : ''}
      >
        {isPaper ? 'PAPER' : 'LIVE'}
      </Badge>
    </div>
  );
}

export function TradingModeIndicator() {
  const { isPaper, isLive } = useTradingMode();

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
