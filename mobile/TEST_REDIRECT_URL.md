# Password Reset Redirect URL Configuration

## Step 1: Get Your Expo URL

When you run your app, look in the terminal for the console.log that says:
```
Password reset redirect URL: <YOUR_URL_HERE>
```

Copy that EXACT URL.

## Step 2: Add to Supabase

You need to add BOTH of these formats to Supabase Dashboard → Authentication → URL Configuration → Redirect URLs:

### For Expo Go (Development):
```
exp://192.168.x.x:8081/--/reset-password
exp://192.168.x.x:8081/--/**
exp://*
```

### For Production Build:
```
whatsuppai://reset-password
whatsuppai://**
```

## Step 3: Important Notes

1. **Replace `192.168.x.x`** with your actual local IP address (from the console log)
2. **Add ALL variations** - Supabase requires exact matches
3. **Click "Save changes"** after adding each URL
4. **Wait 1-2 minutes** after saving for changes to propagate

## If Still Getting "Invalid Path" Error:

Try adding these wildcard patterns:
- `exp://*`
- `whatsuppai://*`
- The exact URL from the console log

## Testing Checklist:

- [ ] Copied exact URL from console log
- [ ] Added URL to Supabase
- [ ] Added wildcard pattern (exp://*)
- [ ] Clicked "Save changes"
- [ ] Waited 1-2 minutes
- [ ] Requested NEW password reset (old emails won't work)
- [ ] Checked email and clicked link
