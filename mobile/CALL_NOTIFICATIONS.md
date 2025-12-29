# Call-Style Notifications for Supplement Reminders

## Overview

Supplement reminders now appear as **call-like notifications** with action buttons, similar to incoming phone calls.

## Features

### Notification Appearance
- **High Priority**: Uses maximum priority to appear prominently
- **Time Sensitive** (iOS): Breaks through Focus modes
- **Action Buttons**: Two buttons appear directly on the notification:
  - **✓ Taken** - Mark supplement as taken
  - **Snooze 15m** - Postpone reminder for 15 minutes

### How It Works

1. **When notification fires** (even if app is closed):
   - Shows as high-priority notification
   - Displays supplement name, brand, and dosage
   - Shows two action buttons

2. **User taps "Taken"**:
   - Notification dismisses
   - Logged in console
   - TODO: Will mark in calendar/database

3. **User taps "Snooze"**:
   - Notification dismisses
   - Schedules new notification in 15 minutes
   - Same supplement info

## Platform Differences

### iOS
- Shows as banner notification with two buttons below
- "Time Sensitive" makes it appear even in Focus mode
- Buttons appear in notification center

### Android
- Shows as heads-up notification (floats on screen)
- Action buttons appear inline
- Maximum priority ensures it's prominent

## Testing

Run this from Settings or anywhere:
```typescript
import { testNotification } from '@/lib/notificationService';

// Triggers test notification in 10 seconds
testNotification();
```

You'll receive a notification that says:
"Time to take Vitamin D - 2 capsules"

Try tapping the "Taken" and "Snooze" buttons!

## Code Locations

- **Notification Setup**: [lib/notificationService.ts](lib/notificationService.ts:4-25)
- **Response Handler**: [app/_layout.tsx](app/_layout.tsx:34-55)
- **Category Actions**:
  - `taken` - Opens app to foreground
  - `snooze` - Stays in background, schedules new notification

## Future Enhancements

- [ ] Track "taken" status in database
- [ ] Show "taken" supplements in calendar with checkmark
- [ ] Customize snooze duration
- [ ] Add voice/sound for more call-like experience
- [ ] Full-screen overlay UI when app is open
