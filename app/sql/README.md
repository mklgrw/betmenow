# Bet Rejection Fix: Comprehensive Guide

This directory contains SQL scripts to resolve the bet rejection issue in the application.

## Understanding the Problem

The application was experiencing issues with bet rejection due to:

1. **Schema constraints**: The status column in both `bets` and `bet_recipients` tables had constraints that didn't properly allow the 'rejected' status.

2. **Permission issues**: Users lacked the appropriate permissions to update statuses.

3. **Type safety**: Text-based status fields were causing validation issues.

## The Proper Solution: `proper_schema_fix.sql`

This is a comprehensive, secure long-term solution that addresses all the root causes:

### Key Components:

1. **Enum Type**: Replaces text-based status with a proper Postgres enum type
2. **Permission Model**: Creates appropriate roles and grants targeted permissions
3. **Row Level Security**: Implements proper RLS policies for fine-grained access control 
4. **Security Invoker**: Uses standard security without elevated privileges
5. **One-time Fix**: Includes a single admin function to fix existing data

### How to Apply the Fix

1. Run the SQL script in your Supabase SQL Editor:
   ```sql
   -- Run the entire proper_schema_fix.sql file
   ```

2. If you have existing data to fix, run the one-time repair function as an admin:
   ```sql
   SELECT one_time_fix_bet_data();
   ```

3. Grant the 'bet_manager' role to your admin users:
   ```sql
   -- Run as Supabase admin
   GRANT bet_manager TO your_admin_user;
   ```

### Handling Enum Conversion Issues

If you encounter errors like `ERROR: 42804: default for column "status" cannot be cast automatically to type bet_status_type`, try these steps:

1. Run the alternative migration that keeps using text fields but fixes constraints:
   ```sql
   SELECT alternative_migration();
   ```

2. After running the alternative migration, use the `reject_bet_text` function instead:
   ```sql
   -- In your application code
   const { data, error } = await supabase.rpc(
     'reject_bet_text',
     { 
       p_recipient_id: recipientId
     }
   );
   ```

3. If you want to try a manual conversion instead, run these statements one by one:
   ```sql
   -- Drop default constraints
   ALTER TABLE bets ALTER COLUMN status DROP DEFAULT;
   ALTER TABLE bet_recipients ALTER COLUMN status DROP DEFAULT;
   
   -- Drop check constraints
   ALTER TABLE IF EXISTS bets DROP CONSTRAINT IF EXISTS bets_status_check;
   ALTER TABLE IF EXISTS bet_recipients DROP CONSTRAINT IF EXISTS bet_recipients_status_check;
   
   -- Add new check constraints without enum
   ALTER TABLE bets ADD CONSTRAINT bets_status_check 
     CHECK (status IN ('pending', 'in_progress', 'completed', 'rejected', 'cancelled'));
   ALTER TABLE bet_recipients ADD CONSTRAINT bet_recipients_status_check
     CHECK (status IN ('pending', 'in_progress', 'completed', 'rejected', 'cancelled'));
     
   -- Set defaults back
   ALTER TABLE bets ALTER COLUMN status SET DEFAULT 'pending';
   ALTER TABLE bet_recipients ALTER COLUMN status SET DEFAULT 'pending';
   ```

## Implementation Details

### Security Model

- **app_user**: Basic role for all authenticated users
- **bet_manager**: Administrative role for managing bets

### Row-Level Security Policies

- Users can only update their own bet recipients
- Bet creators can only update their own bets
- Bet managers can update any bets/recipients

### Best Practices Used

- Proper schema definition with enums instead of text
- Minimal permissions following principle of least privilege
- Targeted column grants instead of table-wide permissions
- Row-Level Security for fine-grained access control
- Avoids SECURITY DEFINER except for one-time data fix

## Testing the Fix

After applying the fix, test the following scenarios:

1. Rejecting a bet as the recipient
2. Accepting a bet as the recipient
3. Viewing bet status as the creator
4. Attempting to reject a bet you're not a recipient of (should fail)

## Troubleshooting

If issues persist:

1. Check SQL error logs for specific constraint violations
2. Verify user roles are correctly assigned
3. Confirm RLS policies are enabled and functioning
4. Test with a bet_manager user to see if permission issues are resolved

For any questions, contact the database administrator. 