// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Button, Alert } from 'react-native';
import { colors, spacing } from '../../theme/tokens';
import { businessApi } from '../../api/business';
import { useAuthStore } from '../../store/auth';

export default function ProfileScreen({ navigation }: any) {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const res = await businessApi.getProfile();
      if (res.success && res.profile) {
        setProfile(res.profile);
      }
    } catch (err: any) {
      console.warn(err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await useAuthStore.getState().logout();
    navigation.replace('Login');
  };

  if (loading) {
    return <ActivityIndicator color={colors.safetyOrange} size="large" style={{ marginTop: spacing.xl }} />;
  }

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.header}>Organization Details</Text>
        <Text style={styles.label}>Name</Text>
        <Text style={styles.value}>{profile?.name || 'N/A'}</Text>
        
        <Text style={styles.label}>Email</Text>
        <Text style={styles.value}>{profile?.email || 'N/A'}</Text>
        
        <Text style={styles.label}>Role</Text>
        <Text style={styles.value}>{profile?.role || 'N/A'}</Text>
      </View>
      
      <View style={styles.logoutBox}>
        <Button title="Sign Out" color={colors.error} onPress={handleLogout} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.lg, backgroundColor: colors.lightGrey },
  card: { backgroundColor: colors.white, padding: spacing.lg, borderRadius: 8 },
  header: { fontSize: 22, fontWeight: 'bold', color: colors.navy, marginBottom: spacing.lg },
  label: { fontSize: 14, color: colors.darkGrey, marginBottom: 2 },
  value: { fontSize: 18, color: colors.navy, marginBottom: spacing.md, fontWeight: '500' },
  logoutBox: { marginTop: spacing.xl }
});
