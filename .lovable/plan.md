
## Adding a "Create Model" Button to the Community Models Tab

### The Problem

There are two compounding issues:

1. The Community "Models" tab shows published models but has no button for users to create and publish their own model.
2. The `ModelBuilder` page (which is the full model creation UI) is **not registered as a route** in `App.tsx` — so even if a button existed, navigating to it would hit a 404. Additionally, `ModelBuilder` restricts access to users with the `developer` role, but the Onboarding flow auto-assigns everyone the `retail_trader` role, permanently locking them out.

### The Fix — Three Changes

**1. Register the ModelBuilder route in `App.tsx`**

Add `<Route path="/models/new" element={<ModelBuilder />} />` so the page is reachable.

**2. Open model creation to all verified, logged-in users**

In `src/pages/ModelBuilder.tsx`, remove the hard block that redirects non-`developer` roles. Any signed-in, email-verified user should be able to create a model. The `admin` redirect can stay as-is (admins shouldn't build models).

**3. Add the "Create Model" button to the Community Models tab**

In `src/pages/Community.tsx`, add a header row above the model list inside the Models `TabsContent` with:

- A **"+ Create Model"** button (visible only to signed-in, email-verified users) that navigates to `/models/new`.
- If the user is **not signed in**: show the existing "Sign in" prompt card (already present).
- If the user is **signed in but unverified**: show a small note that email verification is needed before they can create a model (email verification banner already shown at the top).

The layout for the Models tab header will look like:

```text
[ Bot icon  Models tab content ]          [ + Create Model button ]
-------------------------------------------------------------------
  model card 1
  model card 2
  ...
```

### Files to Change

| File | Change |
|---|---|
| `src/App.tsx` | Add `/models/new` route pointing to `ModelBuilder` |
| `src/pages/ModelBuilder.tsx` | Remove role gate (keep admin redirect only) |
| `src/pages/Community.tsx` | Add "Create Model" button in Models tab header |

### Role / Access Rules

- **Guest (not logged in)**: See the model list + sign-in prompt. No create button shown.
- **Logged in, email unverified**: See the model list. No create button (email verification required first; the banner at the top already communicates this).
- **Logged in + email verified**: See the model list + "Create Model" button.
- **Admin**: Redirected away from ModelBuilder (existing behaviour preserved).

### No database changes needed

This is purely a routing and UI access fix.
