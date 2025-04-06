# Bet Acceptance/Rejection Flow

## Overview

This document outlines the process for bet recipients to accept or reject bets, and how the system handles bet status updates based on recipient responses.

## Database Structure

The bet recipient status is tracked in two tables:

1. **bets**: Main bet table with overall bet status
   - `status`: Can be 'pending', 'in_progress', 'rejected', 'won', 'lost'

2. **bet_recipients**: Records for each recipient of a bet
   - `status`: Can be 'pending', 'in_progress', 'rejected'
   - Links to the main bet through `bet_id`

## User Flow

1. **Bet Creation**:
   - A user creates a bet and selects specific friends as recipients
   - The bet status is set to 'pending'
   - Records are created in the bet_recipients table with status 'pending'

2. **Recipient View**:
   - Recipients see pending bets in their "Pending" tab on the Home screen
   - Each pending bet has "Accept" and "Reject" buttons

3. **Accepting a Bet**:
   - When a recipient accepts a bet:
     - Their bet_recipient record status is updated to 'in_progress'
     - The main bet status is updated to 'in_progress'
     - The bet moves from "Pending" to "In Progress" tab

4. **Rejecting a Bet**:
   - When a recipient rejects a bet:
     - Their bet_recipient record status is updated to 'rejected'
     - If all recipients reject the bet, the main bet status is updated to 'rejected'
     - The bet is removed from the recipient's list

5. **Notifications**:
   - Bet creators are notified when recipients accept or reject their bets
   - Recipients are notified when they are invited to a bet
   - All updates appear in the Activity tab

## Automatic Status Updates

A database trigger is used to automatically update the main bet status based on recipient responses:

- If all recipients reject a bet, the main bet is marked as 'rejected'
- If at least one recipient accepts a bet, the main bet is marked as 'in_progress'

## Implementation Details

- The HomeScreen displays pending bets with accept/reject buttons
- The BetDetailsScreen shows recipient statuses and also allows accepting/rejecting
- The ActivityScreen shows notifications for all bet status changes
- Database triggers automatically handle status propagation

## API Functions

- `acceptBet(recipientId, betId)`: Update a recipient record to 'in_progress'
- `rejectBet(recipientId)`: Update a recipient record to 'rejected'
- `fetchBets()`: Load bets for the current user, including those where they are a recipient 