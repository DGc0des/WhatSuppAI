import React, { useState, useCallback } from 'react';
import { FlatList, StyleSheet, Text, View, Image, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getAllHistory, deleteFromHistory, addToStack, isInStack, type Supplement } from '../../lib/storage';

export default function HistoryScreen() {
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 16,
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 14,
    color: '#6c757d',
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
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
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
    backgroundColor: '#f0f0f0',
  },
  cardContent: {
    flex: 1,
    justifyContent: 'center',
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  brand: {
    fontSize: 14,
    color: '#6c757d',
    marginBottom: 4,
  },
  rating: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffa500',
  },
  analysis: {
    fontSize: 13,
    color: '#495057',
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
    backgroundColor: '#007AFF',
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
    backgroundColor: '#e7f5e7',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#28a745',
  },
  inStackText: {
    color: '#28a745',
    fontSize: 14,
    fontWeight: '600',
  },
  deleteButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#dee2e6',
    alignItems: 'center',
  },
  deleteButtonText: {
    color: '#dc3545',
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
    color: '#6c757d',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#adb5bd',
    textAlign: 'center',
  },
});
