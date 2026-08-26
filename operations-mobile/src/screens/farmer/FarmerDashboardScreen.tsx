// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { colors, spacing } from '../../theme/tokens';
import { farmerApi } from '../../api/farmer';
import { useAuthStore } from '../../store/auth';
import { t } from '../../i18n/farmer';

export default function FarmerDashboardScreen({ navigation }: any) {
  const [history, setHistory] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      const p = await useAuthStore.getState().profile;
      setProfile(p);
      loadDashboard();
    };
    init();
  }, []);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const res = await farmerApi.getDashboard();
      if (res.success && res.history) {
        setHistory(res.history);
      }
    } catch (err: any) {
      console.warn('Dashboard load error', err);
    } finally {
      setLoading(false);
    }
  };

  const renderItem = ({ item }: { item: any }) => (
    <View style={styles.card}>
      <Text style={styles.serviceName}>{item.crop} - {item.area} acres</Text>
      <Text style={styles.detail}>Status: {item.status}</Text>
      <Text style={styles.detail}>Date: {new Date(item.date).toLocaleDateString()}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.headerBox}>
        <Text style={styles.greeting}>{t('welcome')}, {profile?.name || 'Farmer'}</Text>
        <Text style={styles.phone}>{profile?.phone}</Text>
      </View>

      <TouchableOpacity 
        style={styles.requestBtn} 
        onPress={() => navigation.navigate('ServiceRequestWizard')}
      >
        <Text style={styles.requestBtnText}>+ {t('newRequest')}</Text>
      </TouchableOpacity>

      <Text style={styles.historyTitle}>{t('history')}</Text>

      {loading ? (
        <ActivityIndicator color={colors.safetyOrange} size="large" />
      ) : (
        <FlatList
          data={history}
          keyExtractor={(item, index) => item.id || String(index)}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.empty}>{t('noHistory')}</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.lightGrey },
  headerBox: { padding: spacing.xl, backgroundColor: colors.navy },
  greeting: { fontSize: 24, fontWeight: 'bold', color: colors.white },
  phone: { fontSize: 16, color: colors.white, marginTop: spacing.xs, opacity: 0.8 },
  requestBtn: { 
    backgroundColor: colors.safetyOrange, 
    margin: spacing.lg, 
    padding: spacing.md, 
    borderRadius: 8, 
    alignItems: 'center' 
  },
  requestBtnText: { color: colors.white, fontSize: 18, fontWeight: 'bold' },
  historyTitle: { fontSize: 18, fontWeight: 'bold', color: colors.navy, marginHorizontal: spacing.lg },
  list: { padding: spacing.lg },
  card: { backgroundColor: colors.white, padding: spacing.md, borderRadius: 8, marginBottom: spacing.md, borderLeftWidth: 4, borderLeftColor: colors.safetyOrange },
  serviceName: { fontSize: 16, fontWeight: 'bold', color: colors.navy, marginBottom: spacing.xs },
  detail: { fontSize: 14, color: colors.darkGrey },
  empty: { textAlign: 'center', marginTop: spacing.xl, color: colors.darkGrey }
});
