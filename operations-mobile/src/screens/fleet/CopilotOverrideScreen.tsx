// @ts-nocheck
import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { colors, spacing } from '../../theme/tokens';
import { fleetApi } from '../../api/fleet';

export default function CopilotOverrideScreen({ route, navigation }: any) {
  const { assignmentId } = route.params;
  const [copilotId, setCopilotId] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  const handleOverride = async () => {
    if (reason.length < 5) {
      Alert.alert('Error', 'Reason must be at least 5 characters long.');
      return;
    }
    setLoading(true);
    try {
      const res = await fleetApi.overrideAssignment(assignmentId, reason, { copilotId: copilotId });
      if (res.success) {
        Alert.alert('Success', 'Copilot overridden successfully.');
        navigation.goBack();
      }
    } catch (err: any) {
      Alert.alert('Error', err.data?.error?.message || 'Failed to override copilot.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Override Copilot</Text>
      <Text style={styles.sub}>Assignment: {assignmentId}</Text>

      <Text style={styles.label}>New Copilot ID</Text>
      <TextInput 
        style={styles.input} 
        value={copilotId} 
        onChangeText={setCopilotId} 
        placeholder="Enter Copilot ID" 
      />

      <Text style={styles.label}>Reason for Override</Text>
      <TextInput 
        style={[styles.input, { height: 100, textAlignVertical: 'top' }]} 
        value={reason} 
        onChangeText={setReason} 
        placeholder="Provide a reasoned explanation" 
        multiline
      />

      {loading ? (
        <ActivityIndicator color={colors.safetyOrange} size="large" />
      ) : (
        <Button title="Submit Override" color={colors.navy} onPress={handleOverride} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.lg, backgroundColor: colors.white },
  header: { fontSize: 24, fontWeight: 'bold', color: colors.navy, marginBottom: spacing.xs },
  sub: { fontSize: 14, color: colors.darkGrey, marginBottom: spacing.xl },
  label: { fontSize: 16, color: colors.navy, marginBottom: spacing.xs },
  input: { 
    borderWidth: 1, borderColor: colors.lightGrey, borderRadius: 8, 
    padding: spacing.md, marginBottom: spacing.lg, fontSize: 16 
  }
});
