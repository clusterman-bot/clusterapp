

# Redesign Profile Edit Dialog and Remove Account Type

## Problem
1. The profile edit dialog is too tall for the screen -- it has too many fields stacked vertically in a single scrollable column.
2. The "Account Type" concept (Developer / Trader badge) should be removed from the profile header, the About tab, and the onboarding role selection step.

## Changes

### 1. Redesign the Edit Profile Dialog (`src/pages/Profile.tsx`)

Replace the current tall single-column form with a more compact layout:
- Use a **tabbed layout inside the dialog** with two tabs: "Profile" and "Social Links"
- **Profile tab**: Display Name, Username, Bio (reduced to 2 rows), Experience Level -- all compact
- **Social Links tab**: Twitter, GitHub, LinkedIn, Website in a clean 2-column grid
- Remove Trading Philosophy from the edit dialog (it's rarely used and adds height)
- Add `max-h-[80vh] overflow-y-auto` to the dialog content as a safety net
- This cuts the dialog height roughly in half

### 2. Remove Account Type Badge from Profile Header (lines 300-302)

Remove the `<Badge>` that shows "Admin", "Trader", or "Developer" next to the user's name in the profile header.

### 3. Remove Account Type from About Tab (lines 676-684)

Remove the "Account Type" section with the Briefcase icon from the About tab.

### 4. Remove Role Badge from UserProfileSidebar (`src/components/UserProfileSidebar.tsx`)

Remove the role badge (Developer/Trader/Admin) and the related imports (`useUserRole`, role display logic, `Code`, `LineChart`, `Settings` icons).

### 5. Remove Role Selection from Onboarding (`src/pages/Onboarding.tsx`)

- Remove the "Role" step entirely from the 3-step onboarding flow (Username -> Role -> Social becomes Username -> Social)
- Default all new users to the `retail_trader` role automatically (set during username submission)
- Update the progress indicator from 3 dots to 2
- Remove the role selection cards UI

### Files Modified
- `src/pages/Profile.tsx` -- Redesign edit dialog, remove role badge from header and About tab
- `src/components/UserProfileSidebar.tsx` -- Remove role badge
- `src/pages/Onboarding.tsx` -- Remove role step, auto-assign retail_trader

### Technical Notes
- The `user_roles` table and hooks remain intact for existing users and admin functionality
- New users will silently get `retail_trader` role during onboarding
- No database changes needed

