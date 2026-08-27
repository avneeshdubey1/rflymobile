import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { colors, spacing } from '../../theme/tokens';
import { salesApi } from '../../api/sales';

export default function CreateCustomerScreen({ navigation }: any) {
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [village, setVillage] = useState('');
  const [district, setDistrict] = useState('');
  const [totalAcres, setTotalAcres] = useState('');
  
  const [loading, setLoading] = useState(false);

  const normalizePhone = (p: string) => {
    let clean = p.replace(/\D/g, '');
    if (clean.length === 10) return `+91${clean}`;
    if (clean.length === 12 && clean.startsWith('91')) return `+${clean}`;
    return p; // let server reject if invalid
  };

  const handleCheckDuplicate = async (normPhone: string) => {
    try {
      const res = await salesApi.checkDuplicatePhone(normPhone);
      if (res.success && res.customer) {
        return res.customer;
      }
    } catch (err: any) {
      if (err.status !== 404 && err.data?.error?.code !== 'RESOURCE_NOT_FOUND') {
         console.warn('Duplicate check failed', err);
      }
    }
    return null;
  };

  const handleSubmit = async () => {
    if (!displayName.trim() || !phone.trim()) {
      Alert.alert('Error', 'Name and Phone are required.');
      return;
    }
    
    setLoading(true);
    const normPhone = normalizePhone(phone);
    
    // Check duplicate
    const existing = await handleCheckDuplicate(normPhone);
    if (existing) {
      setLoading(false);
      Alert.alert(
        'Duplicate Found', 
        `Customer ${existing.displayName} already registered with this phone.`,
        [{ text: 'View Customer', onPress: () => navigation.replace('CustomerDetail', { customer: existing }) }, { text: 'Cancel', style: 'cancel' }]
      );
      return;
    }

    try {
      const payload: any = { displayName, phone: normPhone };
      if (village.trim()) payload.village = village;
      if (district.trim()) payload.district = district;
      if (totalAcres.trim()) payload.totalAcres = parseFloat(totalAcres);

      const res = await salesApi.createCustomer(payload);
      if (res.success && res.customer) {
        Alert.alert('Success', 'Customer created successfully.');
        navigation.replace('CustomerDetail', { customer: res.customer });
      } else {
        Alert.alert('Error', (res as any).error?.message || 'Failed to create customer');
      }
    } catch (err: any) {
      const code = err.data?.error?.code || err.code;
      if (code === 'CUSTOMER_PHONE_CONFLICT' || code === 'CUSTOMER_EXISTS') {
        Alert.alert('Duplicate', 'A customer with this phone number already exists.');
      } else {
        Alert.alert('Error', err.data?.error?.message || 'Network error or server unavailable.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.header}>New Customer</Text>
      
      <Text style={styles.label}>Display Name *</Text>
      <TextInput style={styles.input} value={displayName} onChangeText={setDisplayName} placeholder="Farmer Name" testID="input-name" />
      
      <Text style={styles.label}>Phone Number *</Text>
      <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="10-digit mobile" keyboardType="phone-pad" testID="input-phone" />
      
      <Text style={styles.label}>Village</Text>
      <TextInput style={styles.input} value={village} onChangeText={setVillage} placeholder="Village" testID="input-village" />
      
      <Text style={styles.label}>District</Text>
      <TextInput style={styles.input} value={district} onChangeText={setDistrict} placeholder="District" testID="input-district" />
      
      <Text style={styles.label}>Total Acres</Text>
      <TextInput style={styles.input} value={totalAcres} onChangeText={setTotalAcres} placeholder="e.g. 5.5" keyboardType="numeric" testID="input-acres" />
      
      {loading ? (
        <ActivityIndicator color={colors.safetyOrange} size="large" testID="loading-indicator" />
      ) : (
        <Button title="Save Customer" color={colors.navy} onPress={handleSubmit} testID="btn-save" />
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
  }
});
