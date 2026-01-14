import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { askGpt } from '../../lib/api';
import { getAllStack, type Supplement } from '../../lib/storage';
import {
  getScheduledSupplements,
  addScheduledSupplement,
  updateScheduledSupplement,
  deleteScheduledSupplement,
  markSupplementAsTaken,
  unmarkSupplementAsTaken,
  type ScheduledSupplement
} from '../../lib/scheduleStorage';
import { utcToLocalTimeString, getTodayDateString, localDateTimeToUTC } from '../../lib/timezoneUtils';

interface ScheduleAction {
  supplementId: number;
  supplementName: string;
  time: string;
  dosage: string;
  recurrenceType: 'once' | 'daily' | 'weekly';
  recurrenceDays?: number[] | null;
}

interface MarkTakenAction {
  scheduleId: number;
  supplementName: string;
  mark: boolean; // true = mark as taken, false = unmark
}

interface UpdateDosageAction {
  scheduleId: number;
  supplementName: string;
  newDosage: string;
}

interface DeleteScheduleAction {
  scheduleId: number;
  supplementName: string;
}

type Action =
  | { type: 'schedule'; data: ScheduleAction }
  | { type: 'mark_taken'; data: MarkTakenAction }
  | { type: 'update_dosage'; data: UpdateDosageAction }
  | { type: 'delete_schedule'; data: DeleteScheduleAction };

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  actions?: Action[];
}

