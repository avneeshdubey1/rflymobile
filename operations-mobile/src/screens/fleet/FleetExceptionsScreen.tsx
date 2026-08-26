// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { colors, spacing } from '../../theme/tokens';
import { fleetApi, ExceptionItem } from '../../api/fleet';

export default function FleetExceptionsScreen() {
  const [exceptions, setExceptions] = useState<ExceptionItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadExceptions();
  }, []);

  const loadExceptions = async () => {
    try {
      const res = await fleetApi.getExceptions();
      if (res.success && res.exceptions) {
        setExceptions(res.exceptions);
      }
    } catch (err: any) {
      console.warn(err);
    } finally {
      setLoading(false);
    }
  };

  const renderItem = ({ item }: { item: ExceptionItem }) => (
    <View style={[styles.card, { borderLeftColor: item.severity === 'HIGH' ? colors.error : colors.safetyOrange }]}>
      <Text style={styles.reason}>{item.reason}</Text>
      <Text style={styles.assignment}>Assignment: {item.assignmentId}</Text>
      <Text style={styles.time}>{new Date(item.createdAt).toLocaleString()}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {loading ? (
        <ActivityIndicator color={colors.safetyOrange} size="large" />
      ) : (
        <FlatList
          data={exceptions}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.empty}>No live exceptions.</Text>}
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
  },
  reason: { fontSize: 18, fontWeight: 'bold', color: colors.navy, marginBottom: spacing.xs },
  assignment: { fontSize: 14, color: colors.darkGrey, marginBottom: spacing.sm },
  time: { fontSize: 12, color: colors.darkGrey },
  empty: { textAlign: 'center', marginTop: spacing.xl, color: colors.darkGrey }
});
