
# Setting the First Alpha Account + Role Management in the Alpha Dashboard

## Part 1: How to Set the First Alpha Account (Bootstrap Problem)

Since Alpha is the top-level role and no one has it yet, the first Alpha must be assigned directly via the database SQL editor. There is no circular dependency — `has_alpha_role()` simply checks `user_roles`, and inserting directly via SQL bypasses RLS entirely (service role has no RLS restrictions).

### Steps to assign Alpha to your account:

1. Open the backend via **Lovable Cloud → Cloud View → Run SQL**
2. First, find your user ID by running:
   ```sql
   SELECT id, username FROM profiles WHERE username = 'your_username_here';
   ```
3. Then insert the Alpha role (replace the UUID):
   ```sql
   INSERT INTO public.user_roles (user_id, role)
   VALUES ('your-user-uuid-here', 'alpha')
   ON CONFLICT (user_id, role) DO NOTHING;
   ```
   If the user already has a different role (e.g. `developer`), update it instead:
   ```sql
   UPDATE public.user_roles
   SET role = 'alpha'
   WHERE user_id = 'your-user-uuid-here';
   ```

This is a one-time bootstrap operation. After that, any Alpha account can manage all other roles directly from the Alpha Dashboard UI (the new feature below).

---

## Part 2: Role Management UI in the Alpha Dashboard

The Alpha Dashboard currently shows each user's role as a read-only badge. We need to add a role change dropdown per user so Alpha accounts can promote/demote anyone (including assigning the `alpha` role to others).

### What changes:

**`src/hooks/useAlpha.tsx`** — Add a `useSetRoleForUser` mutation hook:
- Calls upsert on `user_roles` with the target `userId` and new `role`
- On success, invalidates `['alpha', 'all-users']` so the user list refreshes
- The RLS policies already allow Alpha to insert/update/delete any role

**`src/pages/AlphaDashboard.tsx`** — Add a role selector to each user row in the User Moderation tab:
- A `<Select>` dropdown showing `developer`, `retail_trader`, `admin`, `alpha` options
- Current role is pre-selected
- On change, shows a confirmation `<AlertDialog>` before applying ("Change @username's role to Alpha?")
- After confirmation, calls `useSetRoleForUser`
- The Alpha user's own row shows the selector as disabled (can't demote yourself)
- A small `UserCog` icon next to each role badge opens the selector clearly

### Behavior details:

| Action | Result |
|---|---|
| Alpha sets a user to `alpha` | User gets full Alpha access immediately after next login/refresh |
| Alpha sets a user to `admin` | User gets admin dashboard access |
| Alpha tries to change their own role | Selector is disabled with a tooltip: "Cannot change your own role" |
| User has no role yet | Selector shows placeholder "Assign role..." and on change performs an INSERT |
| User already has a role | On change performs an UPDATE |

### Technical implementation:

The `useSetRoleForUser` hook will:
```typescript
mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
  // Check if user already has a role
  const { data: existing } = await supabase
    .from('user_roles')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  if (existing) {
    // UPDATE existing role
    const { error } = await supabase
      .from('user_roles')
      .update({ role })
      .eq('user_id', userId);
    if (error) throw error;
  } else {
    // INSERT new role
    const { error } = await supabase
      .from('user_roles')
      .insert({ user_id: userId, role });
    if (error) throw error;
  }
}
```

The Alpha Dashboard user row will add a role selector next to the existing mute/freeze buttons, with an `AlertDialog` confirming any role change — especially promoting to `alpha` which shows a stronger warning.

### Files to change:
- `src/hooks/useAlpha.tsx` — Add `useSetRoleForUser` mutation
- `src/pages/AlphaDashboard.tsx` — Add role selector dropdown with confirmation dialog per user row
