# Debugging Bet Outcome Issues

This document provides instructions for debugging issues with the bet outcome declaration process, particularly when a user claims a loss and the bet is not being marked as complete.

## Problem Description

When a user claims a loss, the following issues were observed:

1. The bet status in the `bets` table is not being updated to 'completed'
2. The opponent's status in the `bet_recipients` table is not being updated to 'won'

## Debugging Steps

### 1. Add Logging to the SQL Function

The first recommendation is to add logging to the `secure_declare_bet_outcome` function in Supabase. We've created a migration file with added logging to diagnose where the function might be failing.

To apply this logging:

1. Go to your Supabase dashboard
2. Navigate to SQL Editor
3. Copy the SQL code from the `app/sql/bet_outcome_mutual_agreement.sql` file (with the added logging statements)
4. Execute the SQL to update the function

### 2. Using the Debug Script

We've created a debug script that will:
1. Check the initial state of a bet and its recipients
2. Call the `secure_declare_bet_outcome` function with the 'lost' outcome
3. Check the updated state to identify what's not working correctly

**Prerequisites:**
- Node.js installed
- Supabase project URL and anon key

**Setup:**
```bash
# Install required dependencies
npm install @supabase/supabase-js dotenv
```

**Usage:**
```bash
# Run with recipient ID only (loads Supabase credentials from .env)
node debug-bet-outcome.js <recipient_id>

# Run with explicit Supabase credentials
node debug-bet-outcome.js <recipient_id> <supabase_url> <supabase_anon_key>
```

Where `<recipient_id>` is the UUID of a bet_recipients record you want to test.

### 3. How to Get a Recipient ID for Testing

1. Through the app:
   - Start the app in development mode
   - Create a test bet or use an existing one
   - Use console.log to output the recipient ID when viewing a bet

2. Through Supabase:
   - Go to the Supabase dashboard
   - Open the Table Editor
   - Select the `bet_recipients` table
   - Find a row in the 'pending' or 'in_progress' status
   - Copy the `id` value

### 4. Checking Logs

After running the debug script:

1. In the Supabase dashboard, navigate to Database > Logs
2. Look for entries from the `secure_declare_bet_outcome` function
3. Review the logged values to identify where the process is failing

### 5. Common Issues and Solutions

Based on our analysis, the potential issues might be:

a) **Opponent Identification Failure**:
   - The function might not be correctly identifying the opponent recipient record
   - Check the `v_opponent_recipient_id` value in the logs

b) **Row Level Security Blocking Updates**:
   - RLS policies might be preventing updates to the bet or recipient records
   - Verify the `SECURITY DEFINER` and `search_path = public` settings in the function

c) **Transaction Issues**:
   - If partial updates are occurring, wrapping the function body in a transaction might help
   - Add `BEGIN` and `COMMIT` statements to the function

### 6. Applying Fixes

Once the issue is identified:

1. Update the `secure_declare_bet_outcome` function with the necessary fixes
2. Run the debug script again to verify the fix works
3. Remove the logging statements before deploying to production

## Getting Help

If you need additional help debugging this issue, please share:
1. The debug script output
2. The database logs
3. Any errors encountered during the process

This information will help diagnose the specific cause of the issue in your environment. 