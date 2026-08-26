// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { colors, spacing } from '../../theme/tokens';
import { adminApi } from '../../api/admin';

export default function RegionManagementScreen() {
  const [regions, setRegions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRegions();
  }, []);

  const loadRegions = async () => {
    setLoading(true);
    try {
      const res = await adminApi.getRegions();
      if (res.success && res.centers) {
        setRegions(res.centers);
      }
    } catch (err: any) {
      Alert.alert('Error', err.data?.error?.message || 'Failed to load regions');
    } finally {
      setLoading(false);
    }
  };

  const renderItem = ({ item }: { item: any }) => (
    <View style={styles.card}>
      <Text style={styles.name}>{item.name}</Text>
      <Text style={styles.detail}>Radius: {item.radiusKm} km</Text>
      <Text style={styles.detail}>Lat/Lng: {item.latitude}, {item.longitude}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.header}>Feasible Regions</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => Alert.alert('Stub', 'Add Region Form')}>
          <Text style={styles.addBtnText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.safetyOrange} size="large" />
      ) : (
        <FlatList
          data={regions}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.empty}>No regions defined.</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.lightGrey },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md, backgroundColor: colors.white },
  header: { fontSize: 20, fontWeight: 'bold', color: colors.navy },
  addBtn: { backgroundColor: colors.navy, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: 8 },
  addBtnText: { color: colors.white, fontWeight: 'bold' },
  list: { padding: spacing.md },
  card: { backgroundColor: colors.white, padding: spacing.md, borderRadius: 8, marginBottom: spacing.md, borderLeftWidth: 4, borderLeftColor: colors.safetyOrange },
  name: { fontSize: 18, fontWeight: 'bold', color: colors.navy, marginBottom: spacing.xs },
  detail: { fontSize: 14, color: colors.darkGrey },
  empty: { textAlign: 'center', marginTop: spacing.xl, color: colors.darkGrey }
});
