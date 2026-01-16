import React, { useState, useCallback } from 'react';
import { FlatList, StyleSheet, Text, View, Image, TouchableOpacity, RefreshControl, Modal, TextInput, ScrollView, Alert, KeyboardAvoidingView, Platform, Dimensions } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { getAllStack, removeFromStack, getAllHistory, addToStack, isInStack, deleteFromHistory, type Supplement } from '../../lib/storage';
import { addScheduledSupplement } from '../../lib/scheduleStorage';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Swipeable, GestureHandlerRootView } from 'react-native-gesture-handler';
import { getTodayDateString, localDateTimeToUTC } from '../../lib/timezoneUtils';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const MEASUREMENT_UNITS = [
  { label: 'capsule', value: 'capsule' },
  { label: 'tablet', value: 'tablet' },
  { label: 'softgel', value: 'softgel' },
  { label: 'pill', value: 'pill' },
  { label: 'gummy', value: 'gummy' },
  { label: 'ml', value: 'ml' },
  { label: 'mg', value: 'mg' },
  { label: 'g', value: 'g' },
  { label: 'mcg', value: 'mcg' },
  { label: 'IU', value: 'IU' },
  { label: 'drop', value: 'drop' },
  { label: 'spray', value: 'spray' },
  { label: 'scoop', value: 'scoop' },
  { label: 'packet', value: 'packet' },
];