export default function ChatScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const styles = createStyles(theme);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'system',
      content: 'Hello! I\'m your supplement expert. I can help you with:\n\n• Information about supplements and vitamins\n• Schedule your scanned supplements\n• Mark supplements as taken or not taken\n• Update dosage for your schedules\n• Delete schedules\n• Optimize your supplement routine\n• Answer questions about dosage and timing\n\nHow can I help you today?',
      timestamp: new Date(),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [scannedSupplements, setScannedSupplements] = useState<Supplement[]>([]);
  const [scheduledSupplements, setScheduledSupplements] = useState<ScheduledSupplement[]>([]);
  const flatListRef = useRef<FlatList>(null);

  // Load data when screen focuses
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const loadData = async () => {
    const stack = await getAllStack();
    const scheduled = await getScheduledSupplements();
    setScannedSupplements(stack);
    setScheduledSupplements(scheduled);
  };

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  const executeScheduleAction = async (action: ScheduleAction) => {
    try {
      // action.time is already in UTC format (ISO string) from GPT response parsing
      // If it's not in UTC format (doesn't end with Z and isn't full ISO), convert it
      let dateTime: string;
      if (action.time.endsWith('Z') || action.time.includes('T') && action.time.includes(':')) {
        // Already in UTC ISO format or close to it
        dateTime = action.time.includes('Z') ? action.time : action.time + 'Z';
      } else if (action.time.includes('T')) {
        // Format: YYYY-MM-DDTHH:MM:00 (assume local time)
        const [datePart, timePart] = action.time.split('T');
        const timeOnly = timePart.split(':').slice(0, 2).join(':'); // Get HH:MM
        dateTime = localDateTimeToUTC(datePart, timeOnly);
      } else if (action.time.includes(' ')) {
        // Format: YYYY-MM-DD HH:MM (assume local time)
        const [datePart, timePart] = action.time.split(' ');
        dateTime = localDateTimeToUTC(datePart, timePart);
      } else {
        // Fallback: use today's date with the time (assume local time)
        const today = getTodayDateString();
        dateTime = localDateTimeToUTC(today, action.time);
      }

      await addScheduledSupplement(
        action.supplementId,
        dateTime,
        action.recurrenceType,
        action.recurrenceDays || null,
        null,
        action.dosage
      );

      await loadData();

      Alert.alert(
        'Success',
        `${action.supplementName} has been scheduled!`,
        [{ text: 'OK' }]
      );

      // Add confirmation message
      const confirmMessage: Message = {
        id: Date.now().toString(),
        role: 'system',
        content: `✓ ${action.supplementName} scheduled successfully!`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, confirmMessage]);
    } catch (error: any) {
      Alert.alert('Error', `Failed to schedule: ${error.message}`);
    }
  };

  const executeMarkTakenAction = async (action: MarkTakenAction) => {
    try {
      if (action.mark) {
        await markSupplementAsTaken(action.scheduleId);
      } else {
        await unmarkSupplementAsTaken(action.scheduleId);
      }

      await loadData();

      const confirmMessage: Message = {
        id: Date.now().toString(),
        role: 'system',
        content: `✓ ${action.supplementName} marked as ${action.mark ? 'taken' : 'not taken'}!`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, confirmMessage]);
    } catch (error: any) {
      Alert.alert('Error', `Failed to update: ${error.message}`);
    }
  };

  const executeUpdateDosageAction = async (action: UpdateDosageAction) => {
    try {
      await updateScheduledSupplement(action.scheduleId, {
        dosage: action.newDosage,
      });

      await loadData();

      const confirmMessage: Message = {
        id: Date.now().toString(),
        role: 'system',
        content: `✓ ${action.supplementName} dosage updated to ${action.newDosage}!`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, confirmMessage]);
    } catch (error: any) {
      Alert.alert('Error', `Failed to update dosage: ${error.message}`);
    }
  };

  const executeDeleteScheduleAction = async (action: DeleteScheduleAction) => {
    try {
      await deleteScheduledSupplement(action.scheduleId);

      await loadData();

      const confirmMessage: Message = {
        id: Date.now().toString(),
        role: 'system',
        content: `✓ ${action.supplementName} schedule deleted!`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, confirmMessage]);
    } catch (error: any) {
      Alert.alert('Error', `Failed to delete schedule: ${error.message}`);
    }
  };

  const executeAction = async (action: Action) => {
    switch (action.type) {
      case 'schedule':
        await executeScheduleAction(action.data);
        break;
      case 'mark_taken':
        await executeMarkTakenAction(action.data);
        break;
      case 'update_dosage':
        await executeUpdateDosageAction(action.data);
        break;
      case 'delete_schedule':
        await executeDeleteScheduleAction(action.data);
        break;
    }
  };


  // Input sanitization function
  const sanitizeInput = (input: string): string => {
    let sanitized = input.trim();

    // Remove special characters that could be used for injection
    sanitized = sanitized
      .replace(/\[SCHEDULE_ACTION\]/gi, '') // Remove action markers
      .replace(/\[END_ACTION\]/gi, '')
      .replace(/[<>]/g, '') // Remove HTML-like tags
      .replace(/[\\\r\n\t]/g, ' ') // Replace special whitespace with space
      .replace(/["'`]/g, '') // Remove quotes that could break string literals
      .replace(/\{|\}/g, '') // Remove braces
      .replace(/;/g, '') // Remove semicolons
      .substring(0, 500); // Enforce length limit

    // Collapse multiple spaces into one
    sanitized = sanitized.replace(/\s+/g, ' ').trim();

    return sanitized;
  };

  const handleSend = async () => {
    if (!inputText.trim() || loading) return;

    // Sanitize user input
    const sanitizedContent = sanitizeInput(inputText);

    // Validate sanitized input
    if (sanitizedContent.length === 0) {
      Alert.alert('Invalid Input', 'Please enter a valid message');
      return;
    }

    if (sanitizedContent.length < 3) {
      Alert.alert('Too Short', 'Please enter at least 3 characters');
      return;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: sanitizedContent,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText('');
    setLoading(true);

    try {
      // Build context about user's supplements
      const scannedList = scannedSupplements.length > 0
        ? scannedSupplements.map(s => `- ${s.name} (${s.brand})`).join('\n')
        : 'None scanned yet';

      const scheduledList = scheduledSupplements.length > 0
        ? scheduledSupplements.map(s => {
            // Convert UTC time to local time for display
            const time = utcToLocalTimeString(s.scheduled_date);
            const recurrence = s.recurrence_type === 'daily' ? 'daily' : s.recurrence_type === 'weekly' ? 'weekly' : 'once';
            const takenStatus = s.taken ? ' [TAKEN]' : '';
            const dosageInfo = s.dosage ? ` (${s.dosage})` : '';
            return `- ID:${s.id} | ${s.supplement.name}: ${time} ${recurrence}${dosageInfo}${takenStatus}`;
          }).join('\n')
        : 'No schedules yet';

      const supplementPrompt = `You are a knowledgeable supplement and nutrition expert. You have FULL ACCESS to the user's personal supplement data shown below.

===USER'S SUPPLEMENT STACK===
${scannedList}

===USER'S CURRENT SCHEDULE===
${scheduledList}

===USER QUESTION===
"${userMessage.content}"

IMPORTANT: When the user asks about "their supplements" or "their stack", refer to the list above. This is THEIR personal data that you CAN see and access.

CAPABILITIES - You can help users with:
1. Scheduling supplements
2. Marking supplements as taken or not taken
3. Updating dosage for scheduled supplements
4. Deleting schedules
5. Answering supplement questions

INSTRUCTIONS:
1. If asked about their supplements, list what's shown in "SUPPLEMENT STACK" above
2. If asked about their schedule, refer to "CURRENT SCHEDULE" (note the ID numbers and TAKEN status)
3. When the user asks to schedule, mark as taken, update dosage, or delete schedules, format actions using these EXACT formats:

   **TO SCHEDULE A SUPPLEMENT:**
   [SCHEDULE_ACTION]
   - Supplement: [exact name from stack list]
   - Time: [HH:MM]
   - Dosage: [e.g., "2 capsules", "1 tablet"]
   - Frequency: [once/daily/weekly]
   - Days: [if weekly, list days like "Mon,Wed,Fri" or leave empty]
   [END_ACTION]

   **TO MARK A SUPPLEMENT AS TAKEN/NOT TAKEN:**
   [MARK_TAKEN_ACTION]
   - ScheduleID: [ID from schedule list, e.g., "123"]
   - SupplementName: [name for display]
   - Mark: [true for taken, false for not taken]
   [END_ACTION]

   **TO UPDATE DOSAGE:**
   [UPDATE_DOSAGE_ACTION]
   - ScheduleID: [ID from schedule list]
   - SupplementName: [name for display]
   - NewDosage: [e.g., "3 capsules"]
   [END_ACTION]

   **TO DELETE A SCHEDULE:**
   [DELETE_SCHEDULE_ACTION]
   - ScheduleID: [ID from schedule list]
   - SupplementName: [name for display]
   [END_ACTION]

4. For general supplement questions, provide helpful, accurate information
5. Keep responses concise and under 250 words

Provide your expert advice:`;

      const response = await askGpt(supplementPrompt);
      const responseText = response.text || 'Sorry, I couldn\'t generate a response.';

      // Validation helper for parsed action data
      const validateTime = (timeStr: string): boolean => {
        const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
        return timeRegex.test(timeStr);
      };

      const validateDosage = (dosageStr: string): boolean => {
        // Dosage should be reasonable length and contain valid characters
        if (dosageStr.length > 50) return false;
        // Only allow alphanumeric, spaces, and basic units
        const dosageRegex = /^[a-zA-Z0-9\s\.\-]+$/;
        return dosageRegex.test(dosageStr);
      };

      const sanitizeActionField = (field: string, maxLength: number = 100): string => {
        return field
          .replace(/[<>{}[\]\\]/g, '') // Remove potentially dangerous chars
          .replace(/\s+/g, ' ')
          .trim()
          .substring(0, maxLength);
      };

      // Parse all types of actions from response
      const actions: Action[] = [];

      // Limit number of actions to prevent abuse
      const MAX_ACTIONS = 10;

      // Parse SCHEDULE_ACTION
      const scheduleRegex = /\[SCHEDULE_ACTION\]([\s\S]*?)\[END_ACTION\]/g;
      let match;

      while ((match = scheduleRegex.exec(responseText)) !== null && actions.length < MAX_ACTIONS) {
        const actionBlock = match[1];
        const supplementMatch = actionBlock.match(/Supplement:\s*(.+)/i);
        const timeMatch = actionBlock.match(/Time:\s*(\d{1,2}:\d{2})/i);
        const dosageMatch = actionBlock.match(/Dosage:\s*(.+)/i);
        const frequencyMatch = actionBlock.match(/Frequency:\s*(once|daily|weekly)/i);
        const daysMatch = actionBlock.match(/Days:\s*(.+)/i);

        if (supplementMatch && timeMatch && dosageMatch && frequencyMatch) {
          // Sanitize and validate extracted fields
          const supplementName = sanitizeActionField(supplementMatch[1], 100);
          const timeStr = timeMatch[1];
          const dosageStr = sanitizeActionField(dosageMatch[1], 50);

          // Validate time format
          if (!validateTime(timeStr)) {
            console.warn('[Chat] Invalid time format:', timeStr);
            continue;
          }

          // Validate dosage format
          if (!validateDosage(dosageStr)) {
            console.warn('[Chat] Invalid dosage format:', dosageStr);
            continue;
          }

          // Find supplement only from user's actual scanned supplements
          const supplement = scannedSupplements.find(s =>
            s.name.toLowerCase().includes(supplementName.toLowerCase()) ||
            supplementName.toLowerCase().includes(s.name.toLowerCase())
          );

          if (supplement) {
            const time = timeStr.padStart(5, '0'); // Ensure HH:MM format
            const today = getTodayDateString();
            // Convert local date/time to UTC for storage
            const dateTime = localDateTimeToUTC(today, time);

            let recurrenceDays: number[] | null = null;
            if (frequencyMatch[1].toLowerCase() === 'weekly' && daysMatch) {
              const daysStr = sanitizeActionField(daysMatch[1], 50);
              const dayMap: { [key: string]: number } = {
                'sun': 0, 'mon': 1, 'tue': 2, 'wed': 3, 'thu': 4, 'fri': 5, 'sat': 6
              };
              recurrenceDays = daysStr.toLowerCase().split(',')
                .map(d => dayMap[d.trim().substring(0, 3)])
                .filter(d => d !== undefined);

              // Validate days array
              if (recurrenceDays.length === 0) {
                recurrenceDays = null;
              }
            }

            actions.push({
              type: 'schedule',
              data: {
                supplementId: supplement.id,
                supplementName: supplement.name,
                time: dateTime,
                dosage: dosageStr,
                recurrenceType: frequencyMatch[1].toLowerCase() as 'once' | 'daily' | 'weekly',
                recurrenceDays,
              }
            });
          }
        }
      }

      // Parse MARK_TAKEN_ACTION
      const markTakenRegex = /\[MARK_TAKEN_ACTION\]([\s\S]*?)\[END_ACTION\]/g;
      while ((match = markTakenRegex.exec(responseText)) !== null && actions.length < MAX_ACTIONS) {
        const actionBlock = match[1];
        const scheduleIdMatch = actionBlock.match(/ScheduleID:\s*(\d+)/i);
        const supplementNameMatch = actionBlock.match(/SupplementName:\s*(.+)/i);
        const markMatch = actionBlock.match(/Mark:\s*(true|false)/i);

        if (scheduleIdMatch && supplementNameMatch && markMatch) {
          actions.push({
            type: 'mark_taken',
            data: {
              scheduleId: parseInt(scheduleIdMatch[1]),
              supplementName: sanitizeActionField(supplementNameMatch[1], 100),
              mark: markMatch[1].toLowerCase() === 'true',
            }
          });
        }
      }

      // Parse UPDATE_DOSAGE_ACTION
      const updateDosageRegex = /\[UPDATE_DOSAGE_ACTION\]([\s\S]*?)\[END_ACTION\]/g;
      while ((match = updateDosageRegex.exec(responseText)) !== null && actions.length < MAX_ACTIONS) {
        const actionBlock = match[1];
        const scheduleIdMatch = actionBlock.match(/ScheduleID:\s*(\d+)/i);
        const supplementNameMatch = actionBlock.match(/SupplementName:\s*(.+)/i);
        const newDosageMatch = actionBlock.match(/NewDosage:\s*(.+)/i);

        if (scheduleIdMatch && supplementNameMatch && newDosageMatch) {
          const dosageStr = sanitizeActionField(newDosageMatch[1], 50);
          if (validateDosage(dosageStr)) {
            actions.push({
              type: 'update_dosage',
              data: {
                scheduleId: parseInt(scheduleIdMatch[1]),
                supplementName: sanitizeActionField(supplementNameMatch[1], 100),
                newDosage: dosageStr,
              }
            });
          }
        }
      }

      // Parse DELETE_SCHEDULE_ACTION
      const deleteScheduleRegex = /\[DELETE_SCHEDULE_ACTION\]([\s\S]*?)\[END_ACTION\]/g;
      while ((match = deleteScheduleRegex.exec(responseText)) !== null && actions.length < MAX_ACTIONS) {
        const actionBlock = match[1];
        const scheduleIdMatch = actionBlock.match(/ScheduleID:\s*(\d+)/i);
        const supplementNameMatch = actionBlock.match(/SupplementName:\s*(.+)/i);

        if (scheduleIdMatch && supplementNameMatch) {
          actions.push({
            type: 'delete_schedule',
            data: {
              scheduleId: parseInt(scheduleIdMatch[1]),
              supplementName: sanitizeActionField(supplementNameMatch[1], 100),
            }
          });
        }
      }

      // Remove all action blocks from the response text shown to user
      const cleanedResponse = responseText
        .replace(/\[SCHEDULE_ACTION\][\s\S]*?\[END_ACTION\]/g, '')
        .replace(/\[MARK_TAKEN_ACTION\][\s\S]*?\[END_ACTION\]/g, '')
        .replace(/\[UPDATE_DOSAGE_ACTION\][\s\S]*?\[END_ACTION\]/g, '')
        .replace(/\[DELETE_SCHEDULE_ACTION\][\s\S]*?\[END_ACTION\]/g, '')
        .trim();

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: cleanedResponse || responseText,
        timestamp: new Date(),
        actions: actions.length > 0 ? actions : undefined,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error: any) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Sorry, I encountered an error: ${error.message || 'Please try again.'}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    if (item.role === 'system') {
      return (
        <View style={styles.systemMessageContainer}>
          <Text style={styles.systemMessage}>{item.content}</Text>
        </View>
      );
    }

    const isUser = item.role === 'user';
    return (
      <View
        style={[
          styles.messageContainer,
          isUser ? styles.userMessageContainer : styles.assistantMessageContainer,
        ]}
      >
        <View
          style={[
            styles.messageBubble,
            isUser ? styles.userBubble : styles.assistantBubble,
          ]}
        >
          <Text style={[styles.messageText, isUser ? styles.userText : styles.assistantText]}>
            {item.content}
          </Text>
          <Text style={styles.timestamp}>
            {item.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>

        {/* Render action buttons if available */}
        {!isUser && item.actions && item.actions.length > 0 && (
          <View style={styles.actionsContainer}>
            {item.actions.map((action, index) => {
              const getActionButton = () => {
                switch (action.type) {
                  case 'schedule':
                    return (
                      <TouchableOpacity
                        key={index}
                        style={styles.actionButton}
                        onPress={() => executeAction(action)}
                      >
                        <Text style={styles.actionButtonText}>
                          📅 Schedule {action.data.supplementName}
                        </Text>
                      </TouchableOpacity>
                    );
                  case 'mark_taken':
                    return (
                      <TouchableOpacity
                        key={index}
                        style={[styles.actionButton, action.data.mark ? styles.successButton : styles.warningButton]}
                        onPress={() => executeAction(action)}
                      >
                        <Text style={styles.actionButtonText}>
                          {action.data.mark ? '✓' : '○'} Mark {action.data.supplementName} as {action.data.mark ? 'Taken' : 'Not Taken'}
                        </Text>
                      </TouchableOpacity>
                    );
                  case 'update_dosage':
                    return (
                      <TouchableOpacity
                        key={index}
                        style={[styles.actionButton, styles.infoButton]}
                        onPress={() => executeAction(action)}
                      >
                        <Text style={styles.actionButtonText}>
                          💊 Update {action.data.supplementName} to {action.data.newDosage}
                        </Text>
                      </TouchableOpacity>
                    );
                  case 'delete_schedule':
                    return (
                      <TouchableOpacity
                        key={index}
                        style={[styles.actionButton, styles.deleteButton]}
                        onPress={() => executeAction(action)}
                      >
                        <Text style={styles.actionButtonText}>
                          🗑️ Delete {action.data.supplementName} schedule
                        </Text>
                      </TouchableOpacity>
                    );
                }
              };
              return getActionButton();
            })}
          </View>
        )}
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Supplement Expert</Text>
        <Text style={styles.headerSubtitle}>
          {scannedSupplements.length} scanned • {scheduledSupplements.length} scheduled
        </Text>
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messagesList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
      />

      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={theme.buttonPrimary} />
          <Text style={styles.loadingText}>Thinking...</Text>
        </View>
      )}

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={inputText}
          onChangeText={setInputText}
          placeholder="Ask about supplements or say 'schedule my supplements'..."
          placeholderTextColor={theme.inputPlaceholder}
          multiline
          maxLength={500}
          editable={!loading}
          onSubmitEditing={handleSend}
          blurOnSubmit={false}
        />
        <TouchableOpacity
          style={[styles.sendButton, (!inputText.trim() || loading) && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!inputText.trim() || loading}
        >
          <Text style={styles.sendButtonText}>Send</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const createStyles = (theme: typeof Colors.light) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  header: {
    backgroundColor: theme.buttonPrimary,
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 4,
  },
  messagesList: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexGrow: 1,
  },
  messageContainer: {
    marginVertical: 4,
    maxWidth: '85%',
  },
  userMessageContainer: {
    alignSelf: 'flex-end',
  },
  assistantMessageContainer: {
    alignSelf: 'flex-start',
  },
  systemMessageContainer: {
    alignSelf: 'center',
    backgroundColor: theme.cardBackground,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    marginVertical: 8,
    maxWidth: '90%',
    borderWidth: 1,
    borderColor: theme.border,
  },
  systemMessage: {
    fontSize: 14,
    color: theme.info,
    textAlign: 'center',
    lineHeight: 20,
  },
  messageBubble: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  userBubble: {
    backgroundColor: theme.buttonPrimary,
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    backgroundColor: theme.cardBackground,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: theme.border,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  userText: {
    color: '#fff',
  },
  assistantText: {
    color: theme.text,
  },
  timestamp: {
    fontSize: 10,
    color: theme.textMuted,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  actionsContainer: {
    marginTop: 8,
    gap: 6,
  },
  actionButton: {
    backgroundColor: theme.buttonSecondary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  secondaryActionButton: {
    backgroundColor: theme.background,
    borderWidth: 1,
    borderColor: theme.buttonSecondary,
  },
  secondaryActionButtonText: {
    color: theme.buttonSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  successButton: {
    backgroundColor: theme.success,
  },
  warningButton: {
    backgroundColor: theme.warning,
  },
  infoButton: {
    backgroundColor: theme.info,
  },
  deleteButton: {
    backgroundColor: theme.error,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 8,
  },
  loadingText: {
    fontSize: 14,
    color: theme.buttonPrimary,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: theme.cardBackground,
    borderTopWidth: 1,
    borderTopColor: theme.border,
    alignItems: 'flex-end',
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: theme.inputBackground,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 100,
    color: theme.text,
  },
  sendButton: {
    backgroundColor: theme.buttonPrimary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 60,
  },
  sendButtonDisabled: {
    backgroundColor: theme.buttonDisabled,
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});
