import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { colors, spacing } from '../../theme/tokens';
import { adminApi } from '../../api/admin';

export default function PolicyManagementScreen() {
  const [policy, setPolicy] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPolicy();
  }, []);

  const loadPolicy = async () => {
    setLoading(true);
    try {
      const res: any = await adminApi.getPolicies();
      if (res.success && res.policy) {
        setPolicy(res.policy);
      }
    } catch (err: any) {
      Alert.alert('Error', err.data?.error?.message || 'Failed to load policy');
    } finally {
      setLoading(false);
    }
  };

  if (loading && !policy) {
    return <ActivityIndicator style={{ marginTop: spacing.xl }} color={colors.safetyOrange} size="large" testID="loading-indicator" />;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Auto-Assignment Policy</Text>
      
      <View style={styles.card} testID="policy-card">
        <Text style={styles.label}>Status: {policy?.enabled ? 'Enabled' : 'Disabled'}</Text>
        <Text style={styles.detail}>Search Horizon: {policy?.searchHorizonDays} days</Text>
        <Text style={styles.detail}>Working Hours: {policy?.workingDayStartMinutes} - {policy?.workingDayEndMinutes} minutes</Text>
        <Text style={styles.detail}>Max Jobs / Unit / Day: {policy?.maxJobsPerUnitPerDay}</Text>
        <Text style={styles.detail}>Revision: {policy?.revision}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.md, backgroundColor: colors.lightGrey },
  header: { fontSize: 20, fontWeight: 'bold', color: colors.navy, marginBottom: spacing.md },
  card: { backgroundColor: colors.white, padding: spacing.md, borderRadius: 8, borderLeftWidth: 4, borderLeftColor: colors.navy },
  label: { fontSize: 16, fontWeight: 'bold', color: colors.navy, marginBottom: spacing.xs },
  detail: { fontSize: 14, color: colors.darkGrey, marginBottom: spacing.xs }
});
