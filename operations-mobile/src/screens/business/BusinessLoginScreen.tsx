// @ts-nocheck
import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { colors, spacing } from '../../theme/tokens';
import { businessApi } from '../../api/business';
import { useAuthStore } from '../../store/auth';

export default function BusinessLoginScreen({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter email and password.');
      return;
    }
    setLoading(true);
    try {
      const res = await businessApi.login(email, password);
      if (res.success && res.token) {
        await useAuthStore.getState().setToken(res.token);
        await useAuthStore.getState().setProfile(res.profile, []);
        navigation.replace('BusinessDashboard');
      }
    } catch (err: any) {
      Alert.alert('Error', err.data?.error?.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Business Partner Login</Text>
      
      <Text style={styles.label}>Email Address</Text>
      <TextInput 
        style={styles.input} 
        value={email} 
        onChangeText={setEmail} 
        placeholder="Enter your organization email" 
        keyboardType="email-address"
        autoCapitalize="none"
      />

      <Text style={styles.label}>Password</Text>
      <TextInput 
        style={styles.input} 
        value={password} 
        onChangeText={setPassword} 
        placeholder="Enter your password" 
        secureTextEntry
      />

      {loading ? (
        <ActivityIndicator color={colors.safetyOrange} size="large" />
      ) : (
        <Button title="Sign In" color={colors.navy} onPress={handleLogin} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.xl, backgroundColor: colors.white, justifyContent: 'center' },
  header: { fontSize: 24, fontWeight: 'bold', color: colors.navy, marginBottom: spacing.xl, textAlign: 'center' },
  label: { fontSize: 16, color: colors.navy, marginBottom: spacing.xs },
  input: { borderWidth: 1, borderColor: colors.lightGrey, borderRadius: 8, padding: spacing.md, marginBottom: spacing.lg, fontSize: 16 }
});
