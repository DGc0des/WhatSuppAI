# Password Reset Setup Instructions

## What I've Done

1. ✅ Updated `auth.tsx` to include `redirectTo` parameter in password reset
2. ✅ Created `reset-password.tsx` screen to handle password updates
3. ✅ Changed app scheme from `mobile` to `whatsuppai` in `app.json`

## What You Need To Do

### 1. Configure Supabase Dashboard

**Go to your Supabase Dashboard:**
1. Navigate to: Authentication → URL Configuration
2. Under "Redirect URLs", add:
   ```
   whatsuppai://reset-password
   ```
3. Click "Save"

### 2. Restart Your Expo App

After changing the `scheme` in `app.json`, you need to rebuild:

```bash
cd mobile
npx expo prebuild --clean
npx expo start
```

Or if using Expo Go:
```bash
cd mobile
npx expo start --clear
```

## How It Works Now

1. **User clicks "Forgot Password"**
2. **User enters email** → Supabase sends email with reset link
3. **User clicks link in email** → Opens `whatsuppai://reset-password` (your app)
4. **App opens reset-password.tsx screen** → User enters new password
5. **Password updated** → User redirected to main app

## Testing

1. Enter email on "Forgot Password" screen
2. Check your email inbox
3. Click the password reset link
4. App should open to the password reset screen
5. Enter new password and confirm
6. Should redirect to main app with new password working

## Troubleshooting

**If the link opens wrong site:**
- Make sure you added `whatsuppai://reset-password` to Supabase Redirect URLs
- Restart your app after scheme change

**If app doesn't open:**
- Make sure you rebuilt the app after changing the scheme
- On iOS simulator: `npx expo run:ios`
- On Android emulator: `npx expo run:android`

**Deep link not working in Expo Go:**
- Deep links work better in development builds or production builds
- Consider using `expo-dev-client` for better deep link support during development
