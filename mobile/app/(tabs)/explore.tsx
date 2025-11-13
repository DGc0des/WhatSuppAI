import React, { useState, useCallback } from 'react';
import { FlatList, StyleSheet, Text, View, Image, TouchableOpacity, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getAllScannedSupplements, deleteScannedSupplement, type ScannedSupplement } from '../../lib/storage';

export default function HistoryScreen() {
  const [supplements, setSupplements] = useState<ScannedSupplement[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

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

  const handleDelete = async (id: number) => {
    await deleteScannedSupplement(id);
    await loadSupplements();
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

  const getColorForScore = (score: number) => {
    if (score >= 80) return '#28a745';
    if (score >= 60) return '#ffc107';
    if (score >= 40) return '#fd7e14';
    return '#dc3545';
  };

  const renderItem = ({ item }: { item: ScannedSupplement }) => {
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

            <TouchableOpacity
              style={styles.deleteButton}
              onPress={(e) => {
                e.stopPropagation();
                handleDelete(item.id);
              }}
            >
              <Text style={styles.deleteText}>Delete</Text>
            </TouchableOpacity>
          </>
        )}
      </TouchableOpacity>
    );
  };

  const getRatingColor = (rating: number) => {
    if (rating >= 80) return { backgroundColor: '#28a745' }; // Green
    if (rating >= 60) return { backgroundColor: '#ffc107' }; // Yellow
    if (rating >= 40) return { backgroundColor: '#fd7e14' }; // Orange
    return { backgroundColor: '#dc3545' }; // Red
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Scan History</Text>
      </View>
      {supplements.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No supplements scanned yet</Text>
          <Text style={styles.emptySubtext}>Scan a barcode to get started!</Text>
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
  list: {
    padding: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#dee2e6',
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
    backgroundColor: '#f8f9fa',
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
    borderTopColor: '#e9ecef',
  },
  scoresTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  scoreLabel: {
    fontSize: 12,
    color: '#6c757d',
    width: 100,
    fontWeight: '500',
  },
  scoreBarContainer: {
    flex: 1,
    height: 8,
    backgroundColor: '#e9ecef',
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
    color: '#333',
    width: 30,
    textAlign: 'right',
  },
  analysisContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  analysisTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
    color: '#333',
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
    paddingRight: 50,
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
    color: '#6c757d',
    marginBottom: 2,
  },
  date: {
    fontSize: 11,
    color: '#adb5bd',
  },
  analysis: {
    fontSize: 13,
    color: '#495057',
    lineHeight: 18,
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
