

## Plan: Add Custom Indicator Support to Quick Build

### What changes

Expand the Quick Build AI analysis to optionally generate custom JavaScript indicators (beyond the 5 hardcoded native ones). The AI can write stock-specific calculations like VWAP, ATR, momentum oscillators, etc. using the `(bars) => number` signature that the platform's sandboxed execution already supports.

No real ML training changes (part 2 deferred until Polygon key is available).

### Changes

**1. Edge function (`supabase/functions/quick-build/index.ts`)**

- Update the system prompt to tell the AI it can also generate custom JavaScript indicators
- Add `custom_indicators` as an optional array in the `suggest_config` tool schema:
  ```
  custom_indicators: [{
    name: string,
    description: string,
    code: string  // must follow (bars) => number signature
  }]
  ```
- Pass custom indicators through to the `quick_build_runs` record (store them inside `indicators_config`)
- Include them in the training run's `indicators_enabled` field

**2. Frontend (`src/components/stock/QuickBuildPanel.tsx`)**

- In the "View Full Configuration" code block, display any custom indicators with their code
- Add a dedicated "Custom Indicators" section when present, showing each indicator's name, description, and code in a styled code block
- Show custom indicator count in the model comparison area if any were generated

### Technical Detail

The custom indicator schema addition sits alongside the existing native indicators in the tool call. The AI prompt will be updated to say:

> "You may also generate custom JavaScript indicators using the signature `(bars) => number` where bars is an array of `{date, open, high, low, close, volume}`. Use these for calculations not covered by the native indicators — e.g., VWAP, ATR, custom momentum, volume-price patterns."

The `custom_indicators` field is optional (`required` array stays unchanged), so existing behavior is preserved if the AI chooses not to generate any.

