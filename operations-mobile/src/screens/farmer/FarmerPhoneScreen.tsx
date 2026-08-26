// @ts-nocheck
import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { colors, spacing } from '../../theme/tokens';
import { farmerApi } from '../../api/farmer';
import { t } from '../../i18n/farmer';

export default function FarmerPhoneScreen({ navigation }: any) {
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRequestOtp = async () => {
    if (phone.trim().length < 10) {
      Alert.alert('Error', 'Invalid phone number');
      return;
    }
    setLoading(true);
    try {
      const res = await farmerApi.requestOtp(phone);
      if (res.success) {
        navigation.navigate('FarmerOTP', { phone });
      }
    } catch (err: any) {
      Alert.alert('Error', err.data?.error?.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>{t('welcome')}</Text>
      <Text style={styles.prompt}>{t('phonePrompt')}</Text>

      <TextInput 
        style={styles.input} 
        value={phone} 
        onChangeText={setPhone} 
        placeholder="+91..." 
        keyboardType="phone-pad" 
      />

      {loading ? (
        <ActivityIndicator color={colors.safetyOrange} size="large" />
      ) : (
        <Button title={t('requestOtp')} color={colors.safetyOrange} onPress={handleRequestOtp} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.xl, backgroundColor: colors.white, justifyContent: 'center' },
  header: { fontSize: 28, fontWeight: 'bold', color: colors.navy, marginBottom: spacing.md, textAlign: 'center' },
  prompt: { fontSize: 16, color: colors.darkGrey, marginBottom: spacing.xl, textAlign: 'center' },
  input: { borderWidth: 1, borderColor: colors.lightGrey, borderRadius: 8, padding: spacing.md, marginBottom: spacing.lg, fontSize: 18, textAlign: 'center' }
});
