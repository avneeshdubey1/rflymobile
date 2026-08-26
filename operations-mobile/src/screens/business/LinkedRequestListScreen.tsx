import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { colors, spacing } from '../../theme/tokens';
import { businessApi } from '../../api/business';

export default function LinkedRequestListScreen({ navigation }: any) {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    setLoading(true);
    try {
      const res: any = await businessApi.getLinkedRequests();
      if (res.success && res.requests) {
        setRequests(res.requests);
      }
    } catch (err: any) {
      console.warn(err);
    } finally {
      setLoading(false);
    }
  };

  const renderItem = ({ item }: { item: any }) => (
    <TouchableOpacity 
      style={styles.card}
      onPress={() => navigation.navigate('LinkedRequestDetail', { request: item })}
    >
      <Text style={styles.title}>{item.crop} - {item.area} Acres</Text>
      <Text style={styles.detail}>Status: {item.status}</Text>
      <Text style={styles.detail}>Date: {new Date(item.date).toLocaleDateString()}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {loading ? (
        <ActivityIndicator color={colors.safetyOrange} size="large" style={{ marginTop: spacing.xl }} />
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(item, idx) => item.id || String(idx)}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.empty}>No linked requests found for your organization.</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.lightGrey },
  list: { padding: spacing.md },
  card: { backgroundColor: colors.white, padding: spacing.md, borderRadius: 8, marginBottom: spacing.md, borderLeftWidth: 4, borderLeftColor: colors.navy },
  title: { fontSize: 18, fontWeight: 'bold', color: colors.navy, marginBottom: spacing.xs },
  detail: { fontSize: 14, color: colors.darkGrey },
  empty: { textAlign: 'center', marginTop: spacing.xl, color: colors.darkGrey, paddingHorizontal: spacing.xl }
});
