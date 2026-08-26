import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Button, StyleSheet, ActivityIndicator, Alert, FlatList, TouchableOpacity } from 'react-native';
import { colors, spacing } from '../../theme/tokens';
import { fleetApi } from '../../api/fleet';
import { adminApi } from '../../api/admin';

export default function CopilotOverrideScreen({ route, navigation }: any) {
  const { assignmentId, revision } = route.params;
  const [candidates, setCandidates] = useState<any[]>([]);
  const [selectedCopilotId, setSelectedCopilotId] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadCandidates();
  }, []);

  const loadCandidates = async () => {
    try {
      // OMR-05: Retrieve eligible candidates (in Operations app, we filter all users for PILOT)
      const res: any = await adminApi.getUsers();
      if (res.success && res.users) {
        const pilots = res.users.filter((u: any) => u.role === 'PILOT');
        setCandidates(pilots);
      }
    } catch (err: any) {
      Alert.alert('Error', 'Failed to load eligible copilots.');
    } finally {
      setLoading(false);
    }
  };

  const handleOverride = async () => {
    if (!selectedCopilotId) {
      Alert.alert('Error', 'Please select a candidate copilot.');
      return;
    }
    if (reason.length < 5) {
      Alert.alert('Error', 'Reason must be at least 5 characters long.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fleetApi.overrideAssignment(assignmentId, selectedCopilotId, revision, reason);
      if (res.success) {
        Alert.alert('Success', 'Copilot overridden successfully.');
        navigation.goBack();
      }
    } catch (err: any) {
      const code = err.data?.error?.code || err.code;
      if (code === 'ASSIGNMENT_REVISION_REQUIRED' || code === 'CONFLICT') {
        Alert.alert('Conflict', 'The assignment was modified by another user. Please refresh your schedule.');
        navigation.goBack();
      } else {
        Alert.alert('Error', err.data?.error?.message || 'Failed to override copilot.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const renderCandidate = ({ item }: { item: any }) => (
    <TouchableOpacity 
      style={[
        styles.candidateCard, 
        selectedCopilotId === item.id ? styles.selectedCard : null
      ]}
      onPress={() => setSelectedCopilotId(item.id)}
      testID={`candidate-${item.id}`}
    >
      <Text style={styles.candidateName}>{item.name}</Text>
      <Text style={styles.candidateCode}>{item.employeeCode || item.email}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Override Copilot</Text>
      <Text style={styles.sub}>Assignment: {assignmentId}</Text>
      <Text style={styles.sub}>Revision: {revision}</Text>

      <Text style={styles.label}>Select Eligible Copilot</Text>
      {loading ? (
        <ActivityIndicator color={colors.safetyOrange} />
      ) : (
        <View style={styles.listContainer}>
          <FlatList 
            data={candidates}
            keyExtractor={item => item.id}
            renderItem={renderCandidate}
            ListEmptyComponent={<Text style={{ color: colors.darkGrey }}>No pilots available.</Text>}
            testID="candidate-list"
          />
        </View>
      )}

      <Text style={styles.label}>Reason for Override</Text>
      <TextInput 
        style={[styles.input, { height: 100, textAlignVertical: 'top' }]} 
        value={reason} 
        onChangeText={setReason} 
        placeholder="Provide a reasoned explanation" 
        multiline
        testID="input-reason"
      />

      {submitting ? (
        <ActivityIndicator color={colors.safetyOrange} size="large" testID="submitting-indicator" />
      ) : (
        <Button title="Submit Override" color={colors.navy} onPress={handleOverride} testID="btn-submit" />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.lg, backgroundColor: colors.lightGrey },
  header: { fontSize: 24, fontWeight: 'bold', color: colors.navy, marginBottom: spacing.xs },
  sub: { fontSize: 14, color: colors.darkGrey, marginBottom: spacing.xs },
  label: { fontSize: 16, color: colors.navy, marginTop: spacing.md, marginBottom: spacing.xs },
  input: { 
    borderWidth: 1, borderColor: colors.darkGrey, borderRadius: 8, 
    padding: spacing.md, marginBottom: spacing.lg, fontSize: 16, backgroundColor: colors.white
  },
  listContainer: {
    height: 150,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.darkGrey,
    borderRadius: 8,
    marginBottom: spacing.md,
  },
  candidateCard: {
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.lightGrey,
  },
  selectedCard: {
    backgroundColor: '#d0ebff',
  },
  candidateName: { fontSize: 16, color: colors.navy, fontWeight: 'bold' },
  candidateCode: { fontSize: 14, color: colors.darkGrey }
});