export default function StackScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const router = useRouter();
  const [supplements, setSupplements] = useState<Supplement[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Schedule modal state
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [selectedSupplement, setSelectedSupplement] = useState<Supplement | null>(null);
  const [selectedTime, setSelectedTime] = useState('08:00');
  const [dosageAmount, setDosageAmount] = useState('');
  const [dosageUnit, setDosageUnit] = useState('capsule');
  const [showUnitPicker, setShowUnitPicker] = useState(false);
  const [recurrenceType, setRecurrenceType] = useState<'once' | 'daily' | 'weekly'>('daily');
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5]);

  // History modal state
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyItems, setHistoryItems] = useState<Supplement[]>([]);
  const [inStackSet, setInStackSet] = useState<Set<string>>(new Set());
  const [expandedHistoryId, setExpandedHistoryId] = useState<number | null>(null);

  // Warm, botanical palette inspired by the light-mode reference
  const colors = {
    // Warm cream backgrounds
    background: isDark ? '#1A1915' : '#F6F2E8',
    card: isDark ? '#252320' : '#FBF8F0',
    cardAlt: isDark ? '#2D2A26' : '#F1EBDD',

    // Text
    text: isDark ? '#F0EDE6' : '#1F241F',
    textSecondary: isDark ? '#A8A49C' : '#6F776B',
    textMuted: isDark ? '#706C65' : '#91988E',

    // Deep green accent
    olive: isDark ? '#7D8B6A' : '#0F4B2E',
    oliveDark: isDark ? '#6B7A5A' : '#0B3A23',
    oliveLight: isDark ? 'rgba(125, 139, 106, 0.25)' : 'rgba(15, 75, 46, 0.08)',

    // Warm brown accent
    brown: isDark ? '#A68B6A' : '#9B8A67',
    brownLight: isDark ? 'rgba(166, 139, 106, 0.2)' : 'rgba(155, 138, 103, 0.12)',

    // Functional
    danger: '#B5635A',
    dangerLight: isDark ? 'rgba(181, 99, 90, 0.2)' : 'rgba(181, 99, 90, 0.1)',

    // Borders
    border: isDark ? '#3A3632' : '#E4DDCF',
    borderLight: isDark ? '#2F2C28' : '#F1EBDD',

    // Rating - earthy tones
    excellent: isDark ? '#6B8E5A' : '#0F4B2E',
    good: '#B5A048',
    fair: '#C4883A',
    poor: '#B5635A',
  };

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
      'Remove Supplement',
      'Remove this supplement from your stack?',
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
    setSelectedTime('08:00');
    setDosageAmount('');
    setDosageUnit('capsule');
    setRecurrenceType('daily');
    setSelectedDays([1, 2, 3, 4, 5]);
  };

  const handleScheduleConfirm = async () => {
    if (!selectedSupplement) return;

    const today = getTodayDateString();
    const utcDateTime = localDateTimeToUTC(today, selectedTime);
    const recurrenceDays = recurrenceType === 'weekly' ? selectedDays : null;

    const dosageValue = dosageAmount.trim()
      ? `${dosageAmount.trim()} ${dosageUnit}${parseFloat(dosageAmount) !== 1 && !['ml', 'mg', 'g', 'mcg', 'IU'].includes(dosageUnit) ? 's' : ''}`
      : null;

    await addScheduledSupplement(
      selectedSupplement.id,
      utcDateTime,
      recurrenceType,
      recurrenceDays,
      null,
      dosageValue
    );

    setShowScheduleModal(false);
    setShowUnitPicker(false);
    router.push('/(tabs)/calendar');
  };

  const toggleDay = (dayIndex: number) => {
    if (selectedDays.includes(dayIndex)) {
      setSelectedDays(selectedDays.filter(d => d !== dayIndex));
    } else {
      setSelectedDays([...selectedDays, dayIndex].sort());
    }
  };

  const getRatingColor = (rating: number) => {
    if (rating >= 80) return colors.excellent;
    if (rating >= 60) return colors.good;
    if (rating >= 40) return colors.fair;
    return colors.poor;
  };

  const getRatingLabel = (rating: number) => {
    if (rating >= 80) return 'Excellent';
    if (rating >= 60) return 'Good';
    if (rating >= 40) return 'Fair';
    return 'Poor';
  };

  const loadHistory = async () => {
    const history = await getAllHistory();
    setHistoryItems(history);

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
    await loadHistory();
    Alert.alert('Added', `${supplement.name} added to your stack`);
  };

  const handleDeleteFromHistory = async (id: number, name: string) => {
    Alert.alert(
      'Delete',
      `Remove "${name}" from history?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteFromHistory(id);
            await loadHistory();
          }
        }
      ]
    );
  };

  const renderScoreBar = (label: string, score: number | undefined) => {
    if (score == null) return null;
    return (
      <View style={styles.scoreRow}>
        <Text style={[styles.scoreLabel, { color: colors.textSecondary }]}>{label}</Text>
        <View style={[styles.scoreBarBg, { backgroundColor: colors.borderLight }]}>
          <View style={[styles.scoreBarFill, { width: `${score}%`, backgroundColor: getRatingColor(score) }]} />
        </View>
        <Text style={[styles.scoreValue, { color: colors.text }]}>{score}</Text>
      </View>
    );
  };

  const renderItem = ({ item }: { item: Supplement }) => {
    const isExpanded = expandedId === item.id;
    const ratingColor = item.rating != null ? getRatingColor(item.rating) : colors.olive;

    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
        onPress={() => setExpandedId(isExpanded ? null : item.id)}
        activeOpacity={0.7}
      >
        {/* Compact row layout */}
        <View style={styles.cardTop}>
          <View style={[styles.imageContainer, { backgroundColor: colors.cardAlt, borderColor: colors.borderLight }]}>
            {item.image ? (
              <Image source={{ uri: item.image }} style={styles.productImage} resizeMode="contain" />
            ) : (
              <Text style={styles.placeholderEmoji}>💊</Text>
            )}
          </View>

          <View style={styles.cardMeta}>
            <Text style={[styles.productName, { color: colors.text }]} numberOfLines={2}>
              {item.name}
            </Text>
            {item.brand && (
              <Text style={[styles.brandName, { color: colors.textMuted }]}>{item.brand}</Text>
            )}
            {item.rating != null && (
              <View style={[styles.ratingPill, { backgroundColor: ratingColor + '18' }]}>
                <Text style={[styles.ratingPillText, { color: ratingColor }]}>
                  {getRatingLabel(item.rating)}
                </Text>
              </View>
            )}
          </View>

          {item.rating != null && (
            <View style={[styles.ratingBadge, { borderColor: ratingColor, backgroundColor: ratingColor + '12' }]}>
              <Text style={[styles.ratingBadgeText, { color: ratingColor }]}>{item.rating}</Text>
            </View>
          )}
        </View>

        {/* Expanded content */}
        {isExpanded && (
          <View style={[styles.expandedContent, { borderTopColor: colors.borderLight }]}>
            {item.scores && (
              <View style={styles.scoresSection}>
                {renderScoreBar('Effectiveness', item.scores.effectiveness)}
                {renderScoreBar('Quality', item.scores.quality)}
                {renderScoreBar('Safety', item.scores.safety)}
                {renderScoreBar('Value', item.scores.value)}
              </View>
            )}

            {item.analysis && (
              <Text style={[styles.analysisText, { color: colors.textSecondary }]}>
                {item.analysis}
              </Text>
            )}

            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: colors.oliveLight, borderColor: colors.olive }]}
                onPress={(e) => { e.stopPropagation(); openScheduleModal(item); }}
              >
                <Text style={[styles.actionButtonText, { color: colors.olive }]}>Schedule</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: colors.dangerLight, borderColor: colors.danger }]}
                onPress={(e) => { e.stopPropagation(); handleDelete(item.id); }}
              >
                <Text style={[styles.actionButtonText, { color: colors.danger }]}>Remove</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderHistoryItem = ({ item }: { item: Supplement }) => {
    const isInStackItem = inStackSet.has(item.barcode);
    const isExpanded = expandedHistoryId === item.id;

    const renderLeftActions = () => (
      <TouchableOpacity
        style={[styles.swipeAction, { backgroundColor: isInStackItem ? colors.textMuted : colors.olive }]}
        onPress={() => !isInStackItem && handleAddToStackFromHistory(item)}
        disabled={isInStackItem}
      >
        <Text style={styles.swipeActionText}>{isInStackItem ? '✓' : '+'}</Text>
      </TouchableOpacity>
    );

    const renderRightActions = () => (
      <TouchableOpacity
        style={[styles.swipeAction, { backgroundColor: colors.danger }]}
        onPress={() => handleDeleteFromHistory(item.id, item.name)}
      >
        <Text style={styles.swipeActionText}>✕</Text>
      </TouchableOpacity>
    );

    return (
      <Swipeable
        renderLeftActions={renderLeftActions}
        renderRightActions={renderRightActions}
        overshootLeft={false}
        overshootRight={false}
      >
        <TouchableOpacity
          style={[styles.historyCard, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => setExpandedHistoryId(isExpanded ? null : item.id)}
          activeOpacity={0.7}
        >
          <View style={styles.historyContent}>
            <View style={[styles.historyImageBox, { backgroundColor: colors.cardAlt }]}>
              {item.image ? (
                <Image source={{ uri: item.image }} style={styles.historyImage} resizeMode="contain" />
              ) : (
                <Text style={styles.historyPlaceholder}>💊</Text>
              )}
            </View>
            <View style={styles.historyInfo}>
              <Text style={[styles.historyName, { color: colors.text }]} numberOfLines={2}>
                {item.name}
              </Text>
              <Text style={[styles.historyBrand, { color: colors.textMuted }]}>{item.brand}</Text>
            </View>
            {item.rating != null && (
              <View style={[styles.historyRating, { backgroundColor: getRatingColor(item.rating) }]}>
                <Text style={styles.historyRatingText}>{item.rating}</Text>
              </View>
            )}
          </View>

          {isExpanded && item.analysis && (
            <Text style={[styles.historyAnalysis, { color: colors.textSecondary }]} numberOfLines={3}>
              {item.analysis}
            </Text>
          )}
        </TouchableOpacity>
      </Swipeable>
    );
  };

  const timeOptions = Array.from({ length: 24 }, (_, i) => {
    const hour = i.toString().padStart(2, '0');
    return [`${hour}:00`, `${hour}:30`];
  }).flat();

  const daysOfWeek = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: colors.background }]}>
          <View style={styles.headerLeft}>
            <Text style={[styles.headerTitle, { color: colors.text }]}>My Stack</Text>
            <Text style={[styles.headerCount, { color: colors.textMuted }]}>
              {supplements.length} {supplements.length === 1 ? 'item' : 'items'}
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.historyButton, { backgroundColor: colors.brown, shadowColor: colors.brown }]}
            onPress={async () => { await loadHistory(); setShowHistoryModal(true); }}
            activeOpacity={0.8}
          >
            <Text style={styles.historyButtonText}>History</Text>
          </TouchableOpacity>
        </View>

        {/* Main Content */}
        {supplements.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={[styles.emptyIconContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={styles.emptyIcon}>🌿</Text>
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>Start Your Journey</Text>
            <Text style={[styles.emptyDescription, { color: colors.textSecondary }]}>
              Scan a supplement to begin{'\n'}tracking your wellness routine
            </Text>
            <TouchableOpacity
              style={[styles.scanButton, { backgroundColor: colors.olive }]}
              onPress={() => router.push('/')}
              activeOpacity={0.8}
            >
              <Text style={styles.scanButtonText}>Scan Now</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={supplements}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderItem}
            numColumns={1}
            columnWrapperStyle={undefined}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.olive} />
            }
          />
        )}

        {/* Schedule Modal */}
        <Modal
          visible={showScheduleModal}
          animationType="slide"
          transparent={true}
          onRequestClose={() => { setShowScheduleModal(false); setShowUnitPicker(false); }}
        >
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
            <View style={styles.modalOverlay}>
              <View style={[styles.modalContainer, { backgroundColor: colors.card }]}>
                <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
                <ScrollView showsVerticalScrollIndicator={false}>
                  <Text style={[styles.modalTitle, { color: colors.text }]}>Schedule</Text>
                  <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
                    {selectedSupplement?.name}
                  </Text>

                  {/* Time Selection */}
                  <Text style={[styles.modalSectionLabel, { color: colors.textMuted }]}>Time</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.timeScroll}>
                    {timeOptions.map((time) => (
                      <TouchableOpacity
                        key={time}
                        style={[
                          styles.timeOption,
                          { backgroundColor: colors.cardAlt, borderColor: colors.border },
                          selectedTime === time && { backgroundColor: colors.olive, borderColor: colors.olive }
                        ]}
                        onPress={() => setSelectedTime(time)}
                      >
                        <Text style={[
                          styles.timeOptionText,
                          { color: colors.text },
                          selectedTime === time && { color: '#FFFFFF' }
                        ]}>
                          {time}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  {/* Dosage */}
                  <Text style={[styles.modalSectionLabel, { color: colors.textMuted }]}>Dosage</Text>
                  <View style={styles.dosageContainer}>
                    <TextInput
                      style={[styles.dosageInput, { backgroundColor: colors.cardAlt, color: colors.text, borderColor: colors.border }]}
                      placeholder="Amount"
                      placeholderTextColor={colors.textMuted}
                      value={dosageAmount}
                      onChangeText={setDosageAmount}
                      keyboardType="numeric"
                    />
                    <TouchableOpacity
                      style={[styles.unitSelector, { backgroundColor: colors.cardAlt, borderColor: colors.border }]}
                      onPress={() => setShowUnitPicker(true)}
                    >
                      <Text style={[styles.unitSelectorText, { color: colors.text }]}>{dosageUnit}</Text>
                      <Text style={[styles.unitSelectorArrow, { color: colors.textMuted }]}>›</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Frequency */}
                  <Text style={[styles.modalSectionLabel, { color: colors.textMuted }]}>Frequency</Text>
                  <View style={styles.frequencyContainer}>
                    {(['once', 'daily', 'weekly'] as const).map((type) => (
                      <TouchableOpacity
                        key={type}
                        style={[
                          styles.frequencyOption,
                          { backgroundColor: colors.cardAlt, borderColor: colors.border },
                          recurrenceType === type && { backgroundColor: colors.olive, borderColor: colors.olive }
                        ]}
                        onPress={() => setRecurrenceType(type)}
                      >
                        <Text style={[
                          styles.frequencyOptionText,
                          { color: colors.text },
                          recurrenceType === type && { color: '#FFFFFF' }
                        ]}>
                          {type === 'once' ? 'Once' : type === 'daily' ? 'Daily' : 'Weekly'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* Day Selection */}
                  {recurrenceType === 'weekly' && (
                    <View style={styles.daysContainer}>
                      {daysOfWeek.map((day, index) => (
                        <TouchableOpacity
                          key={index}
                          style={[
                            styles.dayOption,
                            { backgroundColor: colors.cardAlt, borderColor: colors.border },
                            selectedDays.includes(index) && { backgroundColor: colors.olive, borderColor: colors.olive }
                          ]}
                          onPress={() => toggleDay(index)}
                        >
                          <Text style={[
                            styles.dayOptionText,
                            { color: colors.text },
                            selectedDays.includes(index) && { color: '#FFFFFF' }
                          ]}>
                            {day}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}

                  {/* Action Buttons */}
                  <View style={styles.modalActions}>
                    <TouchableOpacity
                      style={[styles.modalCancelButton, { backgroundColor: colors.cardAlt, borderColor: colors.border }]}
                      onPress={() => { setShowScheduleModal(false); setShowUnitPicker(false); }}
                    >
                      <Text style={[styles.modalCancelText, { color: colors.text }]}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.modalConfirmButton, { backgroundColor: colors.olive }]}
                      onPress={handleScheduleConfirm}
                    >
                      <Text style={styles.modalConfirmText}>Confirm</Text>
                    </TouchableOpacity>
                  </View>
                </ScrollView>

                {/* Unit Picker */}
                {showUnitPicker && (
                  <View style={styles.unitPickerOverlay}>
                    <TouchableOpacity style={styles.unitPickerBackdrop} onPress={() => setShowUnitPicker(false)} />
                    <View style={[styles.unitPickerContainer, { backgroundColor: colors.card }]}>
                      <View style={[styles.unitPickerHeader, { borderBottomColor: colors.border }]}>
                        <Text style={[styles.unitPickerTitle, { color: colors.text }]}>Unit</Text>
                        <TouchableOpacity onPress={() => setShowUnitPicker(false)}>
                          <Text style={[styles.unitPickerDone, { color: colors.olive }]}>Done</Text>
                        </TouchableOpacity>
                      </View>
                      <ScrollView>
                        {MEASUREMENT_UNITS.map((unit) => (
                          <TouchableOpacity
                            key={unit.value}
                            style={[styles.unitPickerOption, { borderBottomColor: colors.borderLight }]}
                            onPress={() => { setDosageUnit(unit.value); setShowUnitPicker(false); }}
                          >
                            <Text style={[styles.unitPickerOptionText, { color: colors.text }]}>{unit.label}</Text>
                            {dosageUnit === unit.value && (
                              <Text style={{ color: colors.olive, fontSize: 17 }}>✓</Text>
                            )}
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  </View>
                )}
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* History Modal */}
        <Modal
          visible={showHistoryModal}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowHistoryModal(false)}
        >
          <View style={[styles.historyModalContainer, { backgroundColor: colors.background }]}>
            <View style={[styles.historyModalHeader, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
              <Text style={[styles.historyModalTitle, { color: colors.text }]}>Scan History</Text>
              <TouchableOpacity
                onPress={() => setShowHistoryModal(false)}
                style={[styles.historyModalCloseBtn, { backgroundColor: colors.olive }]}
              >
                <Text style={styles.historyModalCloseText}>Done</Text>
              </TouchableOpacity>
            </View>
            {historyItems.length === 0 ? (
              <View style={styles.emptyState}>
                <View style={[styles.emptyIconContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Text style={styles.emptyIcon}>📋</Text>
                </View>
                <Text style={[styles.emptyTitle, { color: colors.text }]}>No History</Text>
                <Text style={[styles.emptyDescription, { color: colors.textSecondary }]}>
                  Scanned supplements will appear here
                </Text>
              </View>
            ) : (
              <FlatList
                data={historyItems}
                keyExtractor={(item) => String(item.id)}
                renderItem={renderHistoryItem}
                contentContainerStyle={styles.historyListContent}
                showsVerticalScrollIndicator={false}
              />
            )}
          </View>
        </Modal>
      </View>
    </GestureHandlerRootView>
  );
}

const CARD_WIDTH = SCREEN_WIDTH - 32;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingTop: 60,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  headerCount: {
    fontSize: 12,
    marginTop: 6,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  historyButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  historyButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },

  // List
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  row: {
    justifyContent: 'space-between',
    marginBottom: 12,
  },

  // Card - Grid layout
  card: {
    width: CARD_WIDTH,
    borderRadius: 20,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  imageContainer: {
    width: 64,
    height: 64,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  placeholderEmoji: {
    fontSize: 40,
  },
  cardMeta: {
    flex: 1,
  },
  productName: {
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 20,
    marginBottom: 4,
  },
  brandName: {
    fontSize: 11,
    marginBottom: 6,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  ratingPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
  },
  ratingPillText: {
    fontSize: 10,
    fontWeight: '600',
  },
  ratingBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ratingBadgeText: {
    fontSize: 16,
    fontWeight: '700',
  },

  // Expanded Content
  expandedContent: {
    padding: 12,
    borderTopWidth: 1,
  },
  scoresSection: {
    marginBottom: 12,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  scoreLabel: {
    fontSize: 11,
    width: 75,
  },
  scoreBarBg: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    marginHorizontal: 8,
  },
  scoreBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  scoreValue: {
    fontSize: 11,
    fontWeight: '600',
    width: 24,
    textAlign: 'right',
  },
  analysisText: {
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 12,
  },
  actionButtons: {
    flexDirection: 'column',
    gap: 8,
  },
  actionButton: {
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },

  // Empty State
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyIcon: {
    fontSize: 44,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '600',
    marginBottom: 10,
  },
  emptyDescription: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  scanButton: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 28,
  },
  scanButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },

  // Schedule Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 34,
    maxHeight: '88%',
  },
  modalHandle: {
    width: 40,
    height: 5,
    borderRadius: 2.5,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
  },
  modalSubtitle: {
    fontSize: 15,
    marginTop: 4,
    marginBottom: 24,
  },
  modalSectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  timeScroll: {
    marginBottom: 24,
  },
  timeOption: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginRight: 8,
  },
  timeOptionText: {
    fontSize: 15,
    fontWeight: '500',
  },
  dosageContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  dosageInput: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  unitSelector: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  unitSelectorText: {
    fontSize: 16,
  },
  unitSelectorArrow: {
    fontSize: 20,
    fontWeight: '300',
  },
  frequencyContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  frequencyOption: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  frequencyOptionText: {
    fontSize: 15,
    fontWeight: '500',
  },
  daysContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  dayOption: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayOptionText: {
    fontSize: 14,
    fontWeight: '500',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalConfirmButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  modalConfirmText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // Unit Picker
  unitPickerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
  },
  unitPickerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  unitPickerContainer: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '50%',
  },
  unitPickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  unitPickerTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  unitPickerDone: {
    fontSize: 17,
    fontWeight: '500',
  },
  unitPickerOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
  },
  unitPickerOptionText: {
    fontSize: 16,
  },

  // History Modal
  historyModalContainer: {
    flex: 1,
    paddingTop: 54,
  },
  historyModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  historyModalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  historyModalCloseBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
  },
  historyModalCloseText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  historyListContent: {
    padding: 16,
  },
  historyCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  historyContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  historyImageBox: {
    width: 52,
    height: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  historyImage: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  historyPlaceholder: {
    fontSize: 24,
  },
  historyInfo: {
    flex: 1,
    marginLeft: 12,
  },
  historyName: {
    fontSize: 15,
    fontWeight: '600',
  },
  historyBrand: {
    fontSize: 13,
    marginTop: 2,
  },
  historyRating: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  historyRatingText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  historyAnalysis: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 10,
  },
  swipeAction: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 70,
    marginBottom: 10,
    borderRadius: 16,
  },
  swipeActionText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '500',
  },
});
