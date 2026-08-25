import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { colors, spacing } from '../../theme/tokens';
import { fleetApi, ScheduleItem } from '../../api/fleet';

export default function FleetScheduleScreen({ navigation }: any) {
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSchedule();
  }, []);

  const loadSchedule = async () => {
    try {
      const res = await fleetApi.getSchedule();
      if (res.success && res.assignments) {
        setSchedule(res.assignments);
      }
    } catch (err) {
      console.warn(err);
    } finally {
      setLoading(false);
    }
  };

  const renderItem = ({ item }: { item: ScheduleItem }) => (
    <View style={styles.card}>
      <Text style={styles.status}>{item.missionStatus}</Text>
      <Text style={styles.detail}>Pilot: {item.pilotName}</Text>
      <Text style={styles.detail}>Drone: {item.droneLabel}</Text>
      <Text style={styles.time}>Start: {new Date(item.startTime).toLocaleTimeString()}</Text>
      
      <View style={styles.actions}>
        <TouchableOpacity 
          style={styles.overrideBtn} 
          onPress={() => navigation.navigate('CopilotOverride', { assignmentId: item.id })}
        >
          <Text style={styles.overrideText}>Override Copilot</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {loading ? (
        <ActivityIndicator color={colors.safetyOrange} size="large" />
      ) : (
        <FlatList
          data={schedule}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.empty}>No schedule items found.</Text>}
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
    borderLeftColor: colors.navy
  },
  status: { fontSize: 16, fontWeight: 'bold', color: colors.safetyOrange, marginBottom: spacing.xs },
  detail: { fontSize: 16, color: colors.navy, marginBottom: 2 },
  time: { fontSize: 14, color: colors.darkGrey, marginTop: spacing.sm },
  actions: { marginTop: spacing.md, alignItems: 'flex-end' },
  overrideBtn: { padding: spacing.sm, backgroundColor: colors.lightGrey, borderRadius: 4 },
  overrideText: { color: colors.navy, fontWeight: 'bold' },
  empty: { textAlign: 'center', marginTop: spacing.xl, color: colors.darkGrey }
});
