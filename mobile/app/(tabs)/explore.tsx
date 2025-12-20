import React, { useState, useCallback, useRef } from 'react';
import { FlatList, StyleSheet, Text, View, Image, TouchableOpacity, RefreshControl, Modal, TextInput, ScrollView, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { getAllStack, removeFromStack, getAllHistory, addToStack, isInStack, deleteFromHistory, type Supplement } from '../../lib/storage';
import { addScheduledSupplement } from '../../lib/scheduleStorage';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { Swipeable, GestureHandlerRootView } from 'react-native-gesture-handler';

export default function StackScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];

  const router = useRouter();
  const [supplements, setSupplements] = useState<Supplement[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Schedule modal state
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [selectedSupplement, setSelectedSupplement] = useState<Supplement | null>(null);
  const [selectedTime, setSelectedTime] = useState('08:00');
  const [dosage, setDosage] = useState('');
  const [recurrenceType, setRecurrenceType] = useState<'once' | 'daily' | 'weekly'>('daily');
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5]); // Default weekdays

  // History modal state
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyItems, setHistoryItems] = useState<Supplement[]>([]);
  const [inStackSet, setInStackSet] = useState<Set<string>>(new Set());
  const [expandedHistoryId, setExpandedHistoryId] = useState<number | null>(null);

  const loadSupplements = async () => {
    const data = await getAllStack();
    setSupplements(data);
  };

  useFocusEffect(
    useCallback(() => {
      loadSupplements();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadSupplements();
    setRefreshing(false);
  };

  const handleDelete = async (id: number) => {
    Alert.alert(
      'Remove from Stack',
      'Are you sure you want to remove this supplement from your stack?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await removeFromStack(id);
            await loadSupplements();
          }
        }
      ]
    );
  };

  const openScheduleModal = (supplement: Supplement) => {
    setSelectedSupplement(supplement);
    setShowScheduleModal(true);
    // Reset to defaults
    setSelectedTime('08:00');
    setDosage('');
    setRecurrenceType('daily');
    setSelectedDays([1, 2, 3, 4, 5]);
  };

  const handleScheduleConfirm = async () => {
    if (!selectedSupplement) return;

    const today = new Date().toISOString().split('T')[0];
    const dateTime = `${today}T${selectedTime}:00`;

    const recurrenceDays = recurrenceType === 'weekly' ? selectedDays : null;
    const dosageValue = dosage.trim() || null;

    await addScheduledSupplement(
      selectedSupplement.id,
      dateTime,
      recurrenceType,
      recurrenceDays,
      null,
      dosageValue
    );

    setShowScheduleModal(false);
    router.push('/(tabs)/calendar');
  };

  const toggleDay = (dayIndex: number) => {
    if (selectedDays.includes(dayIndex)) {
      setSelectedDays(selectedDays.filter(d => d !== dayIndex));
    } else {
      setSelectedDays([...selectedDays, dayIndex].sort());
    }
  };

  const getColorForScore = (score: number) => {
    if (score >= 80) return theme.scoreExcellent;
    if (score >= 60) return theme.scoreGood;
    if (score >= 40) return theme.scoreFair;
    return theme.scorePoor;
  };

  const renderScoreBar = (label: string, score: number | undefined) => {
    if (score == null) return null;
    return (
      <View style={styles.scoreRow}>
        <Text style={styles.scoreLabel}>{label}</Text>
        <View style={styles.scoreBarContainer}>
          <View style={[styles.scoreBarFill, { width: `${score}%`, backgroundColor: getColorForScore(score) }]} />
        </View>
        <Text style={styles.scoreValue}>{score}</Text>
      </View>
    );
  };

  const loadHistory = async () => {
    const history = await getAllHistory();
    setHistoryItems(history);

    // Check which items are in stack
    const stackStatus = new Set<string>();
    for (const item of history) {
      const inStack = await isInStack(item.barcode);
      if (inStack) stackStatus.add(item.barcode);
    }
    setInStackSet(stackStatus);
  };

  const handleAddToStackFromHistory = async (supplement: Supplement) => {
    await addToStack(supplement);
    await loadSupplements();
    await loadHistory(); // Refresh history to update button states
    Alert.alert('Added to Stack', `${supplement.name} has been added to your stack`);
  };

  const handleDeleteFromHistory = async (id: number, name: string) => {
    Alert.alert(
      'Delete from History',
      `Remove "${name}" from your scan history?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteFromHistory(id);
              await loadHistory();
              Alert.alert('Deleted', 'Item removed from history');
            } catch (error: any) {
              Alert.alert('Error', `Failed to delete: ${error.message}`);
            }
          }
        }
      ]
    );
  };

  const renderItem = ({ item }: { item: Supplement }) => {
    const isExpanded = expandedId === item.id;

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => setExpandedId(isExpanded ? null : item.id)}
        activeOpacity={0.7}
      >
        {/* Rating Badge at top right */}
        {item.rating != null && (
          <View style={[styles.ratingBadge, getRatingColor(item.rating)]}>
            <Text style={styles.ratingText}>{item.rating}</Text>
          </View>
        )}

        <View style={styles.cardContent}>
          {item.image && (
            <Image
              source={{ uri: item.image }}
              style={styles.thumbnail}
              resizeMode="contain"
            />
          )}
          <View style={styles.info}>
            <Text style={styles.name} numberOfLines={isExpanded ? undefined : 2}>
              {item.name}
            </Text>
            <Text style={styles.brand}>{item.brand}</Text>
            <Text style={styles.date}>
              {new Date(item.created_at).toLocaleDateString()}
            </Text>
          </View>
        </View>

        {/* Expanded Details */}
        {isExpanded && (
          <>
            {/* Detailed Scores */}
            {item.scores && (
              <View style={styles.scoresContainer}>
                <Text style={styles.scoresTitle}>Detailed Scores</Text>
                {renderScoreBar('Effectiveness', item.scores.effectiveness)}
                {renderScoreBar('Quality & Purity', item.scores.quality)}
                {renderScoreBar('Safety', item.scores.safety)}
                {renderScoreBar('Value', item.scores.value)}
                {renderScoreBar('Satisfaction', item.scores.satisfaction)}
                {renderScoreBar('Taste', item.scores.taste)}
              </View>
            )}

            {item.analysis && (
              <View style={styles.analysisContainer}>
                <Text style={styles.analysisTitle}>Analysis</Text>
                <Text style={styles.analysis}>{item.analysis}</Text>
              </View>
            )}

            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={styles.scheduleButton}
                onPress={(e) => {
                  e.stopPropagation();
                  openScheduleModal(item);
                }}
              >
                <Text style={styles.scheduleText}>📅 Schedule</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={(e) => {
                  e.stopPropagation();
                  handleDelete(item.id);
                }}
              >
                <Text style={styles.deleteText}>🗑️ Delete</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </TouchableOpacity>
    );
  };

  const renderHistoryItem = ({ item }: { item: Supplement }) => {
    const isInStack = inStackSet.has(item.barcode);
    const isExpanded = expandedHistoryId === item.id;

    const renderRightActions = () => (
      <TouchableOpacity
        style={styles.deleteAction}
        onPress={() => handleDeleteFromHistory(item.id, item.name)}
      >
        <Text style={styles.deleteActionText}>Delete</Text>
      </TouchableOpacity>
    );

    return (
      <Swipeable
        renderRightActions={renderRightActions}
        overshootRight={false}
        friction={2}
        rightThreshold={40}
      >
        <TouchableOpacity
          style={styles.historyCard}
          onPress={() => setExpandedHistoryId(isExpanded ? null : item.id)}
          activeOpacity={0.7}
        >
          {item.rating != null && (
            <View style={[styles.ratingBadge, getRatingColor(item.rating)]}>
              <Text style={styles.ratingText}>{item.rating}</Text>
            </View>
          )}

          <View style={styles.historyCardContent}>
            {item.image && (
              <Image
                source={{ uri: item.image }}
                style={styles.historyThumbnail}
                resizeMode="contain"
              />
            )}
            <View style={styles.historyInfo}>
              <Text style={styles.historyName} numberOfLines={isExpanded ? undefined : 2}>
                {item.name}
              </Text>
              <Text style={styles.historyBrand}>{item.brand}</Text>
              <Text style={styles.historyDate}>
                {new Date(item.created_at).toLocaleDateString()}
              </Text>
            </View>
          </View>

          {isExpanded && (
            <>
              {item.scores && (
                <View style={styles.scoresContainer}>
                  <Text style={styles.scoresTitle}>Scores</Text>
                  {renderScoreBar('Effectiveness', item.scores.effectiveness)}
                  {renderScoreBar('Safety', item.scores.safety)}
                  {renderScoreBar('Quality', item.scores.quality)}
                  {renderScoreBar('Value', item.scores.value)}
                  {renderScoreBar('Satisfaction', item.scores.satisfaction)}
                  {renderScoreBar('Taste', item.scores.taste)}
                </View>
              )}

              {item.analysis && (
                <View style={styles.analysisContainer}>
                  <Text style={styles.analysisTitle}>Analysis</Text>
                  <Text style={styles.analysis}>{item.analysis}</Text>
                </View>
              )}
            </>
          )}

          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[
                styles.addToStackButton,
                isInStack && styles.addToStackButtonDisabled
              ]}
              onPress={(e) => {
                e.stopPropagation();
                if (!isInStack) handleAddToStackFromHistory(item);
              }}
              disabled={isInStack}
            >
              <Text style={[
                styles.addToStackButtonText,
                isInStack && styles.addToStackButtonTextDisabled
              ]}>
                {isInStack ? '✓ In Stack' : '+ Add to Stack'}
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Swipeable>
    );
  };

  const getRatingColor = (rating: number) => {
    if (rating >= 80) return { backgroundColor: theme.scoreExcellent };
    if (rating >= 60) return { backgroundColor: theme.scoreGood };
    if (rating >= 40) return { backgroundColor: theme.scoreFair };
    return { backgroundColor: theme.scorePoor };
  };

  const timeOptions = Array.from({ length: 24 }, (_, i) => {
    const hour = i.toString().padStart(2, '0');
    return [`${hour}:00`, `${hour}:30`];
  }).flat();

  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const styles = createStyles(theme);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>My Stack</Text>
          <Text style={styles.subtitle}>{supplements.length} supplement{supplements.length !== 1 ? 's' : ''}</Text>
        </View>
        <TouchableOpacity
          style={styles.historyButton}
          onPress={async () => {
            await loadHistory();
            setShowHistoryModal(true);
          }}
        >
          <Text style={styles.historyButtonText}>📜 History</Text>
        </TouchableOpacity>
      </View>
      {supplements.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Your stack is empty</Text>
          <Text style={styles.emptySubtext}>Scan a supplement to start building your stack!</Text>
        </View>
      ) : (
        <FlatList
          data={supplements}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        />
      )}

      {/* Schedule Modal */}
      <Modal
        visible={showScheduleModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowScheduleModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>Schedule {selectedSupplement?.name}</Text>

              {/* Time Selection */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>⏰ Time</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.timeScroll}>
                  {timeOptions.map((time) => (
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
                    {daysOfWeek.map((day, index) => (
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
                  onPress={() => setShowScheduleModal(false)}
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
          </View>
        </View>
      </Modal>

      {/* History Modal */}
      <Modal
        visible={showHistoryModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowHistoryModal(false)}
      >
        <View style={styles.historyModalOverlay}>
          <View style={styles.historyModalContainer}>
            <View style={styles.historyModalHeader}>
              <Text style={styles.historyModalTitle}>History</Text>
              <TouchableOpacity
                onPress={() => setShowHistoryModal(false)}
                style={styles.historyCloseButton}
              >
                <Text style={styles.historyCloseButtonText}>✕</Text>
              </TouchableOpacity>
            </View>
            {historyItems.length === 0 ? (
              <View style={styles.historyEmptyContainer}>
                <Text style={styles.historyEmptyText}>No history yet</Text>
                <Text style={styles.historyEmptySubtext}>Scanned supplements will appear here</Text>
              </View>
            ) : (
              <FlatList
                data={historyItems}
                keyExtractor={(item) => String(item.id)}
                renderItem={renderHistoryItem}
                contentContainerStyle={styles.historyList}
              />
            )}
          </View>
        </View>
      </Modal>
      </View>
    </GestureHandlerRootView>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: theme.text,
  },
  subtitle: {
    fontSize: 14,
    color: theme.textMuted,
    marginTop: 4,
  },
  historyButton: {
    backgroundColor: theme.buttonPrimary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  historyButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  list: {
    padding: 16,
  },
  card: {
    backgroundColor: theme.cardBackground,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    position: 'relative',
  },
  cardContent: {
    flexDirection: 'row',
  },
  thumbnail: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: theme.inputBackground,
  },
  info: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  scoresContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.borderLight,
  },
  scoresTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: theme.text,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  scoreLabel: {
    fontSize: 12,
    color: theme.textMuted,
    width: 100,
    fontWeight: '500',
  },
  scoreBarContainer: {
    flex: 1,
    height: 8,
    backgroundColor: theme.borderLight,
    borderRadius: 4,
    overflow: 'hidden',
    marginHorizontal: 8,
  },
  scoreBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  scoreValue: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.text,
    width: 30,
    textAlign: 'right',
  },
  analysisContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.borderLight,
  },
  analysisTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
    color: theme.text,
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
    paddingRight: 50,
    color: theme.text,
  },
  ratingBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ratingText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  brand: {
    fontSize: 13,
    color: theme.textMuted,
    marginBottom: 2,
  },
  date: {
    fontSize: 11,
    color: theme.textLight,
  },
  analysis: {
    fontSize: 13,
    color: theme.textSecondary,
    lineHeight: 18,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  scheduleButton: {
    backgroundColor: theme.buttonPrimary,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    flex: 1,
  },
  scheduleText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  deleteButton: {
    backgroundColor: theme.buttonDanger,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    flex: 1,
  },
  deleteText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.textSecondary,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: theme.textMuted,
    textAlign: 'center',
  },
  // Modal styles
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
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 24,
    color: theme.text,
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
    backgroundColor: theme.buttonDisabled,
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  // History Modal styles
  historyModalOverlay: {
    flex: 1,
    backgroundColor: theme.modalOverlay,
    justifyContent: 'flex-start',
    paddingTop: 60,
  },
  historyModalContainer: {
    backgroundColor: theme.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    flex: 1,
  },
  historyModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.borderLight,
  },
  historyModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.text,
  },
  historyCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.inputBackground,
    justifyContent: 'center',
    alignItems: 'center',
  },
  historyCloseButtonText: {
    fontSize: 20,
    color: theme.textMuted,
    fontWeight: '600',
  },
  historyList: {
    padding: 16,
  },
  historyCard: {
    backgroundColor: theme.cardBackground,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    position: 'relative',
  },
  historyCardContent: {
    flexDirection: 'row',
  },
  historyThumbnail: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: theme.inputBackground,
  },
  historyInfo: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  historyName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
    paddingRight: 50,
    color: theme.text,
  },
  historyBrand: {
    fontSize: 12,
    color: theme.textMuted,
    marginBottom: 2,
  },
  historyDate: {
    fontSize: 11,
    color: theme.textLight,
  },
  addToStackButton: {
    backgroundColor: theme.buttonSecondary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    flex: 1,
  },
  addToStackButtonDisabled: {
    backgroundColor: theme.borderLight,
  },
  addToStackButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  addToStackButtonTextDisabled: {
    color: theme.textMuted,
  },
  historyEmptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  historyEmptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.textSecondary,
    marginBottom: 8,
    textAlign: 'center',
  },
  historyEmptySubtext: {
    fontSize: 13,
    color: theme.textMuted,
    textAlign: 'center',
  },
  deleteAction: {
    backgroundColor: theme.buttonDanger,
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingHorizontal: 20,
    marginBottom: 8,
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
  },
  deleteActionText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
