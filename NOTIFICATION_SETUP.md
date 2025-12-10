# Supplement Notification Setup Guide

## Overview
Your app now supports push notifications to remind users to take their scheduled supplements. Users can choose to receive notifications at the scheduled time, 30 minutes before, or 1 hour before.

## What Was Implemented

### 1. Database Changes
- Added three new columns to `ScheduledSupplements` table:
  - `notification_enabled` (boolean) - Whether notifications are enabled for this schedule
  - `notification_timing` (text) - When to send the notification ('on-time', '30-min-before', '1-hour-before')
  - `notification_id` (text) - ID of the scheduled notification for cancellation

### 2. New Files Created
- **`mobile/lib/notificationService.ts`** - Core notification functionality
  - Request notification permissions
  - Schedule notifications with time offsets
  - Cancel notifications
  - Handle notification channels for Android

- **`add_notification_fields.sql`** - Database migration script

### 3. Modified Files
- **`mobile/lib/scheduleStorage.ts`** - Updated to support notification fields
- **`mobile/app/(tabs)/calendar.tsx`** - Added notification settings UI flow
- **`mobile/app.json`** - Added notification permissions and configuration

## Setup Steps

### Step 1: Run Database Migration

1. Go to your Supabase Dashboard: https://supabase.com/dashboard/project/ocborljfnmmodrnbtoqb
2. Navigate to: **SQL Editor** (left sidebar)
3. Click **New Query**
4. Copy and paste the contents of `add_notification_fields.sql`
5. Click **Run** or press Cmd/Ctrl + Enter
6. Verify success message appears

### Step 2: Rebuild Your App

Since we modified `app.json`, you need to rebuild the native parts:

```bash
cd mobile

# Clear cache and rebuild
npx expo prebuild --clean

# For iOS simulator
npx expo run:ios

# For Android emulator
npx expo run:android

# Or for Expo Go (limited notification support)
npx expo start --clear
```

### Step 3: Test Notifications

1. **Schedule a supplement with notification:**
   - Go to Schedule tab
   - Select a date
   - Add a supplement
   - Choose dosage
   - Select schedule type (Once, Every Day, or Specific Days)
   - When prompted "Do you want to be reminded?", select **"Remind Me"**
   - Choose timing: "At scheduled time", "30 minutes before", or "1 hour before"

2. **Grant notification permissions:**
   - First time you enable notifications, you'll be prompted for permission
   - Tap "Allow" to enable notifications

3. **Verify notification scheduled:**
   - Check the console logs for confirmation
   - Scheduled notifications will show the notification ID

## How It Works

### User Flow
1. User schedules a supplement on the Schedule tab
2. After selecting time and recurrence, they're asked: "Do you want to be reminded?"
3. If "Remind Me", they choose when: at time, 30 min before, or 1 hour before
4. Notification is scheduled and saved to database
5. At the specified time, user receives a push notification
6. If schedule is deleted, the notification is automatically cancelled

### Notification Message Format
```
Title: 💊 Supplement Reminder

Body Examples:
- "Time to take Vitamin D (Nature Made)"
- "Time to take Vitamin D (Nature Made) - 2 capsules"
- "Time to take Vitamin D in 30 minutes"  (for 30-min-before)
- "Time to take Vitamin D in 1 hour"  (for 1-hour-before)
```

### Technical Details

**Notification Timing Calculation:**
- `on-time`: Notification sent exactly at scheduled time
- `30-min-before`: Notification sent 30 minutes before scheduled time
- `1-hour-before`: Notification sent 1 hour before scheduled time

**Past Time Handling:**
- If the calculated notification time is in the past, no notification is scheduled
- User is still notified via alert that permission may be needed

**Cancellation:**
- When a scheduled supplement is deleted, its notification is automatically cancelled
- Uses the stored `notification_id` to find and cancel the specific notification

## Platform-Specific Notes

### iOS
- Notifications work in both development and production builds
- May not work reliably in Expo Go
- User must grant notification permission when prompted
- Notifications appear in Notification Center

### Android
- Notifications use a dedicated channel: "Supplement Reminders"
- High importance for visibility
- Vibration pattern: [0, 250, 250, 250]
- Permissions automatically requested
- May require "Schedule exact alarm" permission on Android 12+

## Troubleshooting

### Notifications Not Appearing

1. **Check permissions:**
```typescript
import * as Notifications from 'expo-notifications';
const { status } = await Notifications.getPermissionsAsync();
console.log('Notification permission status:', status);
```

2. **Verify notification was scheduled:**
```typescript
const scheduled = await Notifications.getAllScheduledNotificationsAsync();
console.log('Scheduled notifications:', scheduled);
```

3. **Check notification ID was saved:**
- Look at the `notification_id` field in the ScheduledSupplements table
- Should be a string like `"E1F5A2C3-..."` (iOS) or similar

### App Crashes After Update

1. Clear build cache:
```bash
cd mobile
rm -rf node_modules
npm install
npx expo prebuild --clean
```

2. For iOS:
```bash
cd ios
pod install
cd ..
npx expo run:ios
```

### Permission Denied

- On iOS: Go to Settings → Your App → Notifications → Enable
- On Android: Go to Settings → Apps → Your App → Notifications → Enable

## Code Examples

### Manually Schedule a Notification
```typescript
import { scheduleSupplementNotification } from '../../lib/notificationService';

const notificationId = await scheduleSupplementNotification(
  'Vitamin D',           // supplement name
  'Nature Made',         // brand
  new Date('2025-12-07T14:00:00'),  // scheduled time
  '30-min-before',       // timing preference
  '2 capsules'          // dosage
);

console.log('Notification scheduled:', notificationId);
```

### Cancel a Notification
```typescript
import { cancelNotification } from '../../lib/notificationService';

await cancelNotification('notification-id-here');
```

### Get All Scheduled Notifications (Debug)
```typescript
import { getAllScheduledNotifications } from '../../lib/notificationService';

const notifications = await getAllScheduledNotifications();
console.log('Total scheduled:', notifications.length);
```

## Future Enhancements

Potential features to add:
- [ ] Edit notification settings for existing schedules
- [ ] Recurring notifications for daily/weekly schedules (currently only schedules once)
- [ ] Custom notification sound selection
- [ ] Notification history/log
- [ ] Snooze functionality
- [ ] Rich notifications with action buttons ("Taken", "Remind Later")
- [ ] Badge count on app icon
- [ ] Notification settings page in app

## Need Help?

- Check the Expo Notifications docs: https://docs.expo.dev/versions/latest/sdk/notifications/
- Review notification logs in Xcode (iOS) or Logcat (Android)
- Test on a physical device for best results (simulators have limitations)
