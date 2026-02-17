import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { MainNav } from '@/components/MainNav';
import { BackButton } from '@/components/BackButton';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { 
  Bot, Send, Loader2, Rocket, RefreshCw, BarChart3, Settings2, 
  Sparkles, AlertTriangle, MessageSquare
} from 'lucide-react';
import { useUpsertAutomation } from '@/hooks/useStockAutomations';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface StrategyConfig {
  symbol: string;
  strategy_summary: string;
  indicators: {
    rsi: { enabled: boolean; periods: number[] };
    sma: { enabled: boolean; windows: number[] };
    ema: { enabled: boolean; windows: number[] };
    bollinger: { enabled: boolean; window: number; std: number };
    sma_deviation: { enabled: boolean; window: number };
  };
  rsi_oversold: number;
  rsi_overbought: number;
  horizon_minutes: number;
  theta: number;
  position_size_percent: number;
  max_quantity: number;
  stop_loss_percent: number;
  take_profit_percent: number;
  allow_shorting: boolean;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const EXAMPLE_PROMPTS = [
  "Build a momentum strategy on AAPL that buys when RSI drops below 30 and sells above 70, with a 5% stop loss",
  "Create an SMA crossover bot for TSLA using 5 and 20 period moving averages, aggressive position sizing",
  "I want a conservative Bollinger Band mean-reversion strategy on SPY with tight risk management",
  "Make a short-selling strategy on NVDA using EMA crossovers with 10% position size",
];

export default function AIBotBuilder() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const upsertMutation = useUpsertAutomation();

  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [config, setConfig] = useState<StrategyConfig | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);

  const sendPrompt = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMsg: ChatMessage = { role: 'user', content: text.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setPrompt('');
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('ai-strategy-builder', {
        body: { messages: newMessages },
      });

      if (error) throw error;

      if (data.error) {
        toast({ title: 'AI Error', description: data.error, variant: 'destructive' });
        setMessages(prev => [...prev, { role: 'assistant', content: data.error }]);
      } else if (data.type === 'message') {
        setMessages(prev => [...prev, { role: 'assistant', content: data.content }]);
      } else if (data.type === 'strategy') {
        setConfig(data.config);
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: `✅ Generated a **${data.config.strategy_summary}** for **${data.config.symbol}**. Review the configuration below and deploy when ready!` 
        }]);
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to generate strategy', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeploy = async () => {
    if (!config || !user) return;
    setIsDeploying(true);
    try {
      await upsertMutation.mutateAsync({
        symbol: config.symbol,
        indicators: config.indicators as any,
        rsi_oversold: config.rsi_oversold,
        rsi_overbought: config.rsi_overbought,
        horizon_minutes: config.horizon_minutes,
        theta: config.theta,
        position_size_percent: config.position_size_percent,
        max_quantity: config.max_quantity,
        stop_loss_percent: config.stop_loss_percent,
        take_profit_percent: config.take_profit_percent,
        allow_shorting: config.allow_shorting,
        is_active: true,
      });
      toast({ title: '🚀 Bot Deployed!', description: `${config.symbol} automation is now active.` });
      navigate(`/trade/stocks/${config.symbol}/automate`);
    } catch (err: any) {
      toast({ title: 'Deploy failed', description: err.message, variant: 'destructive' });
    } finally {
      setIsDeploying(false);
    }
  };

  const updateConfig = (field: string, value: any) => {
    if (!config) return;
    setConfig({ ...config, [field]: value });
  };

  const updateIndicator = (key: string, field: string, value: any) => {
    if (!config) return;
    setConfig({
      ...config,
      indicators: {
        ...config.indicators,
        [key]: { ...config.indicators[key as keyof typeof config.indicators], [field]: value },
      },
    });
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <MainNav />
        <main className="container py-6 text-center">
          <p className="text-muted-foreground">Please sign in to use the AI Bot Builder.</p>
          <Button onClick={() => navigate('/auth')} className="mt-4">Sign In</Button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <MainNav />
      <main className="container py-6 max-w-5xl">
        <div className="flex items-center gap-4 mb-6">
          <BackButton />
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Bot className="h-6 w-6 text-primary" />
              AI Bot Builder
            </h1>
            <p className="text-sm text-muted-foreground">Describe your strategy in plain English — AI builds and deploys it</p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Chat Panel */}
          <div className="space-y-4">
            <Card className="flex flex-col h-[600px]">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" /> Strategy Chat
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col overflow-hidden p-4 pt-0">
                {/* Messages */}
                <div className="flex-1 overflow-y-auto space-y-3 mb-4">
                  {messages.length === 0 && (
                    <div className="text-center py-8 space-y-4">
                      <Sparkles className="h-10 w-10 text-primary/40 mx-auto" />
                      <p className="text-muted-foreground text-sm">Describe your trading strategy and AI will generate the configuration</p>
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground font-medium">Try one of these:</p>
                        {EXAMPLE_PROMPTS.map((ep, i) => (
                          <button
                            key={i}
                            onClick={() => sendPrompt(ep)}
                            className="block w-full text-left text-xs p-2 rounded-md border border-border hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground"
                          >
                            "{ep}"
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {messages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                        msg.role === 'user' 
                          ? 'bg-primary text-primary-foreground' 
                          : 'bg-muted'
                      }`}>
                        {msg.content}
                      </div>
                    </div>
                  ))}
                  {isLoading && (
                    <div className="flex justify-start">
                      <div className="bg-muted rounded-lg px-3 py-2 flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" /> Generating strategy...
                      </div>
                    </div>
                  )}
                </div>

                {/* Input */}
                <div className="flex gap-2">
                  <Textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Describe your trading strategy..."
                    className="min-h-[44px] max-h-[100px] resize-none"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendPrompt(prompt);
                      }
                    }}
                  />
                  <Button onClick={() => sendPrompt(prompt)} disabled={!prompt.trim() || isLoading} size="icon" className="shrink-0">
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Config Preview Panel */}
          <div className="space-y-4">
            {config ? (
              <>
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Settings2 className="h-4 w-4" /> Generated Config
                      </CardTitle>
                      <Badge variant="outline" className="text-xs">{config.symbol}</Badge>
                    </div>
                    <CardDescription className="text-xs">{config.strategy_summary}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Indicators */}
                    <div>
                      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Indicators</Label>
                      <div className="mt-2 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm">RSI ({config.indicators.rsi.periods.join(', ')})</span>
                          <Switch checked={config.indicators.rsi.enabled} onCheckedChange={v => updateIndicator('rsi', 'enabled', v)} />
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm">SMA ({config.indicators.sma.windows.join(', ')})</span>
                          <Switch checked={config.indicators.sma.enabled} onCheckedChange={v => updateIndicator('sma', 'enabled', v)} />
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm">EMA ({config.indicators.ema.windows.join(', ')})</span>
                          <Switch checked={config.indicators.ema.enabled} onCheckedChange={v => updateIndicator('ema', 'enabled', v)} />
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Bollinger ({config.indicators.bollinger.window}, {config.indicators.bollinger.std}σ)</span>
                          <Switch checked={config.indicators.bollinger.enabled} onCheckedChange={v => updateIndicator('bollinger', 'enabled', v)} />
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm">SMA Deviation ({config.indicators.sma_deviation.window})</span>
                          <Switch checked={config.indicators.sma_deviation.enabled} onCheckedChange={v => updateIndicator('sma_deviation', 'enabled', v)} />
                        </div>
                      </div>
                    </div>

                    <Separator />

                    {/* RSI Thresholds */}
                    {config.indicators.rsi.enabled && (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs">RSI Oversold</Label>
                          <div className="flex items-center gap-2">
                            <Slider value={[config.rsi_oversold]} onValueChange={v => updateConfig('rsi_oversold', v[0])} min={10} max={50} step={1} />
                            <span className="text-xs font-mono w-6">{config.rsi_oversold}</span>
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs">RSI Overbought</Label>
                          <div className="flex items-center gap-2">
                            <Slider value={[config.rsi_overbought]} onValueChange={v => updateConfig('rsi_overbought', v[0])} min={50} max={90} step={1} />
                            <span className="text-xs font-mono w-6">{config.rsi_overbought}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Trading Params */}
                    <div>
                      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Risk Management</Label>
                      <div className="mt-2 grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs">Stop Loss</Label>
                          <div className="flex items-center gap-2">
                            <Slider value={[config.stop_loss_percent]} onValueChange={v => updateConfig('stop_loss_percent', v[0])} min={1} max={50} step={0.5} />
                            <span className="text-xs font-mono w-8">{config.stop_loss_percent}%</span>
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs">Take Profit</Label>
                          <div className="flex items-center gap-2">
                            <Slider value={[config.take_profit_percent]} onValueChange={v => updateConfig('take_profit_percent', v[0])} min={1} max={100} step={0.5} />
                            <span className="text-xs font-mono w-8">{config.take_profit_percent}%</span>
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs">Position Size</Label>
                          <div className="flex items-center gap-2">
                            <Slider value={[config.position_size_percent]} onValueChange={v => updateConfig('position_size_percent', v[0])} min={1} max={100} step={1} />
                            <span className="text-xs font-mono w-8">{config.position_size_percent}%</span>
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs">Max Qty</Label>
                          <Input type="number" min={1} max={1000} value={config.max_quantity} onChange={e => updateConfig('max_quantity', parseInt(e.target.value) || 10)} className="h-8 text-xs" />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Horizon (min)</Label>
                        <Input type="number" min={1} max={60} value={config.horizon_minutes} onChange={e => updateConfig('horizon_minutes', parseInt(e.target.value) || 5)} className="h-8 text-xs" />
                      </div>
                      <div>
                        <Label className="text-xs">Theta</Label>
                        <div className="flex items-center gap-2">
                          <Slider value={[config.theta * 100]} onValueChange={v => updateConfig('theta', v[0] / 100)} min={1} max={10} step={0.5} />
                          <span className="text-xs font-mono w-8">{config.theta.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-lg border border-destructive/30 bg-destructive/5">
                      <div>
                        <Label className="text-sm">Allow Short Selling</Label>
                        <p className="text-xs text-muted-foreground">Enable selling without owning shares</p>
                      </div>
                      <Switch checked={config.allow_shorting} onCheckedChange={v => updateConfig('allow_shorting', v)} />
                    </div>
                  </CardContent>
                </Card>

                {/* Action Buttons */}
                <div className="flex gap-2">
                  <Button onClick={handleDeploy} disabled={isDeploying} className="flex-1" size="lg">
                    {isDeploying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Rocket className="mr-2 h-4 w-4" />}
                    Deploy Bot
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setPrompt('');
                      const textarea = document.querySelector('textarea');
                      textarea?.focus();
                    }}
                  >
                    <RefreshCw className="mr-2 h-4 w-4" /> Refine
                  </Button>
                </div>
              </>
            ) : (
              <Card className="h-[600px] flex items-center justify-center">
                <div className="text-center space-y-3 p-6">
                  <BarChart3 className="h-12 w-12 text-muted-foreground/30 mx-auto" />
                  <p className="text-muted-foreground text-sm">Your generated strategy config will appear here</p>
                  <p className="text-muted-foreground/60 text-xs">Describe a strategy in the chat to get started</p>
                </div>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
