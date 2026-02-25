import { useState, useRef } from 'react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  Bot, Send, Loader2, Rocket, RefreshCw, BarChart3, Settings2, 
  Sparkles, MessageSquare, Code2, ChevronDown, ChevronRight,
  Upload, FileJson, AlertTriangle, CheckCircle2, X, Store
} from 'lucide-react';
import { useUpsertAutomation } from '@/hooks/useStockAutomations';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { PostToMarketplaceDialog } from '@/components/automation/PostToMarketplaceDialog';
import { useTradingMode } from '@/hooks/useTradingMode';
import { BacktestPanel } from '@/components/backtest/BacktestPanel';
import { PlatformInsights, PlatformInsightsBadge } from '@/components/PlatformInsights';

interface CustomIndicator {
  name: string;
  description: string;
  signal_logic: string;
  code: string;
  weight: number;
  enabled: boolean;
}

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
  custom_indicators?: CustomIndicator[];
  rsi_oversold: number;
  rsi_overbought: number;
  horizon_minutes: number;
  theta: number;
  position_size_percent: number;
  max_quantity: number;
  stop_loss_percent: number;
  take_profit_percent: number;
  allow_shorting: boolean;
  // Self-improving bot settings
  self_improve_enabled?: boolean;
  min_win_rate?: number;
  max_drawdown_threshold?: number;
  max_consecutive_losses?: number;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const EXAMPLE_PROMPTS = [
  "Build a MACD crossover strategy on AAPL with a 5% stop loss",
  "Create a Stochastic RSI bot for TSLA with aggressive position sizing",
  "I want a VWAP mean-reversion strategy on SPY with tight risk management",
  "Build an ATR volatility breakout strategy on NVDA using 2x ATR stops",
];

function isValidStrategyConfig(obj: any): obj is StrategyConfig {
  return (
    obj &&
    typeof obj.symbol === 'string' &&
    typeof obj.strategy_summary === 'string' &&
    obj.indicators &&
    typeof obj.indicators.rsi === 'object' &&
    typeof obj.rsi_oversold === 'number' &&
    typeof obj.stop_loss_percent === 'number'
  );
}

