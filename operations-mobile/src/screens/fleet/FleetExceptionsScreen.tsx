import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { colors, spacing } from '../../theme/tokens';
import { fleetApi, ExceptionItem } from '../../api/fleet';

export default function FleetExceptionsScreen() {
  const [exceptions, setExceptions] = useState<ExceptionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadExceptions();
  }, []);

  const loadExceptions = async () => {
    try {
      const now = new Date();
      const start = new Date(now.setHours(0, 0, 0, 0)).toISOString();
      const end = new Date(now.setHours(23, 59, 59, 999)).toISOString();

      const res = await fleetApi.getExceptions(start, end);
      if (res.success && res.exceptions) {
        setExceptions(res.exceptions);
      }
    } catch (err: any) {
      Alert.alert('Error', err.data?.error?.message || err.message || 'Failed to load exceptions');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadExceptions();
  };

  const renderItem = ({ item }: { item: ExceptionItem }) => {
    if (item.type === 'UNSCHEDULED_LEAD' && item.lead) {
      return (
        <View style={[styles.card, { borderLeftColor: colors.error }]} testID="exception-lead">
          <Text style={styles.reason}>Unscheduled Lead</Text>
          <Text style={styles.codes}>{item.codes.join(', ')}</Text>
          <Text style={styles.detail}>Farmer: {item.lead.farmerDisplayName}</Text>
          <Text style={styles.detail}>Crop: {item.lead.crop} - {item.lead.expectedAcreage} acres</Text>
          <Text style={styles.time}>{new Date(item.lead.createdAt).toLocaleString()}</Text>
        </View>
      );
    }

    if (item.type === 'ASSIGNMENT' && item.assignment) {
      return (
        <View style={[styles.card, { borderLeftColor: colors.safetyOrange }]} testID="exception-assignment">
          <Text style={styles.reason}>Assignment Issue</Text>
          <Text style={styles.codes}>{item.codes.join(', ')}</Text>
          <Text style={styles.detail}>Farmer: {item.assignment.farmerDisplayName}</Text>
          <Text style={styles.detail}>Drone: {item.assignment.drone?.code || 'N/A'}</Text>
          <Text style={styles.time}>Status: {item.assignment.status}</Text>
        </View>
      );
    }

    return null;
  };

  return (
    <View style={styles.container}>
      {loading ? (
        <ActivityIndicator color={colors.safetyOrange} size="large" testID="loading-indicator" />
      ) : (
        <FlatList
          data={exceptions}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={<Text style={styles.empty}>No live exceptions.</Text>}
          testID="exceptions-list"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.lightGrey },
  list: { padding: spacing.md },
  card: { 
    backgroundColor: colors.white, 
    padding: spacing.md, 
    borderRadius: 8, 
    marginBottom: spacing.md,
    borderLeftWidth: 4,
    elevation: 2,
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4
  },
  reason: { fontSize: 18, fontWeight: 'bold', color: colors.navy, marginBottom: spacing.xs },
  codes: { fontSize: 14, fontWeight: 'bold', color: colors.error, marginBottom: spacing.sm },
  detail: { fontSize: 14, color: colors.navy, marginBottom: 2 },
  time: { fontSize: 12, color: colors.darkGrey, marginTop: spacing.sm },
  empty: { textAlign: 'center', marginTop: spacing.xl, color: colors.darkGrey }
});
