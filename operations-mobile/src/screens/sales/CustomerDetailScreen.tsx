import React from 'react';
import { View, Text, StyleSheet, Button, FlatList } from 'react-native';
import { colors, spacing } from '../../theme/tokens';
import { Customer } from '../../api/sales';

export default function CustomerDetailScreen({ route, navigation }: any) {
  const { customer } = route.params as { customer: Customer };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{customer.displayName}</Text>
      <Text style={styles.subtitle}>{customer.phone}</Text>
      
      {customer.location?.village && <Text style={styles.detail}>Village: {customer.location.village}</Text>}
      {customer.location?.district && <Text style={styles.detail}>District: {customer.location.district}</Text>}
      {customer.totalAcres && <Text style={styles.detail}>Total Acres: {customer.totalAcres}</Text>}
      
      <View style={styles.actions}>
        <Button 
          title="Create New Lead" 
          color={colors.safetyOrange}
          onPress={() => navigation.navigate('CreateLead', { customerId: customer.id })}
          testID="btn-create-lead"
        />
      </View>

      <Text style={[styles.title, { fontSize: 20, marginTop: spacing.xl }]}>Recent Leads</Text>
      <FlatList
        data={customer.recentLeads || []}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <View style={styles.leadCard}>
            <Text style={styles.leadTitle}>{item.crop} - {item.acreage} Acres</Text>
            <Text style={styles.leadStatus}>Status: {item.status}</Text>
            <Text style={styles.leadDate}>{new Date(item.createdAt).toLocaleDateString()}</Text>
          </View>
        )}
        ListEmptyComponent={<Text style={{ marginTop: spacing.md }}>No recent leads found.</Text>}
        testID="recent-leads-list"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.lg, backgroundColor: colors.lightGrey },
  title: { fontSize: 28, fontWeight: 'bold', color: colors.navy, marginBottom: spacing.xs },
  subtitle: { fontSize: 18, color: colors.darkGrey, marginBottom: spacing.lg },
  detail: { fontSize: 16, color: colors.navy, marginBottom: spacing.sm },
  actions: { marginTop: spacing.xl },
  leadCard: {
    backgroundColor: colors.white,
    padding: spacing.md,
    borderRadius: 8,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  leadTitle: { fontSize: 16, fontWeight: 'bold', color: colors.navy },
  leadStatus: { fontSize: 14, color: colors.safetyOrange, marginTop: 4 },
  leadDate: { fontSize: 12, color: colors.darkGrey, marginTop: 4 }
});
