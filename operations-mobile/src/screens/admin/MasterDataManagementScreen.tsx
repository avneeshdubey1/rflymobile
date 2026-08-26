import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { colors, spacing } from '../../theme/tokens';
import { adminApi } from '../../api/admin';

export default function MasterDataManagementScreen() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMasterData();
  }, []);

  const loadMasterData = async () => {
    setLoading(true);
    try {
      const res: any = await adminApi.getMasterData();
      if (res.success && res.clusters) {
        setData(res.clusters);
      }
    } catch (err: any) {
      Alert.alert('Error', err.data?.error?.message || 'Failed to load master data');
    } finally {
      setLoading(false);
    }
  };

  const renderItem = ({ item }: { item: any }) => (
    <View style={styles.card} testID={`master-card-${item.id}`}>
      <Text style={styles.name}>{item.name}</Text>
      <Text style={styles.detail}>Type: {item.clusterType}</Text>
      <Text style={styles.status}>{item.active ? 'Active' : 'Inactive'}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.header}>Master Data (Clusters)</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.safetyOrange} size="large" testID="loading-indicator" />
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.empty}>No master data found.</Text>}
          testID="master-list"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.lightGrey },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md, backgroundColor: colors.white },
  header: { fontSize: 20, fontWeight: 'bold', color: colors.navy },
  list: { padding: spacing.md },
  card: { backgroundColor: colors.white, padding: spacing.md, borderRadius: 8, marginBottom: spacing.md, borderLeftWidth: 4, borderLeftColor: colors.safetyOrange },
  name: { fontSize: 18, fontWeight: 'bold', color: colors.navy, marginBottom: spacing.xs },
  detail: { fontSize: 14, color: colors.darkGrey },
  status: { fontSize: 14, fontWeight: 'bold', color: colors.success, marginTop: spacing.xs },
  empty: { textAlign: 'center', marginTop: spacing.xl, color: colors.darkGrey }
});
