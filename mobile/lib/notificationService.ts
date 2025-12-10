import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Configure how notifications should be handled when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export type NotificationTiming = 'on-time' | '30-min-before' | '1-hour-before';

/**
 * Request notification permissions from the user
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  try {
    console.log('[Notifications] Checking permission status...');
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    console.log('[Notifications] Existing permission status:', existingStatus);
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      console.log('[Notifications] Requesting permission from user...');
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
      console.log('[Notifications] Permission request result:', status);
    }

    if (finalStatus !== 'granted') {
      console.log('[Notifications] ❌ Notification permission not granted');
      return false;
    }

    console.log('[Notifications] ✅ Permission granted');

    // Configure notification channel for Android
    if (Platform.OS === 'android') {
      console.log('[Notifications] Configuring Android notification channel...');
      await Notifications.setNotificationChannelAsync('supplement-reminders', {
        name: 'Supplement Reminders',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
        sound: 'default',
      });
      console.log('[Notifications] ✅ Android channel configured');
    }

    return true;
  } catch (error) {
    console.error('[Notifications] ❌ Error requesting notification permissions:', error);
    return false;
  }
}

/**
 * Calculate notification time based on scheduled time and timing preference
 */
function calculateNotificationTime(scheduledDate: Date, timing: NotificationTiming): Date {
  const notificationTime = new Date(scheduledDate);

  switch (timing) {
    case '30-min-before':
      notificationTime.setMinutes(notificationTime.getMinutes() - 30);
      break;
    case '1-hour-before':
      notificationTime.setHours(notificationTime.getHours() - 1);
      break;
    case 'on-time':
    default:
      // No adjustment needed
      break;
  }

  return notificationTime;
}

/**
 * Schedule a notification for a supplement
 */
export async function scheduleSupplementNotification(
  supplementName: string,
  supplementBrand: string | undefined,
  scheduledDate: Date,
  timing: NotificationTiming,
  dosage?: string | null
): Promise<string | null> {
  try {
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) {
      console.log('[Notifications] Cannot schedule notification - no permission');
      return null;
    }

    const notificationTime = calculateNotificationTime(scheduledDate, timing);
    const now = new Date();

    // Add a small buffer (5 seconds) to avoid immediate notifications
    const minimumTime = new Date(now.getTime() + 5000);

    console.log('=== NOTIFICATION SCHEDULING DEBUG ===');
    console.log('[Notifications] Scheduled time:', scheduledDate.toLocaleString());
    console.log('[Notifications] Scheduled time (ISO):', scheduledDate.toISOString());
    console.log('[Notifications] Scheduled time (timestamp):', scheduledDate.getTime());
    console.log('[Notifications] Notification time:', notificationTime.toLocaleString());
    console.log('[Notifications] Notification time (ISO):', notificationTime.toISOString());
    console.log('[Notifications] Notification time (timestamp):', notificationTime.getTime());
    console.log('[Notifications] Current time:', now.toLocaleString());
    console.log('[Notifications] Current time (ISO):', now.toISOString());
    console.log('[Notifications] Current time (timestamp):', now.getTime());
    console.log('[Notifications] Timing preference:', timing);

    // Don't schedule if the time is in the past or too soon
    if (notificationTime < minimumTime) {
      console.log('[Notifications] Notification time is in the past or too soon, skipping');
      console.log('[Notifications] Time difference (seconds):', (notificationTime.getTime() - now.getTime()) / 1000);
      return null;
    }

    const title = '💊 Supplement Reminder';
    let body = `Time to take ${supplementName}`;
    if (supplementBrand) {
      body += ` (${supplementBrand})`;
    }
    if (dosage) {
      body += ` - ${dosage}`;
    }

    // Add timing context to the message
    if (timing === '30-min-before') {
      body += ' in 30 minutes';
    } else if (timing === '1-hour-before') {
      body += ' in 1 hour';
    }

    // Calculate seconds until notification
    const secondsUntilNotification = Math.floor((notificationTime.getTime() - now.getTime()) / 1000);

    console.log(`[Notifications] Scheduling in ${secondsUntilNotification} seconds (${Math.floor(secondsUntilNotification / 60)} minutes)`);

    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: 'default',
        priority: Notifications.AndroidNotificationPriority.HIGH,
        data: {
          supplementName,
          scheduledDate: scheduledDate.toISOString(),
          timing,
        },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: secondsUntilNotification,
        repeats: false,
      },
    });

    console.log(`[Notifications] ✅ Successfully scheduled notification ${notificationId} for ${supplementName} at ${notificationTime.toLocaleString()}`);
    return notificationId;
  } catch (error) {
    console.error('Error scheduling notification:', error);
    return null;
  }
}

/**
 * Cancel a scheduled notification
 */
export async function cancelNotification(notificationId: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
    console.log(`Cancelled notification ${notificationId}`);
  } catch (error) {
    console.error('Error cancelling notification:', error);
  }
}

/**
 * Cancel all scheduled notifications (useful for cleanup)
 */
export async function cancelAllNotifications(): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    console.log('Cancelled all notifications');
  } catch (error) {
    console.error('Error cancelling all notifications:', error);
  }
}

/**
 * Get all scheduled notifications (for debugging)
 */
export async function getAllScheduledNotifications() {
  try {
    const notifications = await Notifications.getAllScheduledNotificationsAsync();
    console.log(`[Notifications] Total scheduled notifications: ${notifications.length}`);
    notifications.forEach((notif, index) => {
      const trigger = notif.trigger as any;
      console.log(`[Notifications] ${index + 1}. ${notif.content.title} - ${notif.content.body}`);
      if (trigger.type === 'timeInterval') {
        console.log(`[Notifications]    Will fire in ${trigger.seconds} seconds (${Math.floor(trigger.seconds / 60)} minutes)`);
      } else {
        console.log(`[Notifications]    Scheduled for: ${trigger.date ? new Date(trigger.date).toLocaleString() : 'Unknown'}`);
      }
      console.log(`[Notifications]    ID: ${notif.identifier}`);
    });
    return notifications;
  } catch (error) {
    console.error('[Notifications] Error getting scheduled notifications:', error);
    return [];
  }
}

/**
 * Test notification - schedules a notification in 10 seconds for testing
 */
export async function testNotification(): Promise<void> {
  try {
    console.log('[Notifications] 🧪 Testing notification in 10 seconds...');

    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) {
      console.log('[Notifications] ❌ Cannot test - no permission');
      return;
    }

    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: '🧪 Test Notification',
        body: 'If you see this, notifications are working!',
        sound: 'default',
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 10,
        repeats: false,
      },
    });

    console.log('[Notifications] ✅ Test notification scheduled:', notificationId);
    console.log('[Notifications] You should receive a notification in 10 seconds');
  } catch (error) {
    console.error('[Notifications] ❌ Test notification failed:', error);
  }
}
