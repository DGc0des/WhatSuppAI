import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, ScrollView, Image, Alert, TextInput, Keyboard, TouchableWithoutFeedback, KeyboardAvoidingView, Platform } from 'react-native';
import { Calendar, DateData } from 'react-native-calendars';
import { useFocusEffect } from '@react-navigation/native';
import { getAllScannedSupplements, type ScannedSupplement } from '../../lib/storage';
import { getScheduledSupplements, addScheduledSupplement, deleteScheduledSupplement, updateScheduledSupplement, type ScheduledSupplement } from '../../lib/scheduleStorage';
import { scheduleSupplementNotification, cancelNotification, type NotificationTiming } from '../../lib/notificationService';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import {
  getTodayDateString,
  localDateTimeToUTC,
  utcToLocalDateString,
  utcToLocalTimeString,
  utcToLocalDate,
  getDayOfWeekFromUTC,
  utcDateMatchesLocalDate,
  utcDateOnOrAfterLocalDate,
  formatUTCDateForDisplay,
  formatUTCTimeForDisplay,
} from '../../lib/timezoneUtils';

const MEASUREMENT_UNITS = [
  { label: 'capsule(s)', value: 'capsule', needsPlural: true },
  { label: 'tablet(s)', value: 'tablet', needsPlural: true },
  { label: 'softgel(s)', value: 'softgel', needsPlural: true },
  { label: 'pill(s)', value: 'pill', needsPlural: true },
  { label: 'gummy/gummies', value: 'gummy', needsPlural: 'gummies' },
  { label: 'ml', value: 'ml', needsPlural: false },
  { label: 'mg', value: 'mg', needsPlural: false },
  { label: 'g', value: 'g', needsPlural: false },
  { label: 'mcg', value: 'mcg', needsPlural: false },
  { label: 'IU', value: 'IU', needsPlural: false },
  { label: 'drop(s)', value: 'drop', needsPlural: true },
  { label: 'spray(s)', value: 'spray', needsPlural: true },
  { label: 'scoop(s)', value: 'scoop', needsPlural: true },
  { label: 'packet(s)', value: 'packet', needsPlural: true },
];

