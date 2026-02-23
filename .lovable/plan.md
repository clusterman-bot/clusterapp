

## Fix: Full Error Visibility in Marketing Bot Logs

### Two Issues

1. **Truncated error in UI**: The error column has `max-w-[200px] truncate`, so long error messages like `Failed to create IG media container: {"error":{"message":"An unexpected error...` get cut off and are unreadable.

2. **The IG error itself**: The Instagram API returned a transient `OAuthException` (code 2, `is_transient: true`) which means Instagram's servers had a temporary issue. This is not a bug in your code -- retrying should work. But making the full error visible will help you diagnose future issues.

### Plan

**File: `src/pages/AlphaDashboard.tsx`** (Error column in logs table)

- Remove `truncate` and `max-w-[200px]` from the error cell
- Replace with an expandable error display: show the first ~80 characters by default, with a "Show more" toggle that expands to show the full error message
- Format the error text with word-wrap so long JSON strings don't overflow the table
- Use a collapsible pattern so the table stays clean but full details are one click away

**File: `supabase/functions/instagram-marketing-bot/index.ts`** (Better error messages)

- In `postToInstagram()`, extract the meaningful parts from the Instagram API error response (error message, error type, error code) and format them into a cleaner error string instead of dumping raw JSON
- Example: `"IG API error (code 2): An unexpected error has occurred. Please retry your request later. (transient)"` instead of `"Failed to create IG media container: {"error":{"message":"An unexpected error..."}}`

### Technical Details

The error cell change:

```text
Current:  <TableCell className="text-xs text-destructive max-w-[200px] truncate">
New:      Expandable cell with:
          - Default: first ~80 chars + "..." + expand button
          - Expanded: full error with break-words styling
          - Uses local state per row to toggle
```

The edge function error formatting:

```text
Current:  throw new Error(`Failed to create IG media container: ${JSON.stringify(data)}`)
New:      Parse data.error object and throw:
          "IG API error (code X): <message> [type: <type>]"
          Falls back to full JSON if parsing fails
```

### Files to Modify

| File | Change |
|---|---|
| `src/pages/AlphaDashboard.tsx` | Replace truncated error cell with expandable error display |
| `supabase/functions/instagram-marketing-bot/index.ts` | Format IG API errors into readable strings |

No database changes needed.
