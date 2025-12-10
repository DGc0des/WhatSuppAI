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
import { askGpt } from '../../lib/api';
import { getAllStack, type Supplement } from '../../lib/storage';
import { getScheduledSupplements, addScheduledSupplement, type ScheduledSupplement } from '../../lib/scheduleStorage';

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
      const dateTime = action.time; // Expected format: YYYY-MM-DDTHH:MM:00
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
        await addScheduledSupplement(
          action.supplementId,
          action.time,
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

  const handleSend = async () => {
    if (!inputText.trim() || loading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputText.trim(),
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
            const time = new Date(s.scheduled_date).toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
              hour12: false
            });
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

      // Parse schedule actions from response
      const actions: ScheduleAction[] = [];
      const actionRegex = /\[SCHEDULE_ACTION\]([\s\S]*?)\[END_ACTION\]/g;
      let match;

      while ((match = actionRegex.exec(responseText)) !== null) {
        const actionBlock = match[1];
        const supplementMatch = actionBlock.match(/Supplement:\s*(.+)/i);
        const timeMatch = actionBlock.match(/Time:\s*(\d{1,2}:\d{2})/i);
        const dosageMatch = actionBlock.match(/Dosage:\s*(.+)/i);
        const frequencyMatch = actionBlock.match(/Frequency:\s*(once|daily|weekly)/i);
        const daysMatch = actionBlock.match(/Days:\s*(.+)/i);

        if (supplementMatch && timeMatch && dosageMatch && frequencyMatch) {
          const supplementName = supplementMatch[1].trim();
          const supplement = scannedSupplements.find(s =>
            s.name.toLowerCase().includes(supplementName.toLowerCase()) ||
            supplementName.toLowerCase().includes(s.name.toLowerCase())
          );

          if (supplement) {
            const time = timeMatch[1];
            const today = new Date().toISOString().split('T')[0];
            const dateTime = `${today}T${time.padStart(5, '0')}:00`;

            let recurrenceDays: number[] | null = null;
            if (frequencyMatch[1].toLowerCase() === 'weekly' && daysMatch) {
              const daysStr = daysMatch[1].trim();
              const dayMap: { [key: string]: number } = {
                'sun': 0, 'mon': 1, 'tue': 2, 'wed': 3, 'thu': 4, 'fri': 5, 'sat': 6
              };
              recurrenceDays = daysStr.toLowerCase().split(',')
                .map(d => dayMap[d.trim().substring(0, 3)])
                .filter(d => d !== undefined);
            }

            actions.push({
              supplementId: supplement.id,
              supplementName: supplement.name,
              time: dateTime,
              dosage: dosageMatch[1].trim(),
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
      keyboardVerticalOffset={90}
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
          <ActivityIndicator size="small" color="#007AFF" />
          <Text style={styles.loadingText}>Thinking...</Text>
        </View>
      )}

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={inputText}
          onChangeText={setInputText}
          placeholder="Ask about supplements or say 'schedule my supplements'..."
          placeholderTextColor="#999"
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#007AFF',
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
    color: '#e0e0e0',
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
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    marginVertical: 8,
    maxWidth: '90%',
  },
  systemMessage: {
    fontSize: 14,
    color: '#1976d2',
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
    backgroundColor: '#007AFF',
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  userText: {
    color: '#fff',
  },
  assistantText: {
    color: '#000',
  },
  timestamp: {
    fontSize: 10,
    color: '#999',
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  actionsContainer: {
    marginTop: 8,
    gap: 6,
  },
  actionButton: {
    backgroundColor: '#28a745',
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
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#28a745',
  },
  secondaryActionButtonText: {
    color: '#28a745',
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
    color: '#007AFF',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    alignItems: 'flex-end',
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 100,
    color: '#000',
  },
  sendButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 60,
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});