export default function CalendarScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];

  const [selectedDate, setSelectedDate] = useState<string>('');
  const [scheduledSupplements, setScheduledSupplements] = useState<ScheduledSupplement[]>([]);
  const [allSupplements, setAllSupplements] = useState<ScannedSupplement[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [markedDates, setMarkedDates] = useState<any>({});

  // Schedule modal state (matching explore tab)
  const [selectedSupplement, setSelectedSupplement] = useState<ScannedSupplement | null>(null);
  const [selectedTime, setSelectedTime] = useState('08:00');
  const [dosage, setDosage] = useState('');
  const [recurrenceType, setRecurrenceType] = useState<'once' | 'daily' | 'weekly'>('daily');
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5]); // Default weekdays

  // Dosage modal state (for updates)
  const [showDosageModal, setShowDosageModal] = useState(false);
  const [dosageAmount, setDosageAmount] = useState('');
  const [selectedUnit, setSelectedUnit] = useState('capsule');
  const [dosageContext, setDosageContext] = useState<{
    type: 'add' | 'update';
    supplementId?: number;
    time?: string;
    scheduleId?: number;
  } | null>(null);

  const styles = createStyles(theme);

  const loadData = async () => {
    const scheduled = await getScheduledSupplements();
    const supplements = await getAllScannedSupplements();
    setScheduledSupplements(scheduled);
    setAllSupplements(supplements);

    // Create marked dates for calendar (convert UTC dates to local dates)
    const marks: any = {};
    scheduled.forEach(item => {
      // Convert UTC date to local date string for marking
      const localDateKey = utcToLocalDateString(item.scheduled_date);
      if (!marks[localDateKey]) {
        marks[localDateKey] = { marked: true, dotColor: theme.calendarDot };
      }
    });
    setMarkedDates(marks);
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
      // Set today's date as default (using local timezone)
      const today = getTodayDateString();
      setSelectedDate(today);
    }, [])
  );

  const handleDayPress = (day: DateData) => {
    setSelectedDate(day.dateString);
  };

  const openScheduleModal = (supplement: ScannedSupplement) => {
    setSelectedSupplement(supplement);
    setShowAddModal(true);
    // Reset to defaults
    setSelectedTime('08:00');
    setDosage('');
    setRecurrenceType('daily');
    setSelectedDays([1, 2, 3, 4, 5]);
  };

  const toggleDay = (dayIndex: number) => {
    if (selectedDays.includes(dayIndex)) {
      setSelectedDays(selectedDays.filter(d => d !== dayIndex));
    } else {
      setSelectedDays([...selectedDays, dayIndex].sort());
    }
  };

  const handleScheduleConfirm = async () => {
    if (!selectedSupplement || !selectedDate) {
      Alert.alert('Error', 'Please select a supplement and date');
      return;
    }

    // Convert local date/time to UTC for storage
    const utcDateTime = localDateTimeToUTC(selectedDate, selectedTime);

    const recurrenceDays = recurrenceType === 'weekly' ? selectedDays : null;
    const dosageValue = dosage.trim() || null;

    // Check if notification should be enabled
    Alert.alert(
      'Notification',
      'Do you want to be reminded to take this supplement?',
      [
        {
          text: 'No Reminder',
          onPress: async () => {
            await addScheduledSupplement(
              selectedSupplement.id,
              utcDateTime,
              recurrenceType,
              recurrenceDays,
              null,
              dosageValue,
              false,
              'on-time',
              null
            );
            await loadData();
            setShowAddModal(false);
          }
        },
        {
          text: 'Remind Me',
          onPress: () => handleNotificationTiming(
            selectedSupplement.id,
            selectedTime,
            dosageValue,
            recurrenceType,
            recurrenceDays
          )
        },
        {
          text: 'Cancel',
          style: 'cancel'
        }
      ]
    );
  };

  const handleRecurrenceType = (supplementId: number, time: string, dosage: string | null) => {
    // Ask about recurrence
    Alert.alert(
      'Schedule Type',
      'How often should this supplement be taken?',
      [
        {
          text: 'Once',
          onPress: () => handleNotificationSettings(supplementId, time, dosage, 'once', null)
        },
        {
          text: 'Every Day',
          onPress: () => handleNotificationSettings(supplementId, time, dosage, 'daily', null)
        },
        {
          text: 'Specific Days',
          onPress: () => handleWeeklySchedule(supplementId, time, dosage)
        },
        {
          text: 'Cancel',
          style: 'cancel'
        }
      ]
    );
  };

  const handleNotificationSettings = (
    supplementId: number,
    time: string,
    dosage: string | null,
    recurrenceType: 'once' | 'daily' | 'weekly',
    recurrenceDays: number[] | null
  ) => {
    Alert.alert(
      'Notification',
      'Do you want to be reminded to take this supplement?',
      [
        {
          text: 'No Reminder',
          onPress: async () => {
            // Convert local date/time to UTC for storage
            const utcDateTime = localDateTimeToUTC(selectedDate, time);
            await addScheduledSupplement(
              supplementId,
              utcDateTime,
              recurrenceType,
              recurrenceDays,
              null,
              dosage,
              false,
              'on-time',
              null
            );
            await loadData();
            setShowAddModal(false);
          }
        },
        {
          text: 'Remind Me',
          onPress: () => handleNotificationTiming(supplementId, time, dosage, recurrenceType, recurrenceDays)
        },
        {
          text: 'Cancel',
          style: 'cancel'
        }
      ]
    );
  };

  const handleNotificationTiming = (
    supplementId: number,
    time: string,
    dosage: string | null,
    recurrenceType: 'once' | 'daily' | 'weekly',
    recurrenceDays: number[] | null
  ) => {
    Alert.alert(
      'Reminder Time',
      'When would you like to be reminded?',
      [
        {
          text: 'At scheduled time',
          onPress: () => scheduleWithNotification(
            supplementId,
            time,
            dosage,
            recurrenceType,
            recurrenceDays,
            'on-time'
          )
        },
        {
          text: '30 minutes before',
          onPress: () => scheduleWithNotification(
            supplementId,
            time,
            dosage,
            recurrenceType,
            recurrenceDays,
            '30-min-before'
          )
        },
        {
          text: '1 hour before',
          onPress: () => scheduleWithNotification(
            supplementId,
            time,
            dosage,
            recurrenceType,
            recurrenceDays,
            '1-hour-before'
          )
        },
        {
          text: 'Cancel',
          style: 'cancel'
        }
      ]
    );
  };

  const scheduleWithNotification = async (
    supplementId: number,
    time: string,
    dosage: string | null,
    recurrenceType: 'once' | 'daily' | 'weekly',
    recurrenceDays: number[] | null,
    notificationTiming: NotificationTiming
  ) => {
    const supplement = allSupplements.find(s => s.id === supplementId);

    if (!supplement) {
      Alert.alert('Error', 'Supplement not found');
      return;
    }

    // Convert local date/time to UTC for storage
    const utcDateTime = localDateTimeToUTC(selectedDate, time);
    
    // Create local Date object for notification scheduling
    const [year, month, day] = selectedDate.split('-').map(Number);
    const [hour, minute] = time.split(':').map(Number);
    const localDate = new Date(year, month - 1, day, hour, minute, 0);

    console.log('=== SCHEDULING FROM CALENDAR ===');
    console.log('[Calendar] Local date/time:', `${selectedDate}T${time}:00`);
    console.log('[Calendar] UTC date/time:', utcDateTime);
    console.log('[Calendar] Parsed local date:', localDate.toLocaleString());
    console.log('[Calendar] Parsed local date (ISO):', localDate.toISOString());
    console.log('[Calendar] Notification timing:', notificationTiming);

    // Schedule the notification (using local Date object)
    const notificationId = await scheduleSupplementNotification(
      supplement.name,
      supplement.brand,
      localDate,
      notificationTiming,
      dosage
    );

    console.log('[Calendar] Notification ID returned:', notificationId);

    // Add to database with UTC date/time
    await addScheduledSupplement(
      supplementId,
      utcDateTime,
      recurrenceType,
      recurrenceDays,
      null,
      dosage,
      true,
      notificationTiming,
      notificationId
    );

    await loadData();
    setShowAddModal(false);

    if (notificationId) {
      Alert.alert('Success', 'Supplement scheduled with reminder!');
    } else {
      Alert.alert('Scheduled', 'Supplement scheduled, but notification permission may be needed.');
    }
  };

  const handleWeeklySchedule = (supplementId: number, time: string, dosage: string | null) => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    Alert.alert(
      'Select Days',
      'Choose which days to take this supplement',
      [
        ...days.map((day, index) => ({
          text: day,
          onPress: () => handleNotificationSettings(supplementId, time, dosage, 'weekly', [index])
        })),
        {
          text: 'All Weekdays (Mon-Fri)',
          onPress: () => handleNotificationSettings(supplementId, time, dosage, 'weekly', [1, 2, 3, 4, 5])
        },
        {
          text: 'Cancel',
          style: 'cancel' as 'cancel'
        }
      ]
    );
  };

  const handleDeleteSchedule = async (scheduleId: number) => {
    // Find the schedule to get notification ID
    const schedule = scheduledSupplements.find(s => s.id === scheduleId);

    Alert.alert(
      'Delete Schedule',
      'Are you sure you want to remove this scheduled supplement?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            // Cancel notification if it exists
            if (schedule?.notification_id) {
              await cancelNotification(schedule.notification_id);
            }
            await deleteScheduledSupplement(scheduleId);
            await loadData();
          }
        }
      ]
    );
  };

  const handleUpdateTime = (schedule: ScheduledSupplement) => {
    // Convert UTC time to local time for display
    const currentTime = utcToLocalTimeString(schedule.scheduled_date);
    const currentDate = utcToLocalDateString(schedule.scheduled_date);

    Alert.prompt(
      'Update Time',
      'Enter new time (HH:MM)',
      async (text) => {
        if (!text) return;

        const timeParts = text.trim().split(':');
        if (timeParts.length !== 2) {
          Alert.alert('Error', 'Invalid time format. Use HH:MM');
          return;
        }

        // Convert local date/time to UTC for storage
        const utcDateTime = localDateTimeToUTC(currentDate, text.trim());

        console.log('[Calendar] Updating time from', schedule.scheduled_date, 'to', utcDateTime);

        // If notification is enabled, cancel old and schedule new
        let newNotificationId = schedule.notification_id;
        if (schedule.notification_enabled) {
          // Cancel old notification
          if (schedule.notification_id) {
            await cancelNotification(schedule.notification_id);
          }

          // Parse as local time for notification
          const [year, month, day] = currentDate.split('-').map(Number);
          const [hour, minute] = text.trim().split(':').map(Number);
          const localDate = new Date(year, month - 1, day, hour, minute, 0);

          // Schedule new notification with updated time
          newNotificationId = await scheduleSupplementNotification(
            schedule.supplement.name,
            schedule.supplement.brand,
            localDate,
            schedule.notification_timing,
            schedule.dosage
          );
        }

        const result = await updateScheduledSupplement(schedule.id, {
          scheduled_date: utcDateTime,
          notification_id: newNotificationId
        });

        console.log('[Calendar] Update result:', result);

        await loadData();

        console.log('[Calendar] Data reloaded');

        Alert.alert('Success', 'Time updated!');
      },
      'plain-text',
      currentTime
    );
  };

  const handleUpdateDosage = (schedule: ScheduledSupplement) => {
    // Parse existing dosage
    const existingAmount = schedule.dosage?.split(' ')[0] || '';
    const existingUnit = schedule.dosage?.split(' ')[1] || 'capsule';

    // Find matching unit or default to capsule
    const unitMatch = MEASUREMENT_UNITS.find(u =>
      existingUnit.startsWith(u.value) ||
      (u.needsPlural && typeof u.needsPlural === 'string' && existingUnit === u.needsPlural)
    );

    setDosageAmount(existingAmount);
    setSelectedUnit(unitMatch?.value || 'capsule');
    setDosageContext({ type: 'update', scheduleId: schedule.id });
    setShowDosageModal(true);
  };

  const formatDosage = (amount: string, unit: string): string => {
    const unitConfig = MEASUREMENT_UNITS.find(u => u.value === unit);
    if (!unitConfig) return `${amount} ${unit}`;

    if (!unitConfig.needsPlural) {
      // Units like ml, mg, g, mcg, IU don't need pluralization
      return `${amount} ${unit}`;
    } else if (typeof unitConfig.needsPlural === 'string') {
      // Special case like gummy/gummies
      return `${amount} ${amount === '1' ? unit : unitConfig.needsPlural}`;
    } else {
      // Regular pluralization: capsule/capsules, tablet/tablets, etc.
      return `${amount} ${unit}${amount === '1' ? '' : 's'}`;
    }
  };

  const handleDosageSubmit = async () => {
    if (!dosageContext) return;

    if (!dosageAmount.trim()) {
      if (dosageContext.type === 'update') {
        // Allow removing dosage when updating
        Alert.alert(
          'Remove Dosage',
          'Remove dosage from this schedule?',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Remove',
              style: 'destructive',
              onPress: async () => {
                await updateScheduledSupplement(dosageContext.scheduleId!, { dosage: null });
                await loadData();
                setShowDosageModal(false);
                Alert.alert('Success', 'Dosage removed!');
              }
            }
          ]
        );
      } else {
        // When adding, allow skipping dosage
        Alert.alert(
          'No Dosage',
          'Continue without specifying dosage?',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Continue',
              onPress: () => {
                setShowDosageModal(false);
                handleRecurrenceType(dosageContext.supplementId!, dosageContext.time!, null);
              }
            }
          ]
        );
      }
      return;
    }

    const dosageText = formatDosage(dosageAmount.trim(), selectedUnit);

    if (dosageContext.type === 'add') {
      setShowDosageModal(false);
      handleRecurrenceType(dosageContext.supplementId!, dosageContext.time!, dosageText);
    } else {
      await updateScheduledSupplement(dosageContext.scheduleId!, { dosage: dosageText });
      await loadData();
      setShowDosageModal(false);
      Alert.alert('Success', `Dosage updated to ${dosageText}!`);
    }
  };

  const handleUpdateRecurrence = (schedule: ScheduledSupplement) => {
    Alert.alert(
      'Update Schedule Type',
      'How often should this supplement be taken?',
      [
        {
          text: 'Once',
          onPress: async () => {
            await updateScheduledSupplement(schedule.id, {
              recurrence_type: 'once',
              recurrence_days: null
            });
            await loadData();
            Alert.alert('Success', 'Recurrence updated!');
          }
        },
        {
          text: 'Every Day',
          onPress: async () => {
            await updateScheduledSupplement(schedule.id, {
              recurrence_type: 'daily',
              recurrence_days: null
            });
            await loadData();
            Alert.alert('Success', 'Recurrence updated!');
          }
        },
        {
          text: 'Specific Days',
          onPress: () => handleUpdateWeeklySchedule(schedule)
        },
        {
          text: 'Cancel',
          style: 'cancel'
        }
      ]
    );
  };

  const handleUpdateWeeklySchedule = (schedule: ScheduledSupplement) => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    Alert.alert(
      'Select Days',
      'Choose which days to take this supplement',
      [
        ...days.map((day, index) => ({
          text: day,
          onPress: async () => {
            await updateScheduledSupplement(schedule.id, {
              recurrence_type: 'weekly',
              recurrence_days: [index]
            });
            await loadData();
            Alert.alert('Success', 'Recurrence updated!');
          }
        })),
        {
          text: 'All Weekdays (Mon-Fri)',
          onPress: async () => {
            await updateScheduledSupplement(schedule.id, {
              recurrence_type: 'weekly',
              recurrence_days: [1, 2, 3, 4, 5]
            });
            await loadData();
            Alert.alert('Success', 'Recurrence updated!');
          }
        },
        {
          text: 'Cancel',
          style: 'cancel' as 'cancel'
        }
      ]
    );
  };

  const handleUpdateNotification = (schedule: ScheduledSupplement) => {
    if (schedule.notification_enabled) {
      // Already has notification - offer to change or disable
      Alert.alert(
        'Notification Settings',
        `Current: ${schedule.notification_timing === 'on-time' ? 'At scheduled time' : schedule.notification_timing === '30-min-before' ? '30 minutes before' : '1 hour before'}`,
        [
          {
            text: 'Change Timing',
            onPress: () => handleChangeNotificationTiming(schedule)
          },
          {
            text: 'Turn Off',
            style: 'destructive',
            onPress: async () => {
              // Cancel the notification
              if (schedule.notification_id) {
                await cancelNotification(schedule.notification_id);
              }
              await updateScheduledSupplement(schedule.id, {
                notification_enabled: false,
                notification_id: null
              });
              await loadData();
              Alert.alert('Success', 'Notification turned off');
            }
          },
          {
            text: 'Cancel',
            style: 'cancel'
          }
        ]
      );
    } else {
      // No notification - offer to enable
      handleChangeNotificationTiming(schedule);
    }
  };

  const handleChangeNotificationTiming = (schedule: ScheduledSupplement) => {
    Alert.alert(
      'Reminder Time',
      'When would you like to be reminded?',
      [
        {
          text: 'At scheduled time',
          onPress: () => updateNotificationTiming(schedule, 'on-time')
        },
        {
          text: '30 minutes before',
          onPress: () => updateNotificationTiming(schedule, '30-min-before')
        },
        {
          text: '1 hour before',
          onPress: () => updateNotificationTiming(schedule, '1-hour-before')
        },
        {
          text: 'Cancel',
          style: 'cancel'
        }
      ]
    );
  };

  const updateNotificationTiming = async (
    schedule: ScheduledSupplement,
    timing: NotificationTiming
  ) => {
    // Cancel old notification if exists
    if (schedule.notification_id) {
      await cancelNotification(schedule.notification_id);
    }

    // Convert UTC to local Date for notification scheduling
    const localDate = utcToLocalDate(schedule.scheduled_date);

    // Schedule new notification
    const notificationId = await scheduleSupplementNotification(
      schedule.supplement.name,
      schedule.supplement.brand,
      localDate,
      timing,
      schedule.dosage
    );

    // Update database (UTC date stays the same, only timing changes)
    await updateScheduledSupplement(schedule.id, {
      notification_enabled: true,
      notification_timing: timing,
      notification_id: notificationId
    });

    await loadData();

    if (notificationId) {
      Alert.alert('Success', 'Notification updated!');
    } else {
      Alert.alert('Note', 'Notification settings saved, but permission may be needed.');
    }
  };

  const getSupplementsForDate = () => {
    if (!selectedDate) return [];

    try {
      // Get day of week from selected date (local timezone)
      const selectedDay = new Date(selectedDate + 'T12:00:00').getDay(); // 0=Sunday, 1=Monday, etc.

      return scheduledSupplements.filter(item => {
        try {
          // Convert UTC date to local date string for comparison
          const itemLocalDate = utcToLocalDateString(item.scheduled_date);

          // For one-time schedules, check exact date match (in local timezone)
          if (item.recurrence_type === 'once') {
            return utcDateMatchesLocalDate(item.scheduled_date, selectedDate);
          }

          // For daily schedules, show on every day (on or after the start date)
          if (item.recurrence_type === 'daily') {
            // Convert the UTC scheduled date to local date string for comparison
            const scheduleLocalDate = utcToLocalDateString(item.scheduled_date);
            // Show the schedule if the selected date is on or after the schedule's start date
            // For example: if schedule starts on 2025-12-07, show on 2025-12-07, 2025-12-08, etc.
            return selectedDate >= scheduleLocalDate;
          }

          // For weekly schedules, show on matching days of the week (on or after the start date)
          if (item.recurrence_type === 'weekly' && item.recurrence_days) {
            // Convert the UTC scheduled date to local date string for comparison
            const scheduleLocalDate = utcToLocalDateString(item.scheduled_date);
            // Check if the selected date is on or after the start date AND matches one of the recurrence days
            return selectedDate >= scheduleLocalDate && 
                   item.recurrence_days.includes(selectedDay);
          }

          return false;
        } catch (error) {
          console.error('[Calendar] Error filtering supplement:', error, item);
          return false;
        }
      }).sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date));
    } catch (error) {
      console.error('[Calendar] Error in getSupplementsForDate:', error);
      return [];
    }
  };

  const renderScheduledItem = ({ item }: { item: ScheduledSupplement }) => {
    // Convert UTC time to local time for display
    const time = formatUTCTimeForDisplay(item.scheduled_date);

    const getRecurrenceLabel = () => {
      if (item.recurrence_type === 'daily') return '🔄 Daily';
      if (item.recurrence_type === 'weekly' && item.recurrence_days) {
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const days = item.recurrence_days.map(d => dayNames[d]).join(', ');
        return `🔄 ${days}`;
      }
      return null;
    };

    const getNotificationLabel = () => {
      if (!item.notification_enabled) return null;

      switch (item.notification_timing) {
        case '30-min-before':
          return '🔔 30 min before';
        case '1-hour-before':
          return '🔔 1 hour before';
        case 'on-time':
        default:
          return '🔔 At time';
      }
    };

    return (
      <TouchableOpacity
        style={styles.scheduledCard}
        onPress={() => {
          Alert.alert(
            'Edit Schedule',
            `${item.supplement.name}\n\nWhat would you like to edit?`,
            [
              {
                text: 'Change Time',
                onPress: () => handleUpdateTime(item)
              },
              {
                text: 'Change Dosage',
                onPress: () => handleUpdateDosage(item)
              },
              {
                text: 'Change Frequency',
                onPress: () => handleUpdateRecurrence(item)
              },
              {
                text: item.notification_enabled ? 'Edit Notification' : 'Add Notification',
                onPress: () => handleUpdateNotification(item)
              },
              {
                text: 'Delete',
                style: 'destructive',
                onPress: () => handleDeleteSchedule(item.id)
              },
              {
                text: 'Cancel',
                style: 'cancel'
              }
            ]
          );
        }}
        activeOpacity={0.7}
      >
        <View style={styles.scheduledContent}>
          {item.supplement.image && (
            <Image
              source={{ uri: item.supplement.image }}
              style={styles.scheduledImage}
              resizeMode="contain"
            />
          )}
          <View style={styles.scheduledInfo}>
            <Text style={styles.scheduledTime}>{time}</Text>
            <Text style={styles.scheduledName}>{item.supplement.name}</Text>
            <Text style={styles.scheduledBrand}>{item.supplement.brand}</Text>
            {item.dosage && (
              <Text style={styles.dosageLabel}>💊 {item.dosage}</Text>
            )}
            {getRecurrenceLabel() && (
              <Text style={styles.recurrenceLabel}>{getRecurrenceLabel()}</Text>
            )}
            {getNotificationLabel() && (
              <Text style={styles.notificationLabel}>{getNotificationLabel()}</Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Supplement Schedule</Text>
      </View>

      <View style={{ backgroundColor: theme.background }}>
        <Calendar
          key={colorScheme}
          current={selectedDate}
          onDayPress={handleDayPress}
          markedDates={{
            ...markedDates,
            [selectedDate]: {
              ...markedDates[selectedDate],
              selected: true,
              selectedColor: theme.calendarSelected
            }
          }}
          style={{
            backgroundColor: theme.background,
          }}
          theme={{
            todayTextColor: theme.calendarSelected,
            selectedDayBackgroundColor: theme.calendarSelected,
            selectedDayTextColor: colorScheme === 'dark' ? theme.background : '#ffffff',
            arrowColor: theme.calendarSelected,
            monthTextColor: theme.text,
            textMonthFontWeight: 'bold',
            backgroundColor: theme.background,
            calendarBackground: theme.background,
            textSectionTitleColor: theme.textSecondary,
            dayTextColor: theme.text,
            textDisabledColor: theme.textMuted,
            dotColor: theme.calendarDot,
            selectedDotColor: colorScheme === 'dark' ? theme.background : '#ffffff',
          }}
        />
      </View>

      <View style={styles.scheduleSection}>
        <View style={styles.scheduleSectionHeader}>
          <Text style={styles.scheduleSectionTitle}>
            {selectedDate ? new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric'
            }) : 'Select a date'}
          </Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => setShowAddModal(true)}
          >
            <Text style={styles.addButtonText}>+ Add</Text>
          </TouchableOpacity>
        </View>

        {getSupplementsForDate().length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No supplements scheduled</Text>
            <Text style={styles.emptySubtext}>Tap + Add to schedule a supplement</Text>
          </View>
        ) : (
          <FlatList
            data={getSupplementsForDate()}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderScheduledItem}
            contentContainerStyle={styles.list}
          />
        )}
      </View>

      {/* Add Supplement Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            {!selectedSupplement ? (
              // Step 1: Select Supplement
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Select Supplement</Text>
                  <TouchableOpacity onPress={() => setShowAddModal(false)}>
                    <Text style={styles.modalClose}>✕</Text>
                  </TouchableOpacity>
                </View>
                <ScrollView style={styles.supplementList}>
                  {allSupplements.length === 0 ? (
                    <View style={styles.emptyContainer}>
                      <Text style={styles.emptyText}>No supplements in history</Text>
                      <Text style={styles.emptySubtext}>Scan a supplement first to schedule it</Text>
                    </View>
                  ) : (
                    allSupplements.map(supp => (
                      <TouchableOpacity
                        key={supp.id}
                        style={styles.supplementItem}
                        onPress={() => openScheduleModal(supp)}
                      >
                        {supp.image && (
                          <Image
                            source={{ uri: supp.image }}
                            style={styles.supplementItemImage}
                            resizeMode="contain"
                          />
                        )}
                        <View style={styles.supplementItemInfo}>
                          <Text style={styles.supplementItemName}>{supp.name}</Text>
                          <Text style={styles.supplementItemBrand}>{supp.brand}</Text>
                        </View>
                      </TouchableOpacity>
                    ))
                  )}
                </ScrollView>
              </ScrollView>
            ) : (
              // Step 2: Schedule Details
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Schedule {selectedSupplement.name}</Text>
                  <TouchableOpacity onPress={() => {
                    setSelectedSupplement(null);
                  }}>
                    <Text style={styles.modalClose}>✕</Text>
                  </TouchableOpacity>
                </View>

                {/* Time Selection */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>⏰ Time</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.timeScroll}>
                    {Array.from({ length: 24 }, (_, i) => {
                      const hour = String(i).padStart(2, '0');
                      return `${hour}:00`;
                    }).map((time) => (
                      <TouchableOpacity
                        key={time}
                        style={[
                          styles.timeChip,
                          selectedTime === time && styles.timeChipSelected
                        ]}
                        onPress={() => setSelectedTime(time)}
                      >
                        <Text style={[
                          styles.timeChipText,
                          selectedTime === time && styles.timeChipTextSelected
                        ]}>
                          {time}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                {/* Dosage Input */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>💊 Dosage (Optional)</Text>
                  <TextInput
                    style={styles.dosageInput}
                    placeholder='e.g., "2 capsules", "1 tablet", "5ml"'
                    value={dosage}
                    onChangeText={setDosage}
                    placeholderTextColor={theme.inputPlaceholder}
                  />
                </View>

                {/* Frequency Selection */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>🔄 Frequency</Text>
                  <View style={styles.frequencyButtons}>
                    <TouchableOpacity
                      style={[
                        styles.frequencyButton,
                        recurrenceType === 'once' && styles.frequencyButtonSelected
                      ]}
                      onPress={() => setRecurrenceType('once')}
                    >
                      <Text style={[
                        styles.frequencyButtonText,
                        recurrenceType === 'once' && styles.frequencyButtonTextSelected
                      ]}>
                        Once
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.frequencyButton,
                        recurrenceType === 'daily' && styles.frequencyButtonSelected
                      ]}
                      onPress={() => setRecurrenceType('daily')}
                    >
                      <Text style={[
                        styles.frequencyButtonText,
                        recurrenceType === 'daily' && styles.frequencyButtonTextSelected
                      ]}>
                        Every Day
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.frequencyButton,
                        recurrenceType === 'weekly' && styles.frequencyButtonSelected
                      ]}
                      onPress={() => setRecurrenceType('weekly')}
                    >
                      <Text style={[
                        styles.frequencyButtonText,
                        recurrenceType === 'weekly' && styles.frequencyButtonTextSelected
                      ]}>
                        Specific Days
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Day Selection (only for weekly) */}
                {recurrenceType === 'weekly' && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>📅 Select Days</Text>
                    <View style={styles.daysContainer}>
                      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => (
                        <TouchableOpacity
                          key={day}
                          style={[
                            styles.dayChip,
                            selectedDays.includes(index) && styles.dayChipSelected
                          ]}
                          onPress={() => toggleDay(index)}
                        >
                          <Text style={[
                            styles.dayChipText,
                            selectedDays.includes(index) && styles.dayChipTextSelected
                          ]}>
                            {day}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <TouchableOpacity
                      style={styles.weekdaysButton}
                      onPress={() => setSelectedDays([1, 2, 3, 4, 5])}
                    >
                      <Text style={styles.weekdaysButtonText}>Select All Weekdays</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Action Buttons */}
                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={() => {
                      setSelectedSupplement(null);
                      setShowAddModal(false);
                    }}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.confirmButton,
                      (recurrenceType === 'weekly' && selectedDays.length === 0) && styles.confirmButtonDisabled
                    ]}
                    onPress={handleScheduleConfirm}
                    disabled={recurrenceType === 'weekly' && selectedDays.length === 0}
                  >
                    <Text style={styles.confirmButtonText}>Schedule</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Dosage Modal */}
      <Modal
        visible={showDosageModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowDosageModal(false)}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.modalOverlay}>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={{ width: '100%' }}
            >
              <TouchableWithoutFeedback>
                <View style={styles.dosageModalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>
                    {dosageContext?.type === 'add' ? 'Set Dosage' : 'Update Dosage'}
                  </Text>
                  <TouchableOpacity onPress={() => setShowDosageModal(false)}>
                    <Text style={styles.modalClose}>✕</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.dosageInputContainer}>
                  <View style={styles.dosageAmountSection}>
                    <Text style={styles.dosageModalLabel}>Amount</Text>
                    <TextInput
                      style={styles.dosageInput}
                      value={dosageAmount}
                      onChangeText={setDosageAmount}
                      placeholder="e.g., 2"
                      keyboardType="numeric"
                      returnKeyType="done"
                      onSubmitEditing={Keyboard.dismiss}
                    />
                  </View>

                  <View style={styles.dosageUnitSection}>
                    <Text style={styles.dosageModalLabel}>Unit</Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      style={styles.unitScroll}
                      contentContainerStyle={styles.unitScrollContent}
                      onScrollBeginDrag={Keyboard.dismiss}
                    >
                      {MEASUREMENT_UNITS.map((unit) => (
                        <TouchableOpacity
                          key={unit.value}
                          style={[
                            styles.unitChip,
                            selectedUnit === unit.value && styles.unitChipSelected
                          ]}
                          onPress={() => {
                            Keyboard.dismiss();
                            setSelectedUnit(unit.value);
                          }}
                        >
                          <Text
                            style={[
                              styles.unitChipText,
                              selectedUnit === unit.value && styles.unitChipTextSelected
                            ]}
                          >
                            {unit.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>

                  <View style={styles.dosagePreview}>
                    <Text style={styles.dosagePreviewLabel}>Preview:</Text>
                    <Text style={styles.dosagePreviewText}>
                      {dosageAmount.trim()
                        ? formatDosage(dosageAmount.trim(), selectedUnit)
                        : 'No dosage'}
                    </Text>
                  </View>
                </View>

                <View style={styles.dosageModalButtons}>
                  <TouchableOpacity
                    style={[styles.dosageButton, styles.dosageButtonCancel]}
                    onPress={() => setShowDosageModal(false)}
                  >
                    <Text style={styles.dosageButtonCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.dosageButton, styles.dosageButtonConfirm]}
                    onPress={handleDosageSubmit}
                  >
                    <Text style={styles.dosageButtonConfirmText}>
                      {dosageAmount.trim() ? 'Confirm' : 'Skip'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
            </KeyboardAvoidingView>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

const createStyles = (theme: typeof Colors.light) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: theme.cardBackground,
    borderBottomWidth: 1,
    borderBottomColor: theme.borderLight,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: theme.text,
  },
  scheduleSection: {
    flex: 1,
    padding: 16,
  },
  scheduleSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  scheduleSectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.text,
  },
  addButton: {
    backgroundColor: theme.buttonPrimary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  list: {
    paddingBottom: 16,
  },
  scheduledCard: {
    backgroundColor: theme.cardBackground,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  scheduledContent: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  scheduledImage: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: theme.inputBackground,
  },
  scheduledInfo: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  scheduledTime: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.buttonPrimary,
    marginBottom: 2,
  },
  scheduledName: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 2,
  },
  scheduledBrand: {
    fontSize: 12,
    color: theme.textMuted,
  },
  dosageLabel: {
    fontSize: 11,
    color: theme.success,
    marginTop: 2,
    fontWeight: '600',
  },
  recurrenceLabel: {
    fontSize: 11,
    color: theme.buttonPrimary,
    marginTop: 4,
    fontWeight: '600',
  },
  notificationLabel: {
    fontSize: 11,
    color: theme.warning,
    marginTop: 2,
    fontWeight: '600',
  },
  deleteButton: {
    backgroundColor: theme.buttonDanger,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.textSecondary,
    marginBottom: 4,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: theme.textMuted,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: theme.modalOverlay,
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: theme.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '90%',
  },
  modalContent: {
    backgroundColor: theme.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    color: theme.text,
  },
  timeScroll: {
    flexGrow: 0,
  },
  timeChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: theme.inputBackground,
    marginRight: 8,
  },
  timeChipSelected: {
    backgroundColor: theme.buttonPrimary,
  },
  timeChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.text,
  },
  timeChipTextSelected: {
    color: '#fff',
  },
  frequencyButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  frequencyButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: theme.inputBackground,
    alignItems: 'center',
  },
  frequencyButtonSelected: {
    backgroundColor: theme.buttonPrimary,
  },
  frequencyButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.text,
  },
  frequencyButtonTextSelected: {
    color: '#fff',
  },
  daysContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dayChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: theme.inputBackground,
    minWidth: 48,
    alignItems: 'center',
  },
  dayChipSelected: {
    backgroundColor: theme.buttonSecondary,
  },
  dayChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.text,
  },
  dayChipTextSelected: {
    color: '#fff',
  },
  weekdaysButton: {
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: theme.inputBackground,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.buttonPrimary,
  },
  weekdaysButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.buttonPrimary,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: theme.inputBackground,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.text,
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: theme.buttonPrimary,
    alignItems: 'center',
  },
  confirmButtonDisabled: {
    backgroundColor: theme.textMuted,
    opacity: 0.5,
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 24,
    color: theme.text,
  },
  modalClose: {
    fontSize: 24,
    color: theme.textMuted,
  },
  modalSubtitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    color: theme.text,
  },
  timeSelector: {
    marginBottom: 20,
  },
  timeButton: {
    backgroundColor: theme.buttonPrimary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginRight: 12,
  },
  timeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  supplementList: {
    maxHeight: 300,
  },
  supplementItem: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: theme.cardBackground,
    borderRadius: 8,
    marginBottom: 8,
    alignItems: 'center',
  },
  supplementItemImage: {
    width: 40,
    height: 40,
    borderRadius: 6,
    backgroundColor: theme.inputBackground,
  },
  supplementItemInfo: {
    flex: 1,
    marginLeft: 12,
  },
  supplementItemName: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 2,
  },
  supplementItemBrand: {
    fontSize: 12,
    color: theme.textMuted,
  },
  // Dosage Modal styles
  dosageModalContent: {
    backgroundColor: theme.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  dosageScrollView: {
    flexGrow: 0,
  },
  dosageInputContainer: {
    paddingBottom: 20,
  },
  dosageAmountSection: {
    marginBottom: 20,
  },
  dosageModalLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
    color: theme.text,
  },
  dosageInput: {
    borderWidth: 1,
    borderColor: theme.inputBorder,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: theme.text,
    backgroundColor: theme.inputBackground,
  },
  dosageUnitSection: {
    marginBottom: 20,
  },
  unitScroll: {
    maxHeight: 120,
  },
  unitScrollContent: {
    paddingBottom: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  unitChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.cardBackground,
    marginRight: 8,
    marginBottom: 8,
  },
  unitChipSelected: {
    backgroundColor: theme.buttonPrimary,
    borderColor: theme.buttonPrimary,
  },
  unitChipText: {
    fontSize: 14,
    color: theme.textSecondary,
    fontWeight: '500',
  },
  unitChipTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  dosagePreview: {
    backgroundColor: theme.cardBackground,
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: theme.cardBorder,
  },
  dosagePreviewLabel: {
    fontSize: 12,
    color: theme.textMuted,
    marginBottom: 4,
    fontWeight: '500',
  },
  dosagePreviewText: {
    fontSize: 18,
    color: theme.text,
    fontWeight: '600',
  },
  dosageModalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  dosageButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  dosageButtonCancel: {
    backgroundColor: theme.cardBackground,
    borderWidth: 1,
    borderColor: theme.border,
  },
  dosageButtonConfirm: {
    backgroundColor: theme.buttonPrimary,
  },
  dosageButtonCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  dosageButtonConfirmText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
