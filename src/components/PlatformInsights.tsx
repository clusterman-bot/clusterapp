import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Brain, TrendingUp, BarChart3 } from 'lucide-react';

interface PlatformInsightsData {
  symbol: string;
  total_entries: number;
  summary: {
    total_strategies: number;
    avg_sharpe: number | null;
    avg_win_rate: number | null;
    best_indicator_combo: Record<string, number> | null;
    common_pitfalls: string[];
  } | null;
}

interface PlatformInsightsProps {
  symbol: string | undefined;
}

export function PlatformInsights({ symbol }: PlatformInsightsProps) {
  const [data, setData] = useState<PlatformInsightsData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!symbol) {
      setData(null);
      return;
    }

    const fetchInsights = async () => {
      setLoading(true);
      try {
        const { data: result, error } = await supabase.functions.invoke('strategy-knowledge', {
          body: { action: 'query', symbol },
        });
        if (!error && result && result.total_entries > 0) {
          setData(result);
        } else {
          setData(null);
        }
      } catch {
        setData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchInsights();
  }, [symbol]);

  if (loading || !data || data.total_entries === 0) return null;

  const summary = data.summary;
  const topIndicators = summary?.best_indicator_combo
    ? Object.entries(summary.best_indicator_combo)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([k]) => k.toUpperCase())
    : [];

  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Brain className="h-4 w-4 text-primary" />
        <span className="text-xs font-semibold text-primary">Platform Intelligence</span>
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
          {data.total_entries} strategies
        </Badge>
      </div>
      
      <div className="grid grid-cols-2 gap-2 text-xs">
        {summary?.avg_sharpe !== null && summary?.avg_sharpe !== undefined && (
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <TrendingUp className="h-3 w-3" />
            <span>Avg Sharpe: <span className="font-medium text-foreground">{summary.avg_sharpe}</span></span>
          </div>
        )}
        {summary?.avg_win_rate !== null && summary?.avg_win_rate !== undefined && (
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <BarChart3 className="h-3 w-3" />
            <span>Avg Win: <span className="font-medium text-foreground">{(summary.avg_win_rate * 100).toFixed(1)}%</span></span>
          </div>
        )}
      </div>

      {topIndicators.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap">
          <span className="text-[10px] text-muted-foreground">Top:</span>
          {topIndicators.map((ind) => (
            <Badge key={ind} variant="outline" className="text-[10px] px-1.5 py-0">
              {ind}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

export function PlatformInsightsBadge({ totalStrategies, symbol }: { totalStrategies: number; symbol: string }) {
  if (totalStrategies === 0) return null;
  return (
    <span className="text-[10px] text-muted-foreground italic">
      Enhanced with insights from {totalStrategies} strategies built for {symbol}
    </span>
  );
}
