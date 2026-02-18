
# AI Bot Builder: Custom Indicators via Generated Code + Model Upload

## Understanding the Current Architecture

The system is fully hardcoded end-to-end across three layers:

1. **AI layer** (`ai-strategy-builder` edge function): The system prompt tells the AI it only has 5 indicators (RSI, SMA, EMA, Bollinger, SMA Deviation), and the tool schema enforces exactly those 5 keys in the `indicators` object.

2. **Execution layer** (`stock-monitor` edge function): The `generateSignals()` function has 5 hardcoded `if (indicators.X?.enabled)` blocks. Anything outside those 5 is ignored at runtime.

3. **UI layer** (`AIBotBuilder.tsx`, `StockAutomationConfig.tsx`): Only renders those 5 indicators with hardcoded toggle switches.

The `indicators` column in `stock_automations` is JSONB, so it can store arbitrary keys — the database doesn't block custom data. The bottleneck is the execution engine.

## What Needs to Change

### The Core Concept: "Custom Code Block" Indicator

When a user asks for an indicator the platform doesn't natively support (e.g., MACD, VWAP, Stochastic, ATR, Williams %R, Ichimoku Cloud, CCI, etc.), the AI should generate JavaScript calculation code that runs inside the signal engine alongside the native indicators. This code block receives the price bar data and returns a vote (+1, -1, or 0).

This is the "closed container" concept — the AI writes a self-contained function that computes the indicator from raw OHLCV data.

### Model Upload

A separate "Upload Model" tab or button in the AI Bot Builder page where users can upload a `.json` or `.js` file containing a pre-defined strategy configuration. The uploaded file is parsed, validated, displayed in the config preview window on the right, and deployed the same way as AI-generated configs.

---

## Plan of Changes

### 1. Update the `ai-strategy-builder` edge function

**New system prompt** tells the AI:
- It can use ANY technical indicator the user requests
- For the 5 built-in indicators, it uses the structured config as before
- For any indicator NOT in the built-in list, it generates a `custom_indicators` array where each entry has:
  - `name`: display name (e.g., "MACD", "VWAP", "Stochastic %K")
  - `description`: what the indicator does
  - `signal_logic`: a plain-English explanation of the buy/sell logic
  - `code`: a JavaScript function string `(bars) => number` that accepts the bars array (each bar has `.o`, `.h`, `.l`, `.c`, `.v`) and returns `+1` (buy), `-1` (sell), or `0` (neutral)
  - `weight`: 1.0 by default (relative weight in composite score)

**Updated tool schema** adds `custom_indicators` as an optional array field in `generate_strategy`.

The AI is instructed to write safe, self-contained JS — no imports, no network calls, pure computation from the bars array.

### 2. Update `stock-monitor` edge function

Add a `runCustomIndicators` function that:
- Receives the `custom_indicators` array from the automation config
- For each custom indicator, runs `new Function('bars', code)(bars)` inside a try/catch — this is the "closed container"
- Clamps the return value to `[-1, 0, 1]`
- Pushes the result as an `IndicatorVote` exactly like native indicators do

