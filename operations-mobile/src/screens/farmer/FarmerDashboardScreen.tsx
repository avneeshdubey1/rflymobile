import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity, Alert, RefreshControl } from 'react-native';
import { colors, spacing } from '../../theme/tokens';
import { farmerApi } from '../../api/farmer';
import { useAuthStore } from '../../store/auth';
import { t } from '../../i18n/farmer';

export default function FarmerDashboardScreen({ navigation }: any) {
  const [history, setHistory] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const init = async () => {
      const p = await useAuthStore.getState().profile;
      setProfile(p);
    };
    init();
    const unsubscribe = navigation.addListener('focus', loadDashboard);
    return unsubscribe;
  }, [navigation]);

  const loadDashboard = async () => {
    try {
      const res: any = await farmerApi.getDashboard();
      if (res.success && res.history) {
        setHistory(res.history);
      }
    } catch (err: any) {
      Alert.alert('Error', err.data?.error?.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadDashboard();
  };

  const renderItem = ({ item }: { item: any }) => (
    <View style={styles.card} testID={`history-card-${item.id}`}>
      <Text style={styles.serviceName}>{item.crop} - {item.area} {t('areaLabel').split(' ')[0]}</Text>
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
        testID="btn-new-request"
      >
        <Text style={styles.requestBtnText}>+ {t('newRequest')}</Text>
      </TouchableOpacity>

      <Text style={styles.historyTitle}>{t('history')}</Text>

      {loading ? (
        <ActivityIndicator color={colors.safetyOrange} size="large" testID="loading-indicator" />
      ) : (
        <FlatList
          data={history}
          keyExtractor={(item, index) => item.id || String(index)}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={<Text style={styles.empty}>{t('noHistory')}</Text>}
          testID="history-list"
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
  card: { backgroundColor: colors.white, padding: spacing.md, borderRadius: 8, marginBottom: spacing.md, borderLeftWidth: 4, borderLeftColor: colors.safetyOrange, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  serviceName: { fontSize: 16, fontWeight: 'bold', color: colors.navy, marginBottom: spacing.xs },
  detail: { fontSize: 14, color: colors.darkGrey },
  empty: { textAlign: 'center', marginTop: spacing.xl, color: colors.darkGrey }
});
