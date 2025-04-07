-- Migration: create_get_user_notifications_function.sql
-- Creates a function to fetch all notifications for a given user, handling joins correctly.

-- Drop previous function if it exists to avoid conflicts during development/re-runs
drop function if exists public.get_user_notifications(uuid);

-- Create the function to fetch notifications for a specific user
create or replace function public.get_user_notifications(p_user_id uuid)
returns table (
    id uuid,
    status text, -- Use text for status enum representation
    created_at timestamptz,
    bet_id uuid,
    recipient_id uuid,
    pending_outcome boolean,
    outcome_claimed_by uuid,
    outcome_claimed_at timestamptz,
    type text, -- 'creator' or 'recipient'
    display_name text, -- Calculated display name
    bet_description text,
    bet_stake numeric,
    bet_creator_id uuid
    -- We calculate type and display_name here, so no need to return raw user details unless specifically needed later
)
language plpgsql
security invoker -- Run with user's permissions, ensuring RLS on underlying tables is respected
set search_path = '' -- Ensure predictable schema resolution
stable -- Indicates the function doesn't modify the database and returns same results for same args within a transaction
as $$
begin
  return query
  select
    br.id,
    br.status::text,
    br.created_at,
    br.bet_id,
    br.recipient_id,
    br.pending_outcome,
    br.outcome_claimed_by,
    br.outcome_claimed_at,
    -- Determine notification type based on who the calling user is
    case
      when b.creator_id = p_user_id then 'creator'::text
      else 'recipient'::text
    end as type,
    -- Calculate display name based on notification type
    case
      when b.creator_id = p_user_id then -- User is creator, display recipient
        coalesce(
            recipient.raw_user_meta_data->>'display_name',
            recipient.raw_user_meta_data->>'username',
            recipient.email -- Fallback to email if display/username missing
        )
      else -- User is recipient, display creator
        coalesce(
            creator.raw_user_meta_data->>'display_name',
            creator.raw_user_meta_data->>'username',
            creator.email -- Fallback to email
        )
    end as display_name,
    b.description as bet_description,
    b.stake as bet_stake,
    b.creator_id as bet_creator_id
  from
    public.bet_recipients br
    inner join public.bets b on b.id = br.bet_id
    left join auth.users recipient on recipient.id = br.recipient_id -- Join for recipient info
    left join auth.users creator on creator.id = b.creator_id -- Join for creator info
  where
    br.recipient_id = p_user_id or b.creator_id = p_user_id -- Filter for the calling user
  order by
    br.created_at desc;
end;
$$;

-- Grant execute permission to the authenticated role
grant execute on function public.get_user_notifications(uuid) to authenticated; 