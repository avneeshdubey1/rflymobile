// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert, TextInput, Button } from 'react-native';
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
      const res = await adminApi.getPolicies();
      if (res.success && res.policy) {
        setPolicy(res.policy);
      }
    } catch (err: any) {
      Alert.alert('Error', err.data?.error?.message || 'Failed to load policy');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      const res = await adminApi.updatePolicy(policy);
      if (res.success) {
        Alert.alert('Success', 'Auto-assignment policy updated.');
      }
    } catch (err: any) {
      if (err.data?.error?.code === 'CONFLICT') {
        Alert.alert('Conflict', 'The policy was modified by someone else. Please reload.');
      } else {
        Alert.alert('Error', err.data?.error?.message || 'Update failed');
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading && !policy) {
    return <ActivityIndicator style={{ marginTop: spacing.xl }} color={colors.safetyOrange} size="large" />;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Auto-Assignment Policy</Text>
      
      <View style={styles.card}>
        <Text style={styles.label}>Max Range (km)</Text>
        <TextInput 
          style={styles.input} 
          value={policy?.maxRangeKm?.toString() || ''}
          onChangeText={(val) => setPolicy({ ...policy, maxRangeKm: Number(val) })}
          keyboardType="numeric"
        />
        <Button title="Save Policy" color={colors.navy} onPress={handleSave} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.md, backgroundColor: colors.lightGrey },
  header: { fontSize: 20, fontWeight: 'bold', color: colors.navy, marginBottom: spacing.md },
  card: { backgroundColor: colors.white, padding: spacing.md, borderRadius: 8 },
  label: { fontSize: 16, color: colors.navy, marginBottom: spacing.xs },
  input: { borderWidth: 1, borderColor: colors.lightGrey, borderRadius: 8, padding: spacing.md, marginBottom: spacing.lg }
});
