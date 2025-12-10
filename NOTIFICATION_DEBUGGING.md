# Notification Debugging Guide

## Issue: Getting notifications immediately regardless of scheduled time

### What Was Fixed

1. **Added 5-second buffer** - Notifications won't be scheduled if they're less than 5 seconds in the future
2. **Better time validation** - More robust checking to prevent past-time notifications
3. **Enhanced logging** - You can now see exactly what's happening in the console

### How to Debug

When you schedule a notification, check the console logs (Metro bundler). You should see:

```
[Notifications] Scheduled time: 12/7/2025, 2:00:00 PM
[Notifications] Notification time: 12/7/2025, 1:30:00 PM
[Notifications] Current time: 12/7/2025, 10:00:00 AM
[Notifications] ✅ Successfully scheduled notification abc123 for Vitamin D at 12/7/2025, 1:30:00 PM
```

If the notification is too soon or in the past, you'll see:
```
[Notifications] Notification time is in the past or too soon, skipping
[Notifications] Time difference (seconds): -300
```

### Common Issues and Solutions

#### Issue 1: Immediate notification when scheduling for today

**Problem:** You schedule for "today at 2:00 PM" but current time is 3:00 PM

**What happens:**
```
[Notifications] Scheduled time: 12/7/2025, 2:00:00 PM
[Notifications] Current time: 12/7/2025, 3:00:00 PM
[Notifications] Notification time is in the past or too soon, skipping
[Notifications] Time difference (seconds): -3600
```

**Solution:** Schedule for tomorrow or a future time. The notification won't be scheduled if the time has already passed.

#### Issue 2: Immediate notification with "30 min before" or "1 hour before"

**Problem:** You schedule for "2:00 PM" with "30 min before", but current time is already 1:45 PM

**What happens:**
```
[Notifications] Scheduled time: 12/7/2025, 2:00:00 PM
[Notifications] Notification time: 12/7/2025, 1:30:00 PM  (30 min before 2:00 PM)
[Notifications] Current time: 12/7/2025, 1:45:00 PM
[Notifications] Notification time is in the past or too soon, skipping
```

**Solution:** Make sure the reminder time (not just the scheduled time) is in the future:
- If scheduling for 2:00 PM with "1 hour before", current time must be before 1:00 PM
- If scheduling for 2:00 PM with "30 min before", current time must be before 1:30 PM

#### Issue 3: Notifications scheduled but still get immediate alert

**Possible causes:**

1. **Permission prompt appearing** - This is iOS/Android asking for permission, not an actual notification
   - Look for: "Allow notifications?" dialog
   - This only happens once

2. **Testing with times less than 5 seconds away**
   - Notifications won't schedule if less than 5 seconds in the future
   - Use times at least 1+ minute in the future for testing

3. **Old notification from previous test**
   - Clear all scheduled notifications: `await cancelAllNotifications()`
   - Or check what's scheduled: `await getAllScheduledNotifications()`

### Testing Recommendations

#### Test 1: Schedule for 1 minute in future
```
Current time: 10:00:00 AM
Schedule time: 10:01:00 AM (1 minute from now)
Timing: "At scheduled time"
Expected: Notification at 10:01:00 AM ✅
```

#### Test 2: Schedule with 30-min reminder
```
Current time: 10:00:00 AM
Schedule time: 11:00:00 AM
Timing: "30 minutes before"
Expected: Notification at 10:30:00 AM ✅
```

#### Test 3: Past time (should skip)
```
Current time: 10:00:00 AM
Schedule time: 09:00:00 AM (1 hour ago)
Expected: No notification scheduled, logs show "in the past" ✅
```

### How to Check Scheduled Notifications

Add this temporary code to your calendar screen to see all scheduled notifications:

```typescript
import { getAllScheduledNotifications } from '../../lib/notificationService';

// Add a button to test:
<TouchableOpacity onPress={async () => {
  const notifications = await getAllScheduledNotifications();
  console.log('All scheduled notifications:', notifications);
  Alert.alert(
    'Scheduled Notifications',
    `Total: ${notifications.length}\n\n${notifications.map(n =>
      `${n.content.title}\n${new Date(n.trigger.date).toLocaleString()}`
    ).join('\n\n')}`
  );
}}>
  <Text>Check Scheduled</Text>
</TouchableOpacity>
```

### Expected Console Output Flow

#### Successful scheduling:
```
[Notifications] Scheduled time: 12/7/2025, 3:00:00 PM
[Notifications] Notification time: 12/7/2025, 2:30:00 PM
[Notifications] Current time: 12/7/2025, 10:00:00 AM
[Notifications] ✅ Successfully scheduled notification E1F5A2C3-... for Vitamin D at 12/7/2025, 2:30:00 PM
```

#### Skipped (time in past):
```
[Notifications] Scheduled time: 12/7/2025, 9:00:00 AM
[Notifications] Notification time: 12/7/2025, 8:30:00 AM
[Notifications] Current time: 12/7/2025, 10:00:00 AM
[Notifications] Notification time is in the past or too soon, skipping
[Notifications] Time difference (seconds): -5400
```

### Testing Checklist

- [ ] Run database migration ([add_notification_fields.sql](add_notification_fields.sql))
- [ ] Rebuild app (`npx expo prebuild --clean && npx expo run:ios`)
- [ ] Grant notification permissions when prompted
- [ ] Check console logs when scheduling
- [ ] Schedule for at least 1 minute in the future
- [ ] Verify notification ID is saved in database
- [ ] Wait for scheduled time and check if notification appears

### Still Getting Immediate Notifications?

If you still get immediate notifications after these fixes:

1. **Check the console logs** - Share what you see
2. **Verify the times** - What time did you schedule? What's current time?
3. **Check database** - Is `notification_id` being saved?
4. **Clear and retry** - Delete the schedule, clear app cache, try again

The logging will tell us exactly what's happening!
