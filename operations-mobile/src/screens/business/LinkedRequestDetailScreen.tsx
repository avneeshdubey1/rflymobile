// @ts-nocheck
import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { colors, spacing } from '../../theme/tokens';

export default function LinkedRequestDetailScreen({ route }: any) {
  const { request } = route.params;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.header}>Request Details</Text>
        <Text style={styles.label}>Crop</Text>
        <Text style={styles.value}>{request.crop}</Text>

        <Text style={styles.label}>Area</Text>
        <Text style={styles.value}>{request.area} Acres</Text>

        <Text style={styles.label}>Status</Text>
        <Text style={[styles.value, { color: colors.safetyOrange }]}>{request.status}</Text>

        <Text style={styles.label}>Date Created</Text>
        <Text style={styles.value}>{new Date(request.date).toLocaleString()}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.lg, backgroundColor: colors.lightGrey },
  card: { backgroundColor: colors.white, padding: spacing.lg, borderRadius: 8 },
  header: { fontSize: 22, fontWeight: 'bold', color: colors.navy, marginBottom: spacing.lg },
  label: { fontSize: 14, color: colors.darkGrey, marginBottom: 2 },
  value: { fontSize: 18, color: colors.navy, marginBottom: spacing.md, fontWeight: '500' }
});
