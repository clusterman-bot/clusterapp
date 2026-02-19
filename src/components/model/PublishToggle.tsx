import { useEffect, useState } from 'react';
import { usePublishModel } from '@/hooks/useModelStrategy';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Globe, Lock, AlertCircle, Clock } from 'lucide-react';

// Market hours helper (9AM–4PM ET, Mon–Fri, DST-aware)
function getEasternOffset(now: Date): number {
  const year = now.getFullYear();
  const march = new Date(year, 2, 1);
  const marchDow = march.getDay();
  const firstSundayMarch = marchDow === 0 ? march : new Date(year, 2, 7 - marchDow);
  const dstStart = new Date(firstSundayMarch.getTime() + 7 * 24 * 3600 * 1000);
  const nov = new Date(year, 10, 1);
  const novDow = nov.getDay();
  const dstEnd = novDow === 0 ? nov : new Date(year, 10, 7 - novDow);
  return now >= dstStart && now < dstEnd ? -4 : -5;
}

function useMarketStatus() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    function check() {
      const now = new Date();
      const offset = getEasternOffset(now);
      const et = new Date(now.getTime() + offset * 3600 * 1000);
      const day = et.getUTCDay();
      const mins = et.getUTCHours() * 60 + et.getUTCMinutes();
      setOpen(day >= 1 && day <= 5 && mins >= 9 * 60 && mins < 16 * 60);
    }
    check();
    const id = setInterval(check, 60_000);
    return () => clearInterval(id);
  }, []);
  return open;
}

interface PublishToggleProps {
  modelId: string;
  isPublic: boolean;
  status: string;
  isOwner: boolean;
}

export function PublishToggle({ modelId, isPublic, status, isOwner }: PublishToggleProps) {
  const publishModel = usePublishModel();
  const marketOpen = useMarketStatus();

  const handleToggle = (checked: boolean) => {
    publishModel.mutate({ modelId, isPublic: checked });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            {isPublic ? <Globe className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
            Visibility
          </span>
          <Badge variant={status === 'published' ? 'default' : 'secondary'}>
            {status}
          </Badge>
        </CardTitle>
        <CardDescription>
          Control whether your model is visible in the marketplace.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="public-toggle" className="text-base">
              {isPublic ? 'Public' : 'Private'}
            </Label>
            <p className="text-sm text-muted-foreground">
              {isPublic 
                ? 'Anyone can view and subscribe to this model' 
                : 'Only you can see this model'}
            </p>
          </div>
          {isOwner && (
            <Switch
              id="public-toggle"
              checked={isPublic}
              onCheckedChange={handleToggle}
              disabled={publishModel.isPending}
            />
          )}
        </div>

        {isPublic && (
          <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
            <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <p className="text-sm text-muted-foreground flex-1">Trading status:</p>
            <Badge variant={marketOpen ? 'default' : 'secondary'} className={marketOpen ? 'bg-emerald-500/20 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/20' : ''}>
              {marketOpen ? 'Market Open — Active' : 'Market Closed — Paused until 9AM ET'}
            </Badge>
          </div>
        )}

        {!isPublic && isOwner && (
          <div className="flex items-start gap-2 p-3 bg-muted rounded-lg">
            <AlertCircle className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
            <p className="text-sm text-muted-foreground">
              Set your model to public to list it in the marketplace and allow 
              retail traders to subscribe and allocate funds.
            </p>
          </div>
        )}

        {isPublic && (
          <div className="grid grid-cols-2 gap-4 pt-2">
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <p className="text-2xl font-bold">0</p>
              <p className="text-xs text-muted-foreground">Subscribers</p>
            </div>
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <p className="text-2xl font-bold">$0</p>
              <p className="text-xs text-muted-foreground">Total AUM</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
