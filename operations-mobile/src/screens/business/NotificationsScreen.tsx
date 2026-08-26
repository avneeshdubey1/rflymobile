import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { colors, spacing } from '../../theme/tokens';
import { businessApi } from '../../api/business';

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const res: any = await businessApi.getNotifications();
      if (res.success && res.notifications) {
        setNotifications(res.notifications);
      }
    } catch (err: any) {
      console.warn(err);
    } finally {
      setLoading(false);
    }
  };

  const renderItem = ({ item }: { item: any }) => (
    <View style={styles.card}>
      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.message}>{item.message}</Text>
      <Text style={styles.time}>{new Date(item.createdAt).toLocaleString()}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {loading ? (
        <ActivityIndicator color={colors.safetyOrange} size="large" style={{ marginTop: spacing.xl }} />
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item, idx) => item.id || String(idx)}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.empty}>No recent notifications.</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.lightGrey },
  list: { padding: spacing.md },
  card: { backgroundColor: colors.white, padding: spacing.md, borderRadius: 8, marginBottom: spacing.md },
  title: { fontSize: 16, fontWeight: 'bold', color: colors.navy, marginBottom: spacing.xs },
  message: { fontSize: 14, color: colors.darkGrey, marginBottom: spacing.sm },
  time: { fontSize: 12, color: colors.darkGrey },
  empty: { textAlign: 'center', marginTop: spacing.xl, color: colors.darkGrey }
});