The `indicators` JSONB column already stores the built-in config. The `custom_indicators` array is stored there too as `indicators.custom` (no schema change needed since it's JSONB).

**Safety**: The custom function runs with `new Function()` which is sandboxed within the Deno edge function environment — no DOM, no global state, no network. We wrap every execution in try/catch with a timeout guard.

### 3. Update `StrategyConfig` type in `AIBotBuilder.tsx`

Add `custom_indicators` field to the `StrategyConfig` interface:

```typescript
custom_indicators?: Array<{
  name: string;
  description: string;
  signal_logic: string;
  code: string;
  weight: number;
  enabled: boolean;
}>;
```

### 4. Update `AIBotBuilder.tsx` — Config Preview Panel

In the Generated Config card, below the 5 built-in indicator toggles, add a new section: **"Custom Indicators"**. For each entry in `config.custom_indicators`:

- Show a card/pill with a `Code2` icon, the indicator name, and the description
- A toggle switch to enable/disable it
- An expandable code block (collapsible) showing the generated JS code with syntax highlighting (monospaced, dark background) — this is the "closed container" view
- A "Signal Logic" line showing what buy/sell condition it uses in plain English

This makes it visually clear these are AI-generated calculations distinct from the built-in indicators.

### 5. Add "Upload Model" tab to `AIBotBuilder.tsx`

Add a second tab in the right panel (alongside the config preview):

**"Upload Model" tab:**
- A dropzone (or file input button) accepting `.json` files
- On file upload, parse the JSON and validate it has the required strategy config shape
- Display a read-only preview of what was uploaded: symbol, strategy summary, which indicators are enabled, risk parameters
- "Deploy Uploaded Model" button at the bottom
- Error handling if the JSON is invalid or missing required fields

The uploaded JSON format is the same `StrategyConfig` shape the AI generates, so users can save and re-upload strategies.

---

## Files to Change

### Backend (Edge Functions)

**`supabase/functions/ai-strategy-builder/index.ts`**
- Rewrite `SYSTEM_PROMPT` to explain custom indicators and when to use them
- Add `custom_indicators` array to `STRATEGY_TOOL` schema (optional field)
- Pass through `custom_indicators` in the response config

**`supabase/functions/stock-monitor/index.ts`**
- Add `runCustomIndicators(bars, customIndicators)` function after the built-in indicator block
- Call it in `generateSignals()` — results feed into the same `votes` array
- Add try/catch per custom indicator to prevent one bad function from blocking the whole signal

### Frontend

**`src/pages/AIBotBuilder.tsx`**
- Add `custom_indicators` to `StrategyConfig` interface
- Add "Custom Indicators" section in the config preview panel showing code blocks
- Add a second tab "Upload Model" with a file dropzone + preview + deploy button
- Pass `custom_indicators` through to `upsertMutation` so it's stored in the `indicators` JSONB column as `indicators.custom`

**No database migrations needed** — `indicators` is already JSONB and can store the custom array.

---

## How Custom Indicator Storage Works (No Schema Change)

The `indicators` JSONB column currently looks like:
```json
{
  "rsi": { "enabled": true, "periods": [14] },
  "sma": { "enabled": false, "windows": [5, 20] },
  ...
}
```

With custom indicators, it becomes:
```json
{
  "rsi": { "enabled": false, "periods": [14] },
  "sma": { "enabled": false, "windows": [5, 20] },
  "ema": { "enabled": false, "windows": [5, 20] },
  "bollinger": { "enabled": false, "window": 20, "std": 2 },
  "sma_deviation": { "enabled": false, "window": 20 },
  "custom": [
    {
      "name": "MACD",
      "description": "Moving Average Convergence Divergence",
      "signal_logic": "Buy when MACD line crosses above signal line, sell when it crosses below",
      "code": "(bars) => { const closes = bars.map(b => b.c); ... return signal; }",
      "weight": 1.0,
      "enabled": true
    }
  ]
}
```

The `stock-monitor` reads `indicators.custom` and executes each enabled entry.

---

## What the User Sees

**Asking for a built-in indicator (SMA):**
- AI generates normal config with `sma.enabled = true`
- Config panel shows the SMA toggle as usual

**Asking for an indicator NOT in the system (MACD, VWAP, Stochastic):**
- AI detects this isn't a built-in indicator
- Generates a custom code block and puts it in `custom_indicators`
- Config panel shows a new "Custom Indicators" section with the indicator name, description, the generated JS code in a collapsible code box, and the signal logic explanation
- User can toggle it on/off and see exactly what code will run

**Uploading a model:**
- User clicks "Upload Model" tab, drops a `.json` file
- The config preview populates with the uploaded strategy
- "Deploy Uploaded Model" button saves it to their account

---

## Example of AI-Generated Custom Indicator Code

For "MACD with signal line crossover":
```javascript
(bars) => {
  const closes = bars.map(b => b.c);
  if (closes.length < 35) return 0;
  const ema = (data, period) => {
    const k = 2 / (period + 1);
    let e = data.slice(0, period).reduce((a, b) => a + b) / period;
    for (let i = period; i < data.length; i++) e = data[i] * k + e * (1 - k);
    return e;
  };
  const macd = ema(closes, 12) - ema(closes, 26);
  const prevMacd = ema(closes.slice(0, -1), 12) - ema(closes.slice(0, -1), 26);
  const signal9 = ema([prevMacd, macd], 9);
  if (macd > signal9 && prevMacd <= signal9) return 1;
  if (macd < signal9 && prevMacd >= signal9) return -1;
  return 0;
}
```

This runs inside the Deno edge function environment in an isolated `new Function()` call — pure computation, no side effects.
