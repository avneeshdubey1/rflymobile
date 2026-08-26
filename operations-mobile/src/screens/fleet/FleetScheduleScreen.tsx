import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { colors, spacing } from '../../theme/tokens';
import { fleetApi, ScheduleItem } from '../../api/fleet';
import { useAuthStore } from '../../store/auth';

export default function FleetScheduleScreen({ navigation }: any) {
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  const { capabilities } = useAuthStore();
  const isAdmin = (capabilities || []).includes('admin:access');

  useEffect(() => {
    loadSchedule();
  }, []);

  const loadSchedule = async () => {
    try {
      const now = new Date();
      const start = new Date(now.setHours(0, 0, 0, 0)).toISOString();
      const end = new Date(now.setHours(23, 59, 59, 999)).toISOString();
      
      const res = await fleetApi.getSchedule(start, end);
      if (res.success && res.assignments) {
        setSchedule(res.assignments);
      }
    } catch (err: any) {
      Alert.alert('Error', err.data?.error?.message || err.message || 'Failed to load schedule');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadSchedule();
  };

  const renderItem = ({ item }: { item: ScheduleItem }) => (
    <View style={styles.card} testID="schedule-card">
      <Text style={styles.status}>{item.status} ({item.crewFormationState})</Text>
      
      <Text style={styles.detail}>Farmer: {item.farmerDisplayName}</Text>
      <Text style={styles.detail}>Crop: {item.crop || 'Unknown'} - {item.expectedAcreage} acres</Text>
      
      <Text style={styles.detail}>
        Pilot: {item.crew?.primaryPilot?.displayName || item.crew?.primaryPilot?.employeeCode || 'Unassigned'}
      </Text>
      <Text style={styles.detail}>
        Copilot: {item.crew?.copilot?.displayName || item.crew?.copilot?.employeeCode || 'Unassigned'}
      </Text>
      
      <Text style={styles.detail}>Drone: {item.drone?.code || 'N/A'}</Text>
      
      {item.serviceWindow?.start && item.serviceWindow?.end && (
        <Text style={styles.time}>
          Window: {new Date(item.serviceWindow.start).toLocaleTimeString()} - {new Date(item.serviceWindow.end).toLocaleTimeString()}
        </Text>
      )}
      
      <View style={styles.actions}>
        {isAdmin && (
          <TouchableOpacity 
            style={styles.overrideBtn} 
            onPress={() => navigation.navigate('CopilotOverride', { assignmentId: item.id, revision: item.revision })}
            testID="btn-override"
          >
            <Text style={styles.overrideText}>Override Copilot</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {loading ? (
        <ActivityIndicator color={colors.safetyOrange} size="large" testID="loading-indicator" />
      ) : (
        <FlatList
          data={schedule}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={<Text style={styles.empty}>No schedule items found for today.</Text>}
          testID="schedule-list"
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
    borderLeftColor: colors.navy,
    elevation: 2,
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4
  },
  status: { fontSize: 16, fontWeight: 'bold', color: colors.safetyOrange, marginBottom: spacing.xs },
  detail: { fontSize: 16, color: colors.navy, marginBottom: 4 },
  time: { fontSize: 14, color: colors.darkGrey, marginTop: spacing.sm },
  actions: { marginTop: spacing.md, alignItems: 'flex-end' },
  overrideBtn: { padding: spacing.sm, backgroundColor: colors.lightGrey, borderRadius: 4, borderWidth: 1, borderColor: colors.navy },
  overrideText: { color: colors.navy, fontWeight: 'bold' },
  empty: { textAlign: 'center', marginTop: spacing.xl, color: colors.darkGrey }
});
