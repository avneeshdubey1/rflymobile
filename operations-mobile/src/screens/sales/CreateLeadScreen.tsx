import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { colors, spacing } from '../../theme/tokens';
import { salesApi, CreateLeadDto } from '../../api/sales';

export default function CreateLeadScreen({ route, navigation }: any) {
  const { customerId } = route.params;
  const [cropType, setCropType] = useState('');
  const [acreage, setAcreage] = useState('');
  const [sprayPurpose, setSprayPurpose] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSimulatePin = () => {
    // Stub coordinates resolving to numeric coordinates
    setLatitude('17.3850');
    setLongitude('78.4867');
  };

  const handleSubmit = async () => {
    if (!cropType || !acreage || !latitude || !longitude) {
      Alert.alert('Error', 'Please fill in required fields including Map Pin.');
      return;
    }
    setLoading(true);
    try {
      const payload: CreateLeadDto = {
        cropType,
        acreage: Number(acreage),
        sprayPurpose: sprayPurpose || undefined,
        latitude: Number(latitude),
        longitude: Number(longitude),
      };

      const res = await salesApi.createLead(customerId, payload);
      if (res.success) {
        if (res.outcome === 'ACCEPTED') {
          Alert.alert('Success', 'Lead accepted and scheduled successfully.');
        } else if (res.outcome === 'NEEDS_MANUAL_SCHEDULING') {
          Alert.alert('Notice', 'Lead recorded. Requires manual scheduling by Fleet team.');
        } else {
          Alert.alert('Success', 'Lead created successfully.');
        }
        navigation.goBack();
      } else {
        Alert.alert('Error', (res as any).error?.message || 'Failed to create lead.');
      }
    } catch (err: any) {
      const code = err.data?.error?.code || err.code;
      if (code === 'OUTSIDE_SERVICE_AREA') {
        Alert.alert('Declined', 'Service is unavailable at this location (Contact-only).');
      } else {
        Alert.alert('Error', err.data?.error?.message || err.message || 'Failed to create lead.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.header}>New Lead</Text>

      <Text style={styles.label}>Crop Type *</Text>
      <TextInput style={styles.input} value={cropType} onChangeText={setCropType} placeholder="e.g. Cotton" testID="input-crop" />

      <Text style={styles.label}>Area (Acres) *</Text>
      <TextInput style={styles.input} value={acreage} onChangeText={setAcreage} keyboardType="numeric" placeholder="0.0" testID="input-area" />

      <Text style={styles.label}>Spray Purpose</Text>
      <TextInput style={styles.input} value={sprayPurpose} onChangeText={setSprayPurpose} placeholder="e.g. Pesticide" testID="input-purpose" />

      <View style={styles.locationBox}>
        <Text style={styles.label}>Location Pin *</Text>
        {latitude && longitude ? (
          <Text style={{ marginBottom: spacing.sm, color: colors.navy }}>{latitude}, {longitude}</Text>
        ) : (
          <Text style={{ marginBottom: spacing.sm, color: colors.darkGrey }}>No location selected</Text>
        )}
        <Button title="Drop Pin on Map (Stub)" onPress={handleSimulatePin} color={colors.darkGrey} testID="btn-pin" />
      </View>

      {loading ? (
        <ActivityIndicator color={colors.safetyOrange} size="large" testID="loading-indicator" />
      ) : (
        <Button title="Submit Lead" color={colors.navy} onPress={handleSubmit} testID="btn-submit" />
      )}
      
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.lg, backgroundColor: colors.white },
  header: { fontSize: 24, fontWeight: 'bold', color: colors.navy, marginBottom: spacing.lg },
  label: { fontSize: 16, color: colors.navy, marginBottom: spacing.xs },
  input: { 
    borderWidth: 1, borderColor: colors.lightGrey, borderRadius: 8, 
    padding: spacing.md, marginBottom: spacing.lg, fontSize: 16 
  },
  locationBox: {
    padding: spacing.md, backgroundColor: colors.lightGrey, borderRadius: 8, marginBottom: spacing.xl
  }
});
