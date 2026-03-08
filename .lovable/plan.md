

# Floating AI Chatbot Widget

## Overview
Build a persistent chat widget (bottom-right corner) that enables full back-and-forth conversations with an AI assistant powered by Lovable AI. The bot will have context about the trading platform and help users with questions about trading, strategies, and platform features.

## Architecture

```text
┌─────────────────────────────────┐
│  ChatWidget (fixed bottom-right)│
│  ┌───────────────────────────┐  │
│  │  Message history (scroll) │  │
│  │  - User messages           │  │
│  │  - AI messages (streamed)  │  │
│  ├───────────────────────────┤  │
│  │  Input + Send button       │  │
│  └───────────────────────────┘  │
└─────────────────────────────────┘
         ↕ streaming SSE
┌─────────────────────────────────┐
│  Edge Function: chat-assistant  │
│  - System prompt (platform ctx) │
│  - Full conversation history    │
│  - Lovable AI Gateway (stream)  │
└─────────────────────────────────┘
```

## Implementation Plan

### 1. Edge Function: `supabase/functions/chat-assistant/index.ts`
- Accepts `{ messages }` array (full conversation history)
- Prepends a system prompt with platform context (trading strategies, automation, backtesting help)
- Streams response from Lovable AI Gateway using `google/gemini-3-flash-preview`
- Returns SSE stream for token-by-token rendering
- Handles 429/402 errors gracefully

### 2. Chat Widget Component: `src/components/ChatWidget.tsx`
- Fixed position bottom-right with a floating button (MessageCircle icon)
- Click toggles open/closed chat panel (~380px wide, ~500px tall)
- Conversation state held in React state (messages array)
- Streams AI responses token-by-token using SSE parsing
- Auto-scrolls to latest message
- Markdown rendering for AI responses via simple prose styling
- Loading indicator while AI is responding
- Mobile-responsive (full-width on small screens)

### 3. Integration: `src/App.tsx`
- Render `<ChatWidget />` globally inside the app (visible on all pages)

### 4. Config: `supabase/config.toml`
- Add `[functions.chat-assistant]` with `verify_jwt = false`

## Technical Details

- **No database needed** — conversation is ephemeral (session-only state)
- **Streaming** — SSE line-by-line parsing for real-time token display
- **System prompt** — Contextual knowledge about the platform: trading, backtesting, automation, model building
- **Model**: `google/gemini-3-flash-preview` for fast, capable responses

