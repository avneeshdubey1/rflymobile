// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { colors, spacing } from '../../theme/tokens';
import { useAuthStore } from '../../store/auth';

export default function BusinessDashboardScreen({ navigation }: any) {
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    const init = async () => {
      const p = await useAuthStore.getState().profile;
      setProfile(p);
    };
    init();
  }, []);

  return (
    <ScrollView style={styles.container}>
      <View style={styles.headerBox}>
        <Text style={styles.orgName}>{profile?.name || 'Organization Name'}</Text>
        <Text style={styles.roleText}>B2B Partner Dashboard</Text>
      </View>

      <View style={styles.grid}>
        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('LinkedRequestList')}>
          <Text style={styles.cardTitle}>Linked Requests</Text>
          <Text style={styles.cardDesc}>View requests associated with your organization.</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('Notifications')}>
          <Text style={styles.cardTitle}>Notifications</Text>
          <Text style={styles.cardDesc}>Recent updates and alerts.</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('Profile')}>
          <Text style={styles.cardTitle}>Organization Profile</Text>
          <Text style={styles.cardDesc}>View your business details.</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.lightGrey },
  headerBox: { padding: spacing.xl, backgroundColor: colors.navy },
  orgName: { fontSize: 28, fontWeight: 'bold', color: colors.white },
  roleText: { fontSize: 16, color: colors.safetyOrange, marginTop: spacing.xs, fontWeight: 'bold' },
  grid: { padding: spacing.lg },
  card: { backgroundColor: colors.white, padding: spacing.lg, borderRadius: 8, marginBottom: spacing.md, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: colors.navy, marginBottom: spacing.xs },
  cardDesc: { fontSize: 14, color: colors.darkGrey }
});
