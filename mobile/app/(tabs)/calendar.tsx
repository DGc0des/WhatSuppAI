import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, ScrollView, Image, Alert, TextInput, Keyboard, TouchableWithoutFeedback } from 'react-native';
import { Calendar, DateData } from 'react-native-calendars';
import { useFocusEffect } from '@react-navigation/native';
import { getAllScannedSupplements, type ScannedSupplement } from '../../lib/storage';
import { getScheduledSupplements, addScheduledSupplement, deleteScheduledSupplement, updateScheduledSupplement, type ScheduledSupplement } from '../../lib/scheduleStorage';
import { scheduleSupplementNotification, cancelNotification, type NotificationTiming } from '../../lib/notificationService';

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
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [scheduledSupplements, setScheduledSupplements] = useState<ScheduledSupplement[]>([]);
  const [allSupplements, setAllSupplements] = useState<ScannedSupplement[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [markedDates, setMarkedDates] = useState<any>({});

  // Dosage modal state
  const [showDosageModal, setShowDosageModal] = useState(false);
  const [dosageAmount, setDosageAmount] = useState('');
  const [selectedUnit, setSelectedUnit] = useState('capsule');
  const [dosageContext, setDosageContext] = useState<{
    type: 'add' | 'update';
    supplementId?: number;
    time?: string;
    scheduleId?: number;
  } | null>(null);

  const loadData = async () => {
    const scheduled = await getScheduledSupplements();
    const supplements = await getAllScannedSupplements();
    setScheduledSupplements(scheduled);
    setAllSupplements(supplements);

    // Create marked dates for calendar
    const marks: any = {};
    scheduled.forEach(item => {
      const dateKey = item.scheduled_date.split('T')[0];
      if (!marks[dateKey]) {
        marks[dateKey] = { marked: true, dotColor: '#007AFF' };
      }
    });
    setMarkedDates(marks);
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
      // Set today's date as default
      const today = new Date().toISOString().split('T')[0];
      setSelectedDate(today);
    }, [])
  );

  const handleDayPress = (day: DateData) => {
    setSelectedDate(day.dateString);
  };

  const handleAddSupplement = async (supplementId: number, time: string) => {
    if (!selectedDate) {
      Alert.alert('Error', 'Please select a date first');
      return;
    }

    // Show dosage modal
    setDosageAmount('');
    setSelectedUnit('capsule');
    setDosageContext({ type: 'add', supplementId, time });
    setShowDosageModal(true);
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
            const dateTime = `${selectedDate}T${time}:00`;
            await addScheduledSupplement(
              supplementId,
              dateTime,
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
    const dateTime = `${selectedDate}T${time}:00`;
    const supplement = allSupplements.find(s => s.id === supplementId);

    if (!supplement) {
      Alert.alert('Error', 'Supplement not found');
      return;
    }

    // Parse as local time by extracting date/time parts
    const [datePart, timePart] = dateTime.split('T');
    const [year, month, day] = datePart.split('-').map(Number);
    const [hour, minute] = timePart.split(':').map(Number);

    console.log('=== SCHEDULING FROM CALENDAR ===');
    console.log('[Calendar] DateTime string:', dateTime);
    console.log('[Calendar] Parsed components:', { year, month, day, hour, minute });

    const localDate = new Date(year, month - 1, day, hour, minute, 0);

    console.log('[Calendar] Parsed local date:', localDate.toLocaleString());
    console.log('[Calendar] Parsed local date (ISO):', localDate.toISOString());
    console.log('[Calendar] Parsed local date (timestamp):', localDate.getTime());
    console.log('[Calendar] Is valid date?', !isNaN(localDate.getTime()));
    console.log('[Calendar] Notification timing:', notificationTiming);

    // Schedule the notification
    const notificationId = await scheduleSupplementNotification(
      supplement.name,
      supplement.brand,
      localDate,
      notificationTiming,
      dosage
    );

    console.log('[Calendar] Notification ID returned:', notificationId);

    // Add to database with notification info
    await addScheduledSupplement(
      supplementId,
      dateTime,
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
    // Extract time directly from the ISO string to avoid timezone conversion
    const timeString = schedule.scheduled_date.split('T')[1]?.substring(0, 5) || '00:00';
    const currentTime = timeString; // Already in HH:MM format

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

        // Always use today's date when updating time
        // This ensures we're not scheduling notifications in the past
        const targetDate = new Date().toISOString().split('T')[0];
        const newDateTime = `${targetDate}T${text.trim()}:00`;

        console.log('[Calendar] Updating time from', schedule.scheduled_date, 'to', newDateTime);

        // If notification is enabled, cancel old and schedule new
        let newNotificationId = schedule.notification_id;
        if (schedule.notification_enabled) {
          // Cancel old notification
          if (schedule.notification_id) {
            await cancelNotification(schedule.notification_id);
          }

          // Parse as local time
          const [datePart, timePart] = newDateTime.split('T');
          const [year, month, day] = datePart.split('-').map(Number);
          const [hour, minute] = timePart.split(':').map(Number);
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
          scheduled_date: newDateTime,
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

    // Parse as local time
    const [datePart, timePart] = schedule.scheduled_date.split('T');
    const [year, month, day] = datePart.split('-').map(Number);
    const [hour, minute] = timePart.split(':').map(Number);
    const localDate = new Date(year, month - 1, day, hour, minute, 0);

    // Schedule new notification
    const notificationId = await scheduleSupplementNotification(
      schedule.supplement.name,
      schedule.supplement.brand,
      localDate,
      timing,
      schedule.dosage
    );

    // Update database
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

    const selectedDay = new Date(selectedDate).getDay(); // 0=Sunday, 1=Monday, etc.

    return scheduledSupplements.filter(item => {
      const itemDate = item.scheduled_date.split('T')[0];

      // For one-time schedules, check exact date match
      if (item.recurrence_type === 'once') {
        return itemDate === selectedDate;
      }

      // For daily schedules, show on every day (after the start date)
      if (item.recurrence_type === 'daily') {
        return selectedDate >= itemDate;
      }

      // For weekly schedules, show on matching days of the week (after the start date)
      if (item.recurrence_type === 'weekly' && item.recurrence_days) {
        return selectedDate >= itemDate && item.recurrence_days.includes(selectedDay);
      }

      return false;
    }).sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date));
  };

  const renderScheduledItem = ({ item }: { item: ScheduledSupplement }) => {
    // Extract time directly from the ISO string to avoid timezone conversion
    const timeString = item.scheduled_date.split('T')[1]?.substring(0, 5) || '00:00';
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours, 10);
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    const time = `${displayHour.toString().padStart(2, '0')}:${minutes} ${period}`;

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

      <Calendar
        current={selectedDate}
        onDayPress={handleDayPress}
        markedDates={{
          ...markedDates,
          [selectedDate]: {
            ...markedDates[selectedDate],
            selected: true,
            selectedColor: '#007AFF'
          }
        }}
        theme={{
          todayTextColor: '#007AFF',
          selectedDayBackgroundColor: '#007AFF',
          selectedDayTextColor: '#ffffff',
          arrowColor: '#007AFF',
          monthTextColor: '#000',
          textMonthFontWeight: 'bold',
        }}
      />

      <View style={styles.scheduleSection}>
        <View style={styles.scheduleSectionHeader}>
          <Text style={styles.scheduleSectionTitle}>
            {selectedDate ? new Date(selectedDate).toLocaleDateString('en-US', {
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
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Supplement</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>Select time:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.timeSelector}>
              {['08:00', '12:00', '16:00', '20:00'].map(time => (
                <TouchableOpacity
                  key={time}
                  style={styles.timeButton}
                  onPress={() => {
                    // Show supplement list after time is selected
                    Alert.alert(
                      'Select Supplement',
                      'Choose a supplement from your history',
                      [
                        ...allSupplements.map(supp => ({
                          text: supp.name,
                          onPress: () => handleAddSupplement(supp.id, time)
                        })),
                        { text: 'Cancel', style: 'cancel' as 'cancel' }
                      ]
                    );
                  }}
                >
                  <Text style={styles.timeButtonText}>{time}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.modalSubtitle}>Your Supplements:</Text>
            <ScrollView style={styles.supplementList}>
              {allSupplements.length === 0 ? (
                <Text style={styles.emptyText}>No supplements in history</Text>
              ) : (
                allSupplements.map(supp => (
                  <TouchableOpacity
                    key={supp.id}
                    style={styles.supplementItem}
                    onPress={() => {
                      Alert.prompt(
                        'Select Time',
                        'Enter time (HH:MM)',
                        (text) => {
                          if (text) {
                            handleAddSupplement(supp.id, text);
                          }
                        },
                        'plain-text',
                        '08:00'
                      );
                    }}
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

                <ScrollView
                  style={styles.dosageScrollView}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                >
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
                </ScrollView>

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
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
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
    color: '#333',
  },
  addButton: {
    backgroundColor: '#007AFF',
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
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#dee2e6',
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
    backgroundColor: '#f8f9fa',
  },
  scheduledInfo: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  scheduledTime: {
    fontSize: 16,
    fontWeight: '700',
    color: '#007AFF',
    marginBottom: 2,
  },
  scheduledName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  scheduledBrand: {
    fontSize: 12,
    color: '#6c757d',
  },
  dosageLabel: {
    fontSize: 11,
    color: '#28a745',
    marginTop: 2,
    fontWeight: '600',
  },
  recurrenceLabel: {
    fontSize: 11,
    color: '#007AFF',
    marginTop: 4,
    fontWeight: '600',
  },
  notificationLabel: {
    fontSize: 11,
    color: '#ff9500',
    marginTop: 2,
    fontWeight: '600',
  },
  deleteButton: {
    backgroundColor: '#dc3545',
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
    color: '#495057',
    marginBottom: 4,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#6c757d',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  modalClose: {
    fontSize: 24,
    color: '#6c757d',
  },
  modalSubtitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    color: '#333',
  },
  timeSelector: {
    marginBottom: 20,
  },
  timeButton: {
    backgroundColor: '#007AFF',
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
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    marginBottom: 8,
    alignItems: 'center',
  },
  supplementItemImage: {
    width: 40,
    height: 40,
    borderRadius: 6,
    backgroundColor: '#fff',
  },
  supplementItemInfo: {
    flex: 1,
    marginLeft: 12,
  },
  supplementItemName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  supplementItemBrand: {
    fontSize: 12,
    color: '#6c757d',
  },
  // Dosage Modal styles
  dosageModalContent: {
    backgroundColor: '#fff',
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
    color: '#333',
  },
  dosageInput: {
    borderWidth: 1,
    borderColor: '#dee2e6',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#f8f9fa',
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
    borderColor: '#dee2e6',
    backgroundColor: '#fff',
    marginRight: 8,
    marginBottom: 8,
  },
  unitChipSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  unitChipText: {
    fontSize: 14,
    color: '#495057',
    fontWeight: '500',
  },
  unitChipTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  dosagePreview: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  dosagePreviewLabel: {
    fontSize: 12,
    color: '#6c757d',
    marginBottom: 4,
    fontWeight: '500',
  },
  dosagePreviewText: {
    fontSize: 18,
    color: '#000',
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
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  dosageButtonConfirm: {
    backgroundColor: '#007AFF',
  },
  dosageButtonCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#495057',
  },
  dosageButtonConfirmText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
