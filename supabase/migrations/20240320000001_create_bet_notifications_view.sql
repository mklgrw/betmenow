-- Create a view for bet notifications that properly handles user data joins
create or replace view bet_notifications as
select 
    br.id,
    br.status,
    br.created_at,
    br.bet_id,
    br.recipient_id,
    br.pending_outcome,
    br.outcome_claimed_by,
    br.outcome_claimed_at,
    b.description as bet_description,
    b.stake as bet_stake,
    b.creator_id as bet_creator_id,
    -- Recipient details
    recipient.email as recipient_email,
    recipient.raw_user_meta_data->>'username' as recipient_username,
    recipient.raw_user_meta_data->>'display_name' as recipient_display_name,
    -- Creator details
    creator.email as creator_email,
    creator.raw_user_meta_data->>'username' as creator_username,
    creator.raw_user_meta_data->>'display_name' as creator_display_name
from bet_recipients br
inner join bets b on b.id = br.bet_id
left join auth.users recipient on recipient.id = br.recipient_id
left join auth.users creator on creator.id = b.creator_id;

-- Create policy to control access to the view
create policy "Users can view their own notifications"
on bet_notifications
for select
using (
    auth.uid() = recipient_id -- They are the recipient
    or
    auth.uid() = bet_creator_id -- They are the creator
);

-- Grant access to the view
grant select on bet_notifications to authenticated; 