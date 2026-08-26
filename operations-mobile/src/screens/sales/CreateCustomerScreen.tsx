// @ts-nocheck
import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { colors, spacing } from '../../theme/tokens';
import { salesApi } from '../../api/sales';

export default function CreateCustomerScreen({ navigation }: any) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim() || !phone.trim()) {
      Alert.alert('Error', 'Name and Phone are required.');
      return;
    }
    setLoading(true);
    try {
      const res = await salesApi.createCustomer({ name, phone });
      if (res.success && res.customer) {
        Alert.alert('Success', 'Customer created successfully.');
        navigation.replace('CustomerDetail', { customer: res.customer });
      } else {
        // Handle potential duplicate errors from API
        Alert.alert('Error', res.error?.message || 'Failed to create customer');
      }
    } catch (err: any) {
      if (err.data?.error?.code === 'CUSTOMER_EXISTS') {
        Alert.alert('Duplicate', 'A customer with this phone number already exists.');
      } else {
        Alert.alert('Error', 'Network error or server unavailable.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>New Customer</Text>
      
      <Text style={styles.label}>Name</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Farmer Name" />
      
      <Text style={styles.label}>Phone Number</Text>
      <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="+91..." keyboardType="phone-pad" />
      
      {loading ? (
        <ActivityIndicator color={colors.safetyOrange} size="large" />
      ) : (
        <Button title="Save Customer" color={colors.navy} onPress={handleSubmit} />
      )}
    </View>
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
