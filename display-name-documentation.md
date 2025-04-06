# Display Name System Documentation

## Overview

The display name system has been refactored to use a single source of truth. This document explains how the system works and how to properly use display names in the application.

## Single Source of Truth

The single source of truth for display names is:

```
public.users.display_name
```

This means:
- All UI components should ultimately get their display name data from this column
- Any changes to display names should update this column
- Database triggers will automatically sync this data to all necessary places

## How It Works

1. **Database Structure**:
   - `public.users.display_name` - Primary source of truth
   - `auth.users.user_metadata->>'display_name'` - For Auth UI display
   - `auth.users.raw_user_meta_data->>'display_name'` - Internal Supabase use
   - `auth.users.raw_app_meta_data->>'display_name'` - Internal app use

2. **Synchronization**:
   - The `sync_display_name_to_auth()` trigger function automatically updates all Auth metadata fields when the `public.users.display_name` changes
   - The `add_new_auth_user_to_public()` trigger function ensures new Auth users are automatically added to the public.users table

3. **User Registration**:
   - During signup, we set `display_name` in the Auth metadata
   - The system adds the user to `public.users` (either via our code or the trigger)
   - All display name fields remain in sync automatically

## How To Use Display Names

### In React Components

When displaying a user's name:

```tsx
// CORRECT - Use user_metadata in components that access Auth user data directly
const displayName = user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'Username';

// CORRECT - Use display_name from database queries
const { data: userData } = await supabase
  .from('users')
  .select('display_name')
  .eq('id', userId)
  .single();

const displayName = userData?.display_name || 'Username';
```

### When Updating Display Names

Always update the `public.users` table directly:

```tsx
// CORRECT - Update the single source of truth
const { error } = await supabase
  .from('users')
  .update({ display_name: newDisplayName })
  .eq('id', userId);

// INCORRECT - Don't update Auth metadata directly
// await supabase.auth.updateUser({ data: { display_name: newDisplayName } });
```

### During User Registration

Keep the registration logic simple:

```tsx
// In sign-up form
const { data, error } = await supabase.auth.signUp({
  email,
  password,
  options: {
    data: {
      display_name: username
    }
  }
});
```

## Benefits

- No more display name synchronization issues
- Simplified application logic
- Clear data ownership
- Consistent UI display of names 