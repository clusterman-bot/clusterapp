import { usePublishModel } from '@/hooks/useModelStrategy';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Globe, Lock, AlertCircle } from 'lucide-react';

interface PublishToggleProps {
  modelId: string;
  isPublic: boolean;
  status: string;
  isOwner: boolean;
}

export function PublishToggle({ modelId, isPublic, status, isOwner }: PublishToggleProps) {
  const publishModel = usePublishModel();

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
