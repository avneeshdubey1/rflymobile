import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, ScrollView, ActivityIndicator, Alert, TouchableOpacity } from 'react-native';
import { colors, spacing } from '../../theme/tokens';
import { salesApi, CreateLeadDto } from '../../api/sales';

import * as Location from 'expo-location';
import { masterDataApi, MasterChoice } from '../../api/masterData';

export default function CreateLeadScreen({ route, navigation }: any) {
  const { customerId } = route.params;
  const [cropType, setCropType] = useState('');
  const [acreage, setAcreage] = useState('');
  const [sprayPurpose, setSprayPurpose] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [farmerAddress, setFarmerAddress] = useState('');
  const [crops, setCrops] = useState<MasterChoice[]>([]);
  const [sprayPurposes, setSprayPurposes] = useState<MasterChoice[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    masterDataApi.getChoices()
      .then(({ data }) => {
        setCrops(data.crops);
        setSprayPurposes(data.sprayPurposes);
      })
      .catch((error) => Alert.alert('Master data unavailable', error.message || 'Refresh and try again.'));
  }, []);

  const handleCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Permission to access location was denied');
        return;
      }

      setLoading(true);
      const location = await Location.getCurrentPositionAsync({});
      setLatitude(location.coords.latitude.toFixed(6));
      setLongitude(location.coords.longitude.toFixed(6));
    } catch (error) {
      Alert.alert('Error', 'Failed to fetch location. Make sure location services are enabled.');
    } finally {
      setLoading(false);
    }
  };

  const handleResolveAddress = async () => {
    if (!farmerAddress.trim()) {
      Alert.alert('Location required', 'Enter a farm address or full Plus Code first.');
      return;
    }
    setLoading(true);
    try {
      const matches = await Location.geocodeAsync(farmerAddress.trim());
      if (matches.length === 0) {
        Alert.alert('Location not found', 'Check the address or full Plus Code and try again.');
        return;
      }
      setLatitude(matches[0].latitude.toFixed(6));
      setLongitude(matches[0].longitude.toFixed(6));
    } catch (_error) {
      Alert.alert('Location not found', 'This device could not resolve that address or Plus Code.');
    } finally {
      setLoading(false);
    }
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
        farmerAddress: farmerAddress.trim() || undefined,
      };

      const res = await salesApi.createLead(customerId, payload);
      if (res.success) {
        if (res.assignmentOutcome === 'MANUAL_SCHEDULING') {
          Alert.alert('Notice', 'Lead recorded. Requires manual scheduling by Fleet team.');
        } else if (res.assignmentOutcome === 'SCHEDULED') {
          Alert.alert('Success', 'Lead accepted and assigned successfully.');
        } else {
          Alert.alert('Success', 'Lead accepted. Assignment status will be visible to Operations.');
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
      <View style={styles.choiceGroup} testID="crop-choices">
        {crops.map((crop) => (
          <TouchableOpacity key={crop.id} style={[styles.choice, cropType === crop.displayName && styles.choiceSelected]} onPress={() => setCropType(crop.displayName)}>
            <Text style={cropType === crop.displayName ? styles.choiceTextSelected : styles.choiceText}>{crop.displayName}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Area (Acres) *</Text>
      <TextInput style={styles.input} value={acreage} onChangeText={setAcreage} keyboardType="numeric" placeholder="0.0" testID="input-area" />

      <Text style={styles.label}>Spray Purpose</Text>
      <View style={styles.choiceGroup} testID="purpose-choices">
        {sprayPurposes.map((purpose) => (
          <TouchableOpacity key={purpose.id} style={[styles.choice, sprayPurpose === purpose.displayName && styles.choiceSelected]} onPress={() => setSprayPurpose(purpose.displayName)}>
            <Text style={sprayPurpose === purpose.displayName ? styles.choiceTextSelected : styles.choiceText}>{purpose.displayName}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.locationBox}>
        <Text style={styles.label}>Farm address or full Plus Code *</Text>
        <TextInput style={styles.input} value={farmerAddress} onChangeText={setFarmerAddress} placeholder="Village/address or 7J4V+XX City" testID="input-address" />
        <Button title="Resolve Address / Plus Code" onPress={handleResolveAddress} color={colors.navy} testID="btn-resolve-location" />
        <View style={{ height: spacing.sm }} />
        <Text style={styles.label}>Resolved coordinates *</Text>
        {latitude && longitude ? (
          <Text style={{ marginBottom: spacing.sm, color: colors.navy }}>{latitude}, {longitude}</Text>
        ) : (
          <Text style={{ marginBottom: spacing.sm, color: colors.darkGrey }}>No location selected</Text>
        )}
        <Button title="Use Current Device Location" onPress={handleCurrentLocation} color={colors.darkGrey} testID="btn-current-location" />
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
  },
  choiceGroup: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.lg, gap: spacing.sm },
  choice: { borderWidth: 1, borderColor: colors.navy, borderRadius: 16, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  choiceSelected: { backgroundColor: colors.navy },
  choiceText: { color: colors.navy },
  choiceTextSelected: { color: colors.white, fontWeight: 'bold' },
});
