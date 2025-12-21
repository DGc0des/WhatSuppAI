# WhatSuppAI - Setup Guide

This guide will help you set up and run the WhatSuppAI project.

## Prerequisites

- **Node.js** v18+ (you have v20.19.5 ✅)
- **npm** v10+ (you have v10.8.2 ✅)
- **Expo CLI** (will be installed via npx)
- **Supabase Account** (for database)
- **OpenAI API Key** (for GPT analysis)

## Step 1: Install Dependencies

Dependencies are already installed! ✅

If you need to reinstall:
```bash
# Root directory (backend)
npm install

# Mobile directory
cd mobile
npm install
```

## Step 2: Environment Variables

### Backend (.env)

Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

Edit `.env` and add your values:
```env
OPENAI_API_KEY=sk-your-actual-openai-key-here
PORT=3000
```

**Get OpenAI API Key:**
1. Go to https://platform.openai.com/api-keys
2. Create a new API key
3. Copy it to your `.env` file

### Mobile App (Environment Variables)

Currently, the mobile app has hardcoded values. For production, you should:

1. Install `expo-constants`:
```bash
cd mobile
npm install expo-constants
```

2. Update `app.json` to include environment variables (see ISSUES.md #1 for details)

**For now, the app will work with hardcoded values:**
- Supabase URL: `https://ocborljfnmmodrnbtoqb.supabase.co`
- API Base: `http://192.168.2.111:3000` (update this to your machine's IP)

## Step 3: Database Setup (Supabase)

1. **Go to Supabase Dashboard:** https://supabase.com/dashboard
2. **Run SQL migrations in order:**
   - `fix_all_constraints.sql` (if Scanned table exists)
   - `create_history_table.sql` (creates History and Stack tables)
   - `add_notification_fields.sql` (adds notification support)
   - `supabase_recurring_schedule.sql` (adds recurrence support)

3. **Verify RLS policies are set up** for:
   - History table
   - Stack table
   - ScheduledSupplements table

## Step 4: Update API Base URL

Edit `mobile/lib/api.ts` and update the API_BASE:

```typescript
// For iOS simulator
export const API_BASE = 'http://localhost:3000';

// For Android emulator
export const API_BASE = 'http://10.0.2.2:3000';

// For physical device (use your computer's IP)
export const API_BASE = 'http://192.168.1.XXX:3000';
```

**To find your IP:**
- macOS/Linux: `ifconfig | grep "inet "`
- Windows: `ipconfig`

## Step 5: Start the Backend Server

```bash
# From root directory
npm run serve
# or
npm run dev  # with nodemon for auto-reload
```

The server will start on `http://localhost:3000`

## Step 6: Start the Mobile App

```bash
# From mobile directory
cd mobile
npx expo start
```

**Options:**
- Press `i` for iOS simulator
- Press `a` for Android emulator
- Scan QR code with Expo Go app on your phone

## Step 7: First Run Checklist

- [ ] Backend server is running on port 3000
- [ ] OpenAI API key is set in `.env`
- [ ] Supabase database is set up with migrations
- [ ] API_BASE in `mobile/lib/api.ts` matches your setup
- [ ] Mobile app can connect to backend
- [ ] You can sign up/login in the app
- [ ] You can scan a barcode

## Troubleshooting

### Backend won't start
- Check if port 3000 is available: `lsof -i :3000`
- Verify `.env` file exists and has OPENAI_API_KEY
- Check Node.js version: `node --version`

### Mobile app can't connect to backend
- Verify backend is running
- Check API_BASE URL matches your network
- For physical device, ensure phone and computer are on same WiFi
- Check firewall settings

### Expo errors
- Clear cache: `npx expo start --clear`
- Reinstall dependencies: `rm -rf node_modules && npm install`

### Database errors
- Verify Supabase credentials in `mobile/supabase-client.ts`
- Check RLS policies are enabled
- Verify migrations have been run

## Development Commands

### Backend
```bash
npm run serve      # Start server
npm run dev        # Start with nodemon (auto-reload)
```

### Mobile
```bash
cd mobile
npx expo start              # Start Expo
npx expo start --clear      # Clear cache and start
npx expo start --ios         # Start iOS simulator
npx expo start --android     # Start Android emulator
```

## Next Steps

1. Review `ISSUES.md` for critical fixes needed
2. Set up environment variables properly (see ISSUES.md #1, #5)
3. Test all features:
   - Barcode scanning
   - Adding to Stack
   - Scheduling supplements
   - Notifications
   - Chat assistant

## Need Help?

- Check the documentation files:
  - `NOTIFICATION_SETUP.md`
  - `HOW_TO_USE_NOTIFICATIONS.md`
  - `PASSWORD_RESET_SETUP.md`
  - `IMPLEMENTATION_SUMMARY.md`
- Review `ISSUES.md` for known issues

---

**Setup Status:** ✅ Dependencies installed  
**Next:** Configure environment variables and database


