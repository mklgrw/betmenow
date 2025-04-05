# BetMeNow App

A peer-to-peer betting app built with React Native and Supabase.

## Features

- User authentication (email/password, Google, Apple)
- Create and issue bets to friends
- Social feed to view, react to, and comment on bets
- Calendar view for scheduled bets
- Activity tracking for bet history
- Profile dashboard and leaderboard

## Tech Stack

- React Native with Expo
- TypeScript
- Supabase (Authentication, Database, Real-time subscriptions)
- React Navigation (Stack and Tab navigation)

## Prerequisites

- Node.js (v14+)
- npm or yarn
- Expo CLI
- Supabase account

## Setup Instructions

1. Clone the repository:
```
git clone <repository-url>
cd betmenow
```

2. Install dependencies:
```
npm install
```

3. Create a Supabase project:
   - Sign up at [supabase.com](https://supabase.com)
   - Create a new project
   - Set up the database tables as per the schema in the documentation

4. Configure environment variables:
   - Create a `.env` file in the root directory:
   ```
   SUPABASE_URL=your_supabase_url
   SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

5. Update the supabase.ts file with your credentials (temporarily until environment variables are set up):
   - Open `app/services/supabase.ts`
   - Replace the placeholder values with your actual Supabase URL and anon key

6. Run the project:
```
npx expo start
```

## Database Schema

The app requires the following tables in your Supabase database:

- Users
- Friends
- Bets
- Reactions
- Comments
- Transactions

See the detailed schema structure in the code documentation.

## Deployment

- Use Expo EAS Build to generate native builds
- Follow Expo's documentation for publishing to app stores

## Contributing

1. Fork the repository
2. Create your feature branch
3. Submit a pull request 