import React, { useState, useCallback } from 'react';
import { FlatList, StyleSheet, Text, View, Image, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getAllHistory, deleteFromHistory, addToStack, isInStack, type Supplement } from '../../lib/storage';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';

export default function HistoryScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const styles = createStyles(theme);

  const [history, setHistory] = useState<Supplement[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [inStack, setInStack] = useState<Set<string>>(new Set());

  const loadHistory = async () => {
    const data = await getAllHistory();
    setHistory(data);

    // Check which items are already in stack
    const stackChecks = await Promise.all(
      data.map(async (item) => {
        const inStackStatus = await isInStack(item.barcode);
        return { barcode: item.barcode, inStack: inStackStatus };
      })
    );

    const stackSet = new Set(
      stackChecks.filter(item => item.inStack).map(item => item.barcode)
    );
    setInStack(stackSet);
  };

  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadHistory();
    setRefreshing(false);
  };

  const handleAddToStack = async (item: Supplement) => {
    try {
      await addToStack({
        barcode: item.barcode,
        name: item.name,
        brand: item.brand,
        image: item.image,
        analysis: item.analysis,
        rating: item.rating,
        scores: item.scores,
      });

      setInStack(prev => new Set([...prev, item.barcode]));
      Alert.alert('Success', `${item.name} added to your stack!`);
    } catch (error: any) {
      Alert.alert('Error', `Failed to add to stack: ${error.message}`);
    }
  };

  const handleDelete = async (id: number) => {
    Alert.alert(
      'Delete from History',
      'Are you sure you want to remove this from your scan history?',
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

  const renderItem = ({ item }: { item: Supplement }) => {
    const isItemInStack = inStack.has(item.barcode);

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          {item.image && (
            <Image source={{ uri: item.image }} style={styles.thumbnail} />
          )}
          <View style={styles.cardContent}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.brand}>{item.brand}</Text>
            {item.rating !== null && item.rating !== undefined && (
              <Text style={styles.rating}>⭐ {item.rating}/100</Text>
            )}
          </View>
        </View>

        {item.analysis && (
          <Text style={styles.analysis} numberOfLines={3}>
            {item.analysis}
          </Text>
        )}

        <View style={styles.actions}>
          {isItemInStack ? (
            <View style={styles.inStackBadge}>
              <Text style={styles.inStackText}>✓ In Stack</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => handleAddToStack(item)}
            >
              <Text style={styles.addButtonText}>+ Add to Stack</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => handleDelete(item.id)}
          >
            <Text style={styles.deleteButtonText}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Scan History</Text>
        <Text style={styles.subtitle}>{history.length} scan{history.length !== 1 ? 's' : ''}</Text>
      </View>
      {history.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No scan history yet</Text>
          <Text style={styles.emptySubtext}>Scan a supplement to get started!</Text>
        </View>
      ) : (
        <FlatList
          data={history}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          style={styles.flatList}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        />
      )}
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
    paddingBottom: 16,
    paddingHorizontal: 16,
    backgroundColor: theme.cardBackground,
    borderBottomWidth: 1,
    borderBottomColor: theme.borderLight,
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
  flatList: {
    flex: 1,
  },
  list: {
    padding: 16,
    paddingBottom: 32,
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
  },
  cardHeader: {
    flexDirection: 'row',
    gap: 12,
  },
  thumbnail: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: theme.inputBackground,
  },
  cardContent: {
    flex: 1,
    justifyContent: 'center',
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
    color: theme.text,
  },
  brand: {
    fontSize: 14,
    color: theme.textMuted,
    marginBottom: 4,
  },
  rating: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.warning,
  },
  analysis: {
    fontSize: 13,
    color: theme.textSecondary,
    marginTop: 12,
    lineHeight: 18,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  addButton: {
    flex: 1,
    backgroundColor: theme.buttonPrimary,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  addButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  inStackBadge: {
    flex: 1,
    backgroundColor: theme.successLight,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.success,
  },
  inStackText: {
    color: theme.success,
    fontSize: 14,
    fontWeight: '600',
  },
  deleteButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: theme.cardBackground,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: 'center',
  },
  deleteButtonText: {
    color: theme.buttonDanger,
    fontSize: 14,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.textMuted,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: theme.textLight,
    textAlign: 'center',
  },
});
