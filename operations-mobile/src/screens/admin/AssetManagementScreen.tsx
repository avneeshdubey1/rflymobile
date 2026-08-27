import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { colors, spacing } from '../../theme/tokens';
import { adminApi } from '../../api/admin';

export default function AssetManagementScreen({ navigation }: any) {
  const [drones, setDrones] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', loadAssets);
    return unsubscribe;
  }, [navigation]);

  const loadAssets = async () => {
    setLoading(true);
    try {
      const res: any = await adminApi.getDrones();
      if (res.success && res.drones) {
        setDrones(res.drones);
      }
    } catch (err: any) {
      Alert.alert('Error', err.data?.error?.message || 'Failed to load assets');
    } finally {
      setLoading(false);
    }
  };

  const renderItem = ({ item }: { item: any }) => (
    <View style={styles.card} testID={`asset-card-${item.id}`}>
      <Text style={styles.name}>{item.label || item.name || 'Unnamed Drone'}</Text>
      <Text style={styles.detail}>Status: {item.status}</Text>
      <Text style={styles.detail}>Center ID: {item.operatingCenterId || 'None'}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.header}>Drones & Assets</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.safetyOrange} size="large" testID="loading-indicator" />
      ) : (
        <FlatList
          data={drones}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.empty}>No assets found.</Text>}
          testID="drones-list"
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
  card: { 
    backgroundColor: colors.white, 
    padding: spacing.md, 
    borderRadius: 8, 
    marginBottom: spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: colors.safetyOrange
  },
  name: { fontSize: 18, fontWeight: 'bold', color: colors.navy, marginBottom: spacing.xs },
  detail: { fontSize: 14, color: colors.darkGrey },
  empty: { textAlign: 'center', marginTop: spacing.xl, color: colors.darkGrey }
});
