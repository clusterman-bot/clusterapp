

# AI Trading Bot Builder (QuantConnect-style)

Build a new "AI Bot Builder" feature where users describe a trading strategy in plain English, and AI generates the full model configuration, deploys it, and connects it to their Alpaca account for live/paper trading.

## How It Works

1. User opens the AI Bot Builder page
2. Types a prompt like: *"Build me a momentum strategy on AAPL that buys when RSI drops below 30 and sells when it goes above 70, with a 5% stop loss"*
3. AI parses the prompt and generates a complete trading model configuration (indicators, thresholds, risk parameters, ticker)
4. User reviews the generated config, tweaks if needed
5. One-click deploy to start live/paper automated trading

## What Gets Built

### 1. New Edge Function: `ai-strategy-builder`
- Receives the user's natural language prompt
- Calls Lovable AI (Gemini) with a system prompt that instructs it to extract structured trading parameters using tool calling
- Returns a structured config:
  - Ticker symbol(s)
  - Indicators to enable (RSI, SMA, EMA, Bollinger, SMA Deviation) with their parameters
  - Entry/exit thresholds (RSI overbought/oversold, theta, etc.)
  - Risk management (stop loss %, take profit %, position size %, max quantity)
  - Allow shorting (true/false)
  - Horizon minutes
- Validates the output before returning

### 2. New Page: `/trade/ai-builder` (AI Bot Builder)
- Chat-style interface with a prompt input
- User describes their strategy in plain English
- Shows a streaming "thinking" state while AI processes
- Displays the generated configuration in an editable card layout:
  - Ticker & timeframe section
  - Indicators section (toggles + parameter inputs)
  - Risk management section (sliders/inputs)
  - Allow shorting toggle
- "Deploy Bot" button that:
  - Creates a `stock_automations` row with the AI-generated config
  - Sets `is_active = true`
  - Navigates to the automation config page for that symbol
- "Refine" button to send a follow-up prompt adjusting the config

### 3. Route & Navigation
- Add route `/trade/ai-builder` in App.tsx
- Add an "AI Bot Builder" button/link in the Trade page navigation or as a prominent CTA

### 4. Conversation History
- Support multi-turn conversation so the user can say things like "make it more aggressive" or "add Bollinger Bands" and the AI adjusts the config
- Store messages in component state (no DB persistence needed)

## Technical Details

### Edge Function Structure (`supabase/functions/ai-strategy-builder/index.ts`)
- Uses `LOVABLE_API_KEY` (already configured) to call `https://ai.gateway.lovable.dev/v1/chat/completions`
- Model: `google/gemini-3-flash-preview`
- Uses tool calling to extract structured output with a `generate_strategy` tool definition
- System prompt instructs the AI about available indicators, valid parameter ranges, and the automation schema
- Handles 429/402 errors gracefully
- Non-streaming (structured output needed)

### Frontend Components
- `src/pages/AIBotBuilder.tsx` - Main page with chat + config preview
- Reuses existing UI components (Card, Input, Switch, Button, etc.)
- Uses the existing `useStockAutomations` hook to deploy the generated config
- Config preview mirrors the layout of `StockAutomationConfig.tsx` so users feel familiar

### Config.toml Update
- Add `[functions.ai-strategy-builder]` with `verify_jwt = false`

### Flow Diagram

The user flow is: Prompt -> AI generates config -> User reviews/edits -> Deploy -> Automation runs via existing `stock-monitor` and `run-automations` system