export default function AIBotBuilder() {
  const { user } = useAuth();
  const { isPaper } = useTradingMode();
  const navigate = useNavigate();
  const upsertMutation = useUpsertAutomation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [config, setConfig] = useState<StrategyConfig | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const [expandedCodeBlocks, setExpandedCodeBlocks] = useState<Set<number>>(new Set());
  const [uploadedConfig, setUploadedConfig] = useState<StrategyConfig | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [rightPanelTab, setRightPanelTab] = useState<'config' | 'upload' | 'backtest'>('config');
  const [showMarketplaceDialog, setShowMarketplaceDialog] = useState(false);
  const [platformStrategies, setPlatformStrategies] = useState(0);

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
        setRightPanelTab('config');
        if (data.platform_strategies) setPlatformStrategies(data.platform_strategies);
        const customCount = data.config.custom_indicators?.length ?? 0;
        const customNote = customCount > 0
          ? ` I've also generated **${customCount} custom indicator${customCount > 1 ? 's' : ''}** with executable code for non-native calculations.`
          : '';
        const platformNote = data.platform_strategies > 0
          ? ` _(Enhanced with insights from ${data.platform_strategies} strategies built for ${data.config.symbol})_`
          : '';
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: `✅ Generated a **${data.config.strategy_summary}** for **${data.config.symbol}**.${customNote} Review the configuration and deploy when ready!${platformNote}` 
        }]);
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to generate strategy', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const buildIndicatorsPayload = (cfg: StrategyConfig) => {
    const base = { ...cfg.indicators } as any;
    if (cfg.custom_indicators && cfg.custom_indicators.length > 0) {
      base.custom = cfg.custom_indicators;
    }
    return base;
  };

  const handleDeploy = async (deployConfig?: StrategyConfig) => {
    const cfg = deployConfig || config;
    if (!cfg || !user) return;
    setIsDeploying(true);
    try {
      await upsertMutation.mutateAsync({
        symbol: cfg.symbol,
        indicators: buildIndicatorsPayload(cfg) as any,
        rsi_oversold: cfg.rsi_oversold,
        rsi_overbought: cfg.rsi_overbought,
        horizon_minutes: cfg.horizon_minutes,
        theta: cfg.theta,
        position_size_percent: cfg.position_size_percent,
        max_quantity: cfg.max_quantity,
        stop_loss_percent: cfg.stop_loss_percent,
        take_profit_percent: cfg.take_profit_percent,
        allow_shorting: cfg.allow_shorting,
        is_active: true,
        self_improve_enabled: cfg.self_improve_enabled ?? false,
        min_win_rate: cfg.min_win_rate ?? 0.40,
        max_drawdown_threshold: cfg.max_drawdown_threshold ?? 15,
        max_consecutive_losses: cfg.max_consecutive_losses ?? 5,
      });
      toast({ title: '🚀 Bot Deployed!', description: `${cfg.symbol} automation is now active.` });
      navigate(`/trade/stocks/${cfg.symbol}/automate`);
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

  const updateCustomIndicator = (index: number, field: keyof CustomIndicator, value: any) => {
    if (!config || !config.custom_indicators) return;
    const updated = [...config.custom_indicators];
    updated[index] = { ...updated[index], [field]: value };
    setConfig({ ...config, custom_indicators: updated });
  };

  const toggleCodeBlock = (index: number) => {
    setExpandedCodeBlocks(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    setUploadedConfig(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const parsed = JSON.parse(evt.target?.result as string);
        if (!isValidStrategyConfig(parsed)) {
          setUploadError('Invalid strategy file. Make sure it contains symbol, indicators, and risk parameters.');
          return;
        }
        // Normalize symbol to uppercase
        parsed.symbol = parsed.symbol.toUpperCase();
        setUploadedConfig(parsed);
      } catch {
        setUploadError('Could not parse JSON file. Please upload a valid strategy .json file.');
      }
    };
    reader.readAsText(file);
    // Reset input so the same file can be re-uploaded
    e.target.value = '';
  };

  const handleExportConfig = () => {
    if (!config) return;
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${config.symbol}_strategy.json`;
    a.click();
    URL.revokeObjectURL(url);
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

  const hasCustomIndicators = config?.custom_indicators && config.custom_indicators.length > 0;

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
            <p className="text-sm text-muted-foreground">Describe any strategy — AI generates and codes it, including custom indicators</p>
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
                {/* Platform Insights */}
                <PlatformInsights symbol={config?.symbol} />
                {/* Messages */}
                <div className="flex-1 overflow-y-auto space-y-3 mb-4">
                  {messages.length === 0 && (
                    <div className="text-center py-8 space-y-4">
                      <Sparkles className="h-10 w-10 text-primary/40 mx-auto" />
                      <p className="text-muted-foreground text-sm">Describe any trading strategy — built-in indicators or custom ones like MACD, VWAP, ATR, Stochastic</p>
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

          {/* Right Panel — Config + Upload Tabs */}
          <div className="space-y-4">
            <Tabs value={rightPanelTab} onValueChange={(v) => setRightPanelTab(v as 'config' | 'upload' | 'backtest')}>
              <TabsList className="w-full">
                <TabsTrigger value="config" className="flex-1 flex items-center gap-2">
                  <Settings2 className="h-3.5 w-3.5" /> Config
                </TabsTrigger>
                <TabsTrigger value="backtest" className="flex-1 flex items-center gap-2" disabled={!config}>
                  <BarChart3 className="h-3.5 w-3.5" /> Backtest
                </TabsTrigger>
                <TabsTrigger value="upload" className="flex-1 flex items-center gap-2">
                  <Upload className="h-3.5 w-3.5" /> Upload
                </TabsTrigger>
              </TabsList>

              {/* Config Tab */}
              <TabsContent value="config" className="mt-3">
                {config ? (
                  <>
                    <Card>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base flex items-center gap-2">
                            <Settings2 className="h-4 w-4" /> Configuration
                          </CardTitle>
                          <Badge variant="outline" className="text-xs">{config.symbol}</Badge>
                        </div>
                        <CardDescription className="text-xs">{config.strategy_summary}</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* Built-in Indicators */}
                        <div>
                          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Built-in Indicators</Label>
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

                        {/* Custom AI-Generated Indicators */}
                        {hasCustomIndicators && (
                          <>
                            <Separator />
                            <div>
                              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                                <Code2 className="h-3 w-3" /> AI-Generated Indicators
                                <Badge variant="secondary" className="text-xs ml-1">{config.custom_indicators!.length}</Badge>
                              </Label>
                              <p className="text-xs text-muted-foreground mt-1 mb-3">Custom code blocks generated by AI for non-native indicators</p>
                              <div className="space-y-3">
                                {config.custom_indicators!.map((ci, i) => (
                                  <div key={i} className="rounded-lg border border-border bg-muted/30 overflow-hidden">
                                    <div className="flex items-center justify-between p-3">
                                      <div className="flex items-center gap-2 min-w-0">
                                        <Code2 className="h-3.5 w-3.5 text-primary shrink-0" />
                                        <div className="min-w-0">
                                          <p className="text-sm font-medium truncate">{ci.name}</p>
                                          <p className="text-xs text-muted-foreground truncate">{ci.description}</p>
                                        </div>
                                      </div>
                                      <Switch
                                        checked={ci.enabled}
                                        onCheckedChange={v => updateCustomIndicator(i, 'enabled', v)}
                                        className="ml-3 shrink-0"
                                      />
                                    </div>
                                    <div className="px-3 pb-2">
                                      <p className="text-xs text-muted-foreground italic">{ci.signal_logic}</p>
                                    </div>
                                    <Collapsible
                                      open={expandedCodeBlocks.has(i)}
                                      onOpenChange={() => toggleCodeBlock(i)}
                                    >
                                      <CollapsibleTrigger asChild>
                                        <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-primary hover:text-primary/80 transition-colors w-full border-t border-border">
                                          {expandedCodeBlocks.has(i) ? (
                                            <ChevronDown className="h-3 w-3" />
                                          ) : (
                                            <ChevronRight className="h-3 w-3" />
                                          )}
                                          {expandedCodeBlocks.has(i) ? 'Hide' : 'Show'} generated code
                                        </button>
                                      </CollapsibleTrigger>
                                      <CollapsibleContent>
                                        <div className="bg-background border-t border-border">
                                          <pre className="text-xs p-3 overflow-x-auto font-mono text-foreground/80 max-h-48 overflow-y-auto leading-relaxed whitespace-pre-wrap break-words">
                                            <code>{ci.code}</code>
                                          </pre>
                                        </div>
                                      </CollapsibleContent>
                                    </Collapsible>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </>
                        )}

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

                        <Separator />

                        {/* Self-Improving Bot */}
                        <div>
                          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                            <Sparkles className="h-3 w-3" /> Self-Improving Bot
                          </Label>
                          <p className="text-xs text-muted-foreground mt-1 mb-3">Bot will auto-optimize when performance degrades past thresholds</p>
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-sm">Enable Self-Improvement</span>
                              <Switch checked={config.self_improve_enabled ?? false} onCheckedChange={v => updateConfig('self_improve_enabled', v)} />
                            </div>
                            {config.self_improve_enabled && (
                              <div className="space-y-3 pl-1">
                                <div>
                                  <Label className="text-xs">Min Win Rate</Label>
                                  <div className="flex items-center gap-2">
                                    <Slider value={[(config.min_win_rate ?? 0.40) * 100]} onValueChange={v => updateConfig('min_win_rate', v[0] / 100)} min={10} max={80} step={1} />
                                    <span className="text-xs font-mono w-8">{((config.min_win_rate ?? 0.40) * 100).toFixed(0)}%</span>
                                  </div>
                                </div>
                                <div>
                                  <Label className="text-xs">Max Drawdown</Label>
                                  <div className="flex items-center gap-2">
                                    <Slider value={[config.max_drawdown_threshold ?? 15]} onValueChange={v => updateConfig('max_drawdown_threshold', v[0])} min={5} max={50} step={1} />
                                    <span className="text-xs font-mono w-8">{config.max_drawdown_threshold ?? 15}%</span>
                                  </div>
                                </div>
                                <div>
                                  <Label className="text-xs">Max Consecutive Losses</Label>
                                  <div className="flex items-center gap-2">
                                    <Slider value={[config.max_consecutive_losses ?? 5]} onValueChange={v => updateConfig('max_consecutive_losses', v[0])} min={2} max={15} step={1} />
                                    <span className="text-xs font-mono w-8">{config.max_consecutive_losses ?? 5}</span>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                      <Button onClick={() => handleDeploy()} disabled={isDeploying} className="flex-1" size="lg">
                        {isDeploying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Rocket className="mr-2 h-4 w-4" />}
                        Deploy Bot
                      </Button>
                      <Button variant="secondary" onClick={() => setRightPanelTab('backtest')} size="lg">
                        <BarChart3 className="h-4 w-4 mr-2" /> Backtest
                      </Button>
                      <Button variant="outline" onClick={() => setShowMarketplaceDialog(true)} size="lg" disabled={isPaper} title={isPaper ? 'Switch to live trading to post to marketplace' : undefined}>
                        <Store className="h-4 w-4 mr-2" /> {isPaper ? 'Live Only' : 'Marketplace'}
                      </Button>
                      <Button variant="outline" onClick={handleExportConfig} size="lg">
                        <FileJson className="h-4 w-4 mr-2" /> Export
                      </Button>
                      <Button 
                        variant="outline" 
                        onClick={() => {
                          setPrompt('');
                          const textarea = document.querySelector('textarea');
                          textarea?.focus();
                        }}
                        size="lg"
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Marketplace Dialog */}
                    {config && (
                      <PostToMarketplaceDialog
                        open={showMarketplaceDialog}
                        onOpenChange={setShowMarketplaceDialog}
                        symbol={config.symbol}
                        automationConfig={buildIndicatorsPayload(config) as any}
                      />
                    )}
                  </>
                ) : (
                  <Card className="h-[560px] flex items-center justify-center">
                    <div className="text-center space-y-3 p-6">
                      <BarChart3 className="h-12 w-12 text-muted-foreground/30 mx-auto" />
                      <p className="text-muted-foreground text-sm">Your generated strategy config will appear here</p>
                      <p className="text-muted-foreground/60 text-xs">Describe a strategy in the chat to get started</p>
                    </div>
                  </Card>
                )}
              </TabsContent>

              {/* Backtest Tab */}
              <TabsContent value="backtest" className="mt-3">
                {config ? (
                  <BacktestPanel config={config} />
                ) : (
                  <Card className="h-[400px] flex items-center justify-center">
                    <div className="text-center space-y-3 p-6">
                      <BarChart3 className="h-12 w-12 text-muted-foreground/30 mx-auto" />
                      <p className="text-muted-foreground text-sm">Generate a strategy first to run a backtest</p>
                    </div>
                  </Card>
                )}
              </TabsContent>

              {/* Upload Tab */}
              <TabsContent value="upload" className="mt-3">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Upload className="h-4 w-4" /> Upload Strategy Model
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Import a previously exported .json strategy file to view and deploy it
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Dropzone */}
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
                    >
                      <FileJson className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" />
                      <p className="text-sm text-muted-foreground">Click to upload a strategy .json file</p>
                      <p className="text-xs text-muted-foreground/60 mt-1">Use the Export button on a generated config to get a compatible file</p>
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".json"
                      className="hidden"
                      onChange={handleFileUpload}
                    />

                    {/* Error */}
                    {uploadError && (
                      <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm">
                        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-medium">Invalid file</p>
                          <p className="text-xs opacity-80 mt-0.5">{uploadError}</p>
                        </div>
                        <button onClick={() => setUploadError(null)} className="ml-auto shrink-0">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    )}

                    {/* Uploaded Config Preview */}
                    {uploadedConfig && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/10 border border-primary/30 text-sm">
                          <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                          <p className="text-primary font-medium">Strategy file loaded</p>
                          <Badge variant="outline" className="ml-auto">{uploadedConfig.symbol}</Badge>
                        </div>

                        <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3 text-sm">
                          <div>
                            <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">Strategy</p>
                            <p>{uploadedConfig.strategy_summary}</p>
                          </div>
                          <Separator />
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <span className="text-muted-foreground">Stop Loss:</span>{' '}
                              <span className="font-mono text-destructive">{uploadedConfig.stop_loss_percent}%</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Take Profit:</span>{' '}
                              <span className="font-mono text-primary">+{uploadedConfig.take_profit_percent}%</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Position Size:</span>{' '}
                              <span className="font-mono">{uploadedConfig.position_size_percent}%</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Max Qty:</span>{' '}
                              <span className="font-mono">{uploadedConfig.max_quantity}</span>
                            </div>
                          </div>
                          <Separator />
                          <div>
                            <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-2">Active Indicators</p>
                            <div className="flex flex-wrap gap-1.5">
                              {uploadedConfig.indicators.rsi.enabled && <Badge variant="secondary">RSI</Badge>}
                              {uploadedConfig.indicators.sma.enabled && <Badge variant="secondary">SMA</Badge>}
                              {uploadedConfig.indicators.ema.enabled && <Badge variant="secondary">EMA</Badge>}
                              {uploadedConfig.indicators.bollinger.enabled && <Badge variant="secondary">Bollinger</Badge>}
                              {uploadedConfig.indicators.sma_deviation.enabled && <Badge variant="secondary">SMA Dev</Badge>}
                              {uploadedConfig.custom_indicators?.filter(ci => ci.enabled).map((ci, i) => (
                                <Badge key={i} variant="outline" className="flex items-center gap-1">
                                  <Code2 className="h-2.5 w-2.5" /> {ci.name}
                                </Badge>
                              ))}
                              {[
                                uploadedConfig.indicators.rsi.enabled,
                                uploadedConfig.indicators.sma.enabled,
                                uploadedConfig.indicators.ema.enabled,
                                uploadedConfig.indicators.bollinger.enabled,
                                uploadedConfig.indicators.sma_deviation.enabled,
                                ...(uploadedConfig.custom_indicators?.map(ci => ci.enabled) ?? [])
                              ].every(v => !v) && (
                                <span className="text-xs text-muted-foreground italic">No indicators enabled</span>
                              )}
                            </div>
                          </div>
                          {uploadedConfig.custom_indicators && uploadedConfig.custom_indicators.length > 0 && (
                            <>
                              <Separator />
                              <div>
                                <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-2 flex items-center gap-1">
                                  <Code2 className="h-3 w-3" /> Custom Indicators
                                </p>
                                <div className="space-y-2">
                                  {uploadedConfig.custom_indicators.map((ci, i) => (
                                    <div key={i} className="flex items-center gap-2">
                                      <div className={`h-1.5 w-1.5 rounded-full ${ci.enabled ? 'bg-green-500' : 'bg-muted-foreground/40'}`} />
                                      <span className="text-xs font-medium">{ci.name}</span>
                                      <span className="text-xs text-muted-foreground truncate">{ci.description}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </>
                          )}
                        </div>

                        <Button
                          onClick={() => handleDeploy(uploadedConfig)}
                          disabled={isDeploying}
                          className="w-full"
                          size="lg"
                        >
                          {isDeploying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Rocket className="mr-2 h-4 w-4" />}
                          Deploy Uploaded Model
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </main>
    </div>
  );
}
