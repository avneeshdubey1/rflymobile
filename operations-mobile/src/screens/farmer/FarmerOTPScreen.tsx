import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Button, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { colors, spacing } from '../../theme/tokens';
import { farmerApi } from '../../api/farmer';
import { useAuthStore } from '../../store/auth';
import { t } from '../../i18n/farmer';

export default function FarmerOTPScreen({ route, navigation }: any) {
  const { phone, challengeId: initialChallengeId } = route.params;
  const [challengeId] = useState(initialChallengeId);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(30);

  useEffect(() => {
    let timer: any;
    if (cooldown > 0) {
      timer = setInterval(() => setCooldown((c) => c - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleVerify = async () => {
    if (code.length < 4 || !challengeId) return;
    setLoading(true);
    try {
      const res = await farmerApi.verifyOtp(challengeId, code);
      if (res.success && res.session?.accessToken) {
        await useAuthStore.getState().establishSession(res.session.accessToken, res.profile, []);
      }
    } catch (err: any) {
      Alert.alert('Error', err.data?.error?.message || 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0) return;
    setLoading(true);
    try {
      await farmerApi.resendOtp(challengeId);
      setCooldown(30);
    } catch (err: any) {
      Alert.alert('Error', 'Failed to resend OTP');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>{t('verifyOtp')}</Text>
      <Text style={styles.prompt}>{t('enterCode')}</Text>

      <TextInput 
        style={styles.input} 
        value={code} 
        onChangeText={setCode} 
        placeholder="------" 
        keyboardType="number-pad"
        maxLength={6}
      />

      {loading ? (
        <ActivityIndicator color={colors.safetyOrange} size="large" />
      ) : (
        <Button title={t('verifyOtp')} color={colors.navy} onPress={handleVerify} />
      )}

      <View style={styles.resendContainer}>
        <Button 
          title={cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend OTP'} 
          color={colors.darkGrey} 
          disabled={cooldown > 0 || loading} 
          onPress={handleResend} 
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.xl, backgroundColor: colors.white, justifyContent: 'center' },
  header: { fontSize: 24, fontWeight: 'bold', color: colors.navy, marginBottom: spacing.md, textAlign: 'center' },
  prompt: { fontSize: 16, color: colors.darkGrey, marginBottom: spacing.lg, textAlign: 'center' },
  input: { borderWidth: 1, borderColor: colors.lightGrey, borderRadius: 8, padding: spacing.md, marginBottom: spacing.lg, fontSize: 24, textAlign: 'center', letterSpacing: 8 },
  resendContainer: { marginTop: spacing.xl }
});
