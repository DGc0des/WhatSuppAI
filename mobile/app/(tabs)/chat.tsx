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
import { getScheduledSupplements, addScheduledSupplement, type ScheduledSupplement } from '../../lib/scheduleStorage';
import { utcToLocalTimeString, getTodayDateString, localDateTimeToUTC } from '../../lib/timezoneUtils';

interface ScheduleAction {
  supplementId: number;
  supplementName: string;
  time: string;
  dosage: string;
  recurrenceType: 'once' | 'daily' | 'weekly';
  recurrenceDays?: number[] | null;
}

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  actions?: ScheduleAction[];
}

export default function ChatScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const styles = createStyles(theme);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'system',
      content: 'Hello! I\'m your supplement expert. I can help you with:\n\n• Information about supplements and vitamins\n• Schedule your scanned supplements\n• Optimize your supplement routine\n• Answer questions about dosage and timing\n\nHow can I help you today?',
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

  const executeAllSchedules = async (actions: ScheduleAction[]) => {
    try {
      for (const action of actions) {
        // Parse and convert to UTC (same logic as executeScheduleAction)
        let dateTime: string;
        if (action.time.endsWith('Z') || action.time.includes('T') && action.time.includes(':')) {
          // Already in UTC ISO format or close to it
          dateTime = action.time.includes('Z') ? action.time : action.time + 'Z';
        } else if (action.time.includes('T')) {
          // Format: YYYY-MM-DDTHH:MM:00 (assume local time)
          const [datePart, timePart] = action.time.split('T');
          const timeOnly = timePart.split(':').slice(0, 2).join(':');
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
      }

      await loadData();

      Alert.alert(
        'Success',
        `All ${actions.length} supplements have been scheduled!`,
        [{ text: 'OK' }]
      );

      const confirmMessage: Message = {
        id: Date.now().toString(),
        role: 'system',
        content: `✓ All ${actions.length} supplements scheduled successfully!`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, confirmMessage]);
    } catch (error: any) {
      Alert.alert('Error', `Failed to schedule: ${error.message}`);
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
            return `- ${s.supplement.name}: ${time} (${recurrence})`;
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

INSTRUCTIONS:
1. If asked about their supplements, list what's shown in "SUPPLEMENT STACK" above
2. If the user asks to schedule supplements or optimize timing, suggest specific schedules
3. When suggesting schedules, format your response with clear action items using this EXACT format:

   [SCHEDULE_ACTION]
   - Supplement: [exact name from stack list]
   - Time: [HH:MM]
   - Dosage: [e.g., "2 capsules", "1 tablet"]
   - Frequency: [once/daily/weekly]
   - Days: [if weekly, list days like "Mon,Wed,Fri" or leave empty]
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

      // Parse schedule actions from response
      const actions: ScheduleAction[] = [];
      const actionRegex = /\[SCHEDULE_ACTION\]([\s\S]*?)\[END_ACTION\]/g;
      let match;

      // Limit number of actions to prevent abuse
      const MAX_ACTIONS = 10;
      let actionCount = 0;

      while ((match = actionRegex.exec(responseText)) !== null && actionCount < MAX_ACTIONS) {
        actionCount++;

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
              supplementId: supplement.id,
              supplementName: supplement.name,
              time: dateTime,
              dosage: dosageStr,
              recurrenceType: frequencyMatch[1].toLowerCase() as 'once' | 'daily' | 'weekly',
              recurrenceDays,
            });
          }
        }
      }

      // Remove action blocks from the response text shown to user
      const cleanedResponse = responseText.replace(/\[SCHEDULE_ACTION\][\s\S]*?\[END_ACTION\]/g, '').trim();

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
            {item.actions.length === 1 ? (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => executeScheduleAction(item.actions![0])}
              >
                <Text style={styles.actionButtonText}>
                  📅 Schedule {item.actions[0].supplementName}
                </Text>
              </TouchableOpacity>
            ) : (
              <>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => executeAllSchedules(item.actions!)}
                >
                  <Text style={styles.actionButtonText}>
                    📅 Schedule All ({item.actions.length})
                  </Text>
                </TouchableOpacity>
                {item.actions.map((action, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[styles.actionButton, styles.secondaryActionButton]}
                    onPress={() => executeScheduleAction(action)}
                  >
                    <Text style={styles.secondaryActionButtonText}>
                      {action.supplementName} at {action.time.split('T')[1].substring(0, 5)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </>
            )}
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
