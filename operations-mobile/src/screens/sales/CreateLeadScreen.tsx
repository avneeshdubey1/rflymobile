import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { colors, spacing } from '../../theme/tokens';
import { salesApi } from '../../api/sales';

export default function CreateLeadScreen({ route, navigation }: any) {
  const { customerId } = route.params;
  const [crop, setCrop] = useState('');
  const [area, setArea] = useState('');
  const [purpose, setPurpose] = useState('');
  const [location, setLocation] = useState({ lat: 0, lng: 0, address: '' }); // Stub
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!crop || !area) {
      Alert.alert('Error', 'Please fill in required fields.');
      return;
    }
    setLoading(true);
    try {
      const res = await salesApi.createLead(customerId, {
        crop,
        area: Number(area),
        purpose,
        location,
      });
      if (res.success) {
        Alert.alert('Success', 'Lead created successfully.');
        navigation.goBack();
      }
    } catch (err: any) {
      Alert.alert('Error', err.data?.error?.message || 'Failed to create lead.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.header}>New Lead</Text>

      <Text style={styles.label}>Crop Type</Text>
      <TextInput style={styles.input} value={crop} onChangeText={setCrop} placeholder="e.g. Cotton" />

      <Text style={styles.label}>Area (Acres)</Text>
      <TextInput style={styles.input} value={area} onChangeText={setArea} keyboardType="numeric" placeholder="0.0" />

      <Text style={styles.label}>Spray Purpose</Text>
      <TextInput style={styles.input} value={purpose} onChangeText={setPurpose} placeholder="e.g. Pesticide" />

      <View style={styles.locationBox}>
        <Text style={styles.label}>Location Pin (Stub)</Text>
        <Button title="Drop Pin on Map" onPress={() => Alert.alert('Stub', 'Map selector opens here')} color={colors.darkGrey} />
      </View>

      {loading ? (
        <ActivityIndicator color={colors.safetyOrange} size="large" />
      ) : (
        <Button title="Submit Lead" color={colors.navy} onPress={handleSubmit} />
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
