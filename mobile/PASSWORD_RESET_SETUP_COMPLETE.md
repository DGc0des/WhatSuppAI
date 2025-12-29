# Password Reset Setup - Complete Guide

## ✅ Code Changes Completed

All necessary code changes have been implemented:

1. **Removed duplicate deep link handling** from `_layout.tsx` - Expo Router now handles this automatically
2. **Updated reset-password.tsx** to properly handle URL parameters from deep links
3. **Settings tab** correctly uses `ExpoLinking.createURL()` to generate the redirect URL

## 🔧 Supabase Dashboard Configuration Required

You MUST complete these steps in the Supabase Dashboard:

### Step 1: Add Redirect URLs

1. Go to **Supabase Dashboard** → **Authentication** → **URL Configuration**
2. Scroll to **Redirect URLs** section
3. Add ALL of these URLs (click "Add URL" for each):

```
exp://*/*
exp://192.168.2.111:8081/--/reset-password
whatsuppai://reset-password
whatsuppai://**
```

4. **Click "Save changes"** button
5. **Wait 1-2 minutes** for changes to propagate

### Step 2: Verify Email Template

1. Go to **Authentication** → **Email Templates** → **Reset password**
2. Verify line 4 has:
   ```html
   <a href="{{ .ConfirmationURL }}">Reset Password</a>
   ```
3. It should already be correct (DO NOT change if it says `.ConfirmationURL`)

## 📱 Testing the Flow

1. **Request password reset** from Settings in your app
2. Check console for: `Password reset redirect URL: exp://192.168.2.111:8081/--/reset-password`
3. **Check your email** and click the reset link
4. **Watch the terminal** for these logs:
   ```
   [Reset Password] Screen mounted, checking for deep link...
   [Reset Password] Initial URL: exp://...
   [Reset Password] Parsed URL: {...}
   [Reset Password] Setting session with tokens...
   [Reset Password] Session set successfully
   ```
5. You should see the password reset screen
6. Enter new password and submit

## 🐛 Troubleshooting

### Still getting "request path is invalid"?
- Make sure you added `exp://*/*` to Supabase redirect URLs
- Make sure you clicked "Save changes"
- Wait 2 minutes after saving
- Request a NEW password reset (old emails won't work)

### App doesn't open from email?
- You're probably using Expo Go - this is expected
- Custom URL schemes only work in:
  - Development builds (`npx expo run:ios` or `npx expo run:android`)
  - Production builds
- For Expo Go, you need to manually copy the link and paste in browser, then it should prompt to open in Expo

### No logs appearing?
- Make sure you're watching the terminal where `expo start` is running
- The logs are prefixed with `[Reset Password]`

## 🚀 Production Considerations

For production builds:
1. Build the app: `npx expo build:ios` or `npx expo build:android`
2. The `whatsuppai://` URLs will work automatically
3. Consider implementing Universal Links (iOS) and App Links (Android) for better UX

## 📚 References

- [Native Mobile Deep Linking | Supabase Docs](https://supabase.com/docs/guides/auth/native-mobile-deep-linking)
- [React Native Password Reset Issue](https://github.com/supabase/supabase-js/issues/843)
- [Handling Supabase Password Reset in React Native](https://blog.theodo.com/2023/03/supabase-reset-password-rn/)
