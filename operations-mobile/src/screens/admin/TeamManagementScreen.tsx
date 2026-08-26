import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, Alert, TouchableOpacity } from 'react-native';
import { colors, spacing } from '../../theme/tokens';
import { adminApi } from '../../api/admin';

export default function TeamManagementScreen({ navigation }: any) {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', loadUsers);
    return unsubscribe;
  }, [navigation]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const res: any = await adminApi.getUsers();
      if (res.success && res.users) {
        setUsers(res.users);
      }
    } catch (err: any) {
      Alert.alert('Error', err.data?.error?.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const renderItem = ({ item }: { item: any }) => (
    <View style={styles.card} testID={`user-card-${item.id}`}>
      <Text style={styles.name}>{item.name}</Text>
      <Text style={styles.role}>{item.role}</Text>
      <Text style={styles.detail}>{item.email}</Text>
      <Text style={[styles.status, { color: item.active ? colors.success : colors.error }]}>
        {item.active ? 'ACTIVE' : 'INACTIVE'}
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.header}>Team Directory</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.safetyOrange} size="large" testID="loading-indicator" />
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.empty}>No team members found.</Text>}
          testID="users-list"
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
    borderLeftColor: colors.navy
  },
  name: { fontSize: 18, fontWeight: 'bold', color: colors.navy },
  role: { fontSize: 14, fontWeight: 'bold', color: colors.safetyOrange, marginVertical: spacing.xs },
  detail: { fontSize: 14, color: colors.darkGrey },
  status: { fontSize: 12, fontWeight: 'bold', marginTop: spacing.sm },
  empty: { textAlign: 'center', marginTop: spacing.xl, color: colors.darkGrey }
});
