// @ts-nocheck
import React from 'react';
import { View, Text, StyleSheet, Button } from 'react-native';
import { colors, spacing } from '../../theme/tokens';
import { Customer } from '../../api/sales';

export default function CustomerDetailScreen({ route, navigation }: any) {
  const { customer } = route.params as { customer: Customer };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{customer.name}</Text>
      <Text style={styles.subtitle}>{customer.phone}</Text>
      
      {customer.village && <Text style={styles.detail}>Village: {customer.village}</Text>}
      {customer.district && <Text style={styles.detail}>District: {customer.district}</Text>}
      
      <View style={styles.actions}>
        <Button 
          title="Create New Lead" 
          color={colors.safetyOrange}
          onPress={() => navigation.navigate('CreateLead', { customerId: customer.id })}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.lg, backgroundColor: colors.lightGrey },
  title: { fontSize: 28, fontWeight: 'bold', color: colors.navy, marginBottom: spacing.xs },
  subtitle: { fontSize: 18, color: colors.darkGrey, marginBottom: spacing.lg },
  detail: { fontSize: 16, color: colors.navy, marginBottom: spacing.sm },
  actions: { marginTop: spacing.xl }
});
