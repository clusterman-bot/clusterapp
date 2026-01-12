import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { IndicatorsConfig as IndicatorsConfigType } from '@/hooks/useMLTraining';
import { TrendingUp, Activity, BarChart3, Gauge, LineChart } from 'lucide-react';

interface IndicatorsConfigProps {
  config: IndicatorsConfigType;
  onChange: (config: IndicatorsConfigType) => void;
}

export function IndicatorsConfig({ config, onChange }: IndicatorsConfigProps) {
  const updateIndicator = (key: keyof IndicatorsConfigType, value: any) => {
    onChange({
      ...config,
      [key]: { ...config[key], ...value },
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          Technical Indicators
        </CardTitle>
        <CardDescription>
          Select which indicators to calculate for your model's features
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* SMA */}
        <div className="flex items-start justify-between gap-4 p-4 rounded-lg border">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <Label className="font-medium">Simple Moving Average (SMA)</Label>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Average closing price over specified windows
            </p>
            {config.sma.enabled && (
              <div className="mt-3">
                <Label className="text-xs text-muted-foreground">Windows (comma-separated)</Label>
                <Input
                  className="mt-1"
                  value={config.sma.windows.join(', ')}
                  onChange={(e) => {
                    const windows = e.target.value
                      .split(',')
                      .map((w) => parseInt(w.trim()))
                      .filter((w) => !isNaN(w) && w > 0);
                    updateIndicator('sma', { windows });
                  }}
                  placeholder="5, 10, 20, 50"
                />
              </div>
            )}
          </div>
          <Switch
            checked={config.sma.enabled}
            onCheckedChange={(enabled) => updateIndicator('sma', { enabled })}
          />
        </div>

        {/* RSI */}
        <div className="flex items-start justify-between gap-4 p-4 rounded-lg border">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Gauge className="h-4 w-4 text-muted-foreground" />
              <Label className="font-medium">Relative Strength Index (RSI)</Label>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Momentum oscillator measuring speed of price changes
            </p>
            {config.rsi.enabled && (
              <div className="mt-3">
                <Label className="text-xs text-muted-foreground">Period</Label>
                <Input
                  className="mt-1 w-24"
                  type="number"
                  value={config.rsi.period}
                  onChange={(e) => updateIndicator('rsi', { period: parseInt(e.target.value) || 14 })}
                  min={2}
                  max={100}
                />
              </div>
            )}
          </div>
          <Switch
            checked={config.rsi.enabled}
            onCheckedChange={(enabled) => updateIndicator('rsi', { enabled })}
          />
        </div>

        {/* Bollinger Bands */}
        <div className="flex items-start justify-between gap-4 p-4 rounded-lg border">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              <Label className="font-medium">Bollinger Bands</Label>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Volatility bands above and below a moving average
            </p>
            {config.bollinger.enabled && (
              <div className="mt-3 flex gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Window</Label>
                  <Input
                    className="mt-1 w-20"
                    type="number"
                    value={config.bollinger.window}
                    onChange={(e) => updateIndicator('bollinger', { window: parseInt(e.target.value) || 20 })}
                    min={5}
                    max={100}
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Std Dev</Label>
                  <Input
                    className="mt-1 w-20"
                    type="number"
                    step="0.5"
                    value={config.bollinger.std}
                    onChange={(e) => updateIndicator('bollinger', { std: parseFloat(e.target.value) || 2 })}
                    min={0.5}
                    max={5}
                  />
                </div>
              </div>
            )}
          </div>
          <Switch
            checked={config.bollinger.enabled}
            onCheckedChange={(enabled) => updateIndicator('bollinger', { enabled })}
          />
        </div>

        {/* Volatility */}
        <div className="flex items-start justify-between gap-4 p-4 rounded-lg border">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <Label className="font-medium">Historical Volatility</Label>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Rolling standard deviation of returns
            </p>
            {config.volatility.enabled && (
              <div className="mt-3">
                <Label className="text-xs text-muted-foreground">Window</Label>
                <Input
                  className="mt-1 w-24"
                  type="number"
                  value={config.volatility.window}
                  onChange={(e) => updateIndicator('volatility', { window: parseInt(e.target.value) || 20 })}
                  min={5}
                  max={100}
                />
              </div>
            )}
          </div>
          <Switch
            checked={config.volatility.enabled}
            onCheckedChange={(enabled) => updateIndicator('volatility', { enabled })}
          />
        </div>

        {/* SMA Deviation */}
        <div className="flex items-start justify-between gap-4 p-4 rounded-lg border">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <LineChart className="h-4 w-4 text-muted-foreground" />
              <Label className="font-medium">SMA Deviation</Label>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Percentage deviation of price from SMA
            </p>
          </div>
          <Switch
            checked={config.sma_deviation.enabled}
            onCheckedChange={(enabled) => updateIndicator('sma_deviation', { enabled })}
          />
        </div>
      </CardContent>
    </Card>
  );
}
