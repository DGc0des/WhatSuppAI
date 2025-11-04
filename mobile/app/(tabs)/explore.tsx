import React, { useState, useCallback } from 'react';
import { FlatList, StyleSheet, Text, View, Image, TouchableOpacity, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getAllScannedSupplements, deleteScannedSupplement, type ScannedSupplement } from '../../lib/storage';

export default function HistoryScreen() {
  const [supplements, setSupplements] = useState<ScannedSupplement[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadSupplements = async () => {
    const data = await getAllScannedSupplements();
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

  const handleDelete = async (id: string) => {
    await deleteScannedSupplement(id);
    await loadSupplements();
  };

  const renderItem = ({ item }: { item: ScannedSupplement }) => (
    <View style={styles.card}>
      <View style={styles.cardContent}>
        {item.image && (
          <Image
            source={{ uri: item.image }}
            style={styles.thumbnail}
            resizeMode="contain"
          />
        )}
        <View style={styles.info}>
          <Text style={styles.name}>{item.name}</Text>
          <Text style={styles.brand}>{item.brand}</Text>
          <Text style={styles.date}>
            {new Date(item.timestamp).toLocaleDateString()} {new Date(item.timestamp).toLocaleTimeString()}
          </Text>
          {item.analysis && (
            <Text style={styles.analysis} numberOfLines={2}>
              {item.analysis}
            </Text>
          )}
        </View>
      </View>
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => handleDelete(item.id)}
      >
        <Text style={styles.deleteText}>Delete</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Scan History</Text>
        <Text style={styles.subtitle}>{supplements.length} supplements scanned</Text>
      </View>
      {supplements.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No supplements scanned yet</Text>
          <Text style={styles.emptySubtext}>Scan a barcode to get started!</Text>
        </View>
      ) : (
        <FlatList
          data={supplements}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
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
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#6c757d',
  },
  list: {
    padding: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#dee2e6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  cardContent: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  thumbnail: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#f8f9fa',
  },
  info: {
    flex: 1,
    marginLeft: 12,
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
  date: {
    fontSize: 12,
    color: '#adb5bd',
    marginBottom: 6,
  },
  analysis: {
    fontSize: 12,
    color: '#495057',
    lineHeight: 16,
  },
  deleteButton: {
    backgroundColor: '#dc3545',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  deleteText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
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
    color: '#495057',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#6c757d',
    textAlign: 'center',
  },
});
