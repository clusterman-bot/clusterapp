import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ModelSubscribeButton } from '@/components/ModelSubscribeButton';
import { TrendingUp, TrendingDown, Users, Shield, Wallet, BarChart3, Bot } from 'lucide-react';

interface ModelMarketplaceCardProps {
  model: {
    id: string;
    name: string;
    description: string | null;
    performance_fee_percent: number | null;
    total_return: number | null;
    sharpe_ratio: number | null;
    max_drawdown: number | null;
    win_rate: number | null;
    total_subscribers: number | null;
    min_allocation: number | null;
    max_allocation: number | null;
    max_exposure_percent: number | null;
    profiles: {
      id: string;
      username: string | null;
      display_name: string | null;
      avatar_url: string | null;
      is_verified: boolean | null;
    } | null;
    is_system?: boolean;
  };
}

export function ModelMarketplaceCard({ model }: ModelMarketplaceCardProps) {
  const navigate = useNavigate();
  const dev = model.profiles;
  const totalReturn = model.total_return ?? 0;
  const isPositive = totalReturn >= 0;

  return (
    <Card className="hover:border-primary/40 transition-colors">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          {/* Left: Info */}
          <div className="flex-1 min-w-0">
            <button
              className="text-left"
              onClick={() => navigate(`/models/${model.id}`)}
            >
              <h3 className="font-semibold text-base hover:text-primary transition-colors truncate">
                {model.name}
              </h3>
              {(model as any).is_system && (
                <Badge variant="secondary" className="text-xs gap-1 ml-2 shrink-0">
                  <Bot className="h-3 w-3" />
                  System Bot
                </Badge>
              )}
            </button>
            {model.description && (
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{model.description}</p>
            )}

            {/* Developer — hidden for system bots */}
            {dev && !(model as any).is_system && (
              <button
                className="flex items-center gap-2 mt-3 group"
                onClick={() => navigate(`/profile/${dev.id}`)}
              >
                <Avatar className="h-6 w-6">
                  <AvatarImage src={dev.avatar_url || undefined} />
                  <AvatarFallback className="text-xs">
                    {(dev.display_name || dev.username || '?')[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                  {dev.display_name || dev.username}
                </span>
                {dev.is_verified && (
                  <Shield className="h-3.5 w-3.5 text-primary" />
                )}
              </button>
            )}

            {/* Stats row */}
            <div className="flex flex-wrap gap-3 mt-4">
              <div className="flex items-center gap-1.5">
                {isPositive ? (
                  <TrendingUp className="h-4 w-4 text-profit" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-loss" />
                )}
                <span className={`text-sm font-medium ${isPositive ? 'text-profit' : 'text-loss'}`}>
                  {isPositive ? '+' : ''}{(totalReturn * 100).toFixed(1)}%
                </span>
                <span className="text-xs text-muted-foreground">return</span>
              </div>

              {model.sharpe_ratio != null && (
                <div className="flex items-center gap-1.5">
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{model.sharpe_ratio.toFixed(2)}</span>
                  <span className="text-xs text-muted-foreground">Sharpe</span>
                </div>
              )}

              {model.win_rate != null && (
                <div className="text-sm">
                  <span className="font-medium">{(model.win_rate * 100).toFixed(0)}%</span>
                  <span className="text-xs text-muted-foreground ml-1">win rate</span>
                </div>
              )}

              <div className="flex items-center gap-1.5">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{model.total_subscribers ?? 0}</span>
              </div>
            </div>

            {/* Allocation constraints */}
            <div className="flex flex-wrap gap-2 mt-3">
              <Badge variant="outline" className="text-xs gap-1">
                <Wallet className="h-3 w-3" />
                ${(model.min_allocation ?? 100).toLocaleString()} – ${(model.max_allocation ?? 10000).toLocaleString()} allocation
              </Badge>
              {model.max_exposure_percent != null && (
                <Badge variant="outline" className="text-xs">
                  Max {model.max_exposure_percent}% exposure
                </Badge>
              )}
            </div>
          </div>

          {/* Right: Subscribe */}
          <div className="flex-shrink-0">
            <ModelSubscribeButton
              modelId={model.id}
              modelName={model.name}
              performanceFee={model.performance_fee_percent ?? 0}
              minAllocation={model.min_allocation ?? 100}
              maxAllocation={model.max_allocation ?? 10000}
              size="sm"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
