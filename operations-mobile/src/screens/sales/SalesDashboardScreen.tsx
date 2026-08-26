import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Button } from 'react-native';
import { colors, spacing } from '../../theme/tokens';
import { salesApi, Customer } from '../../api/sales';

export default function SalesDashboardScreen({ navigation }: any) {
  const [query, setQuery] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const handler = setTimeout(() => {
      if (query.trim().length > 2) {
        search(query);
      } else {
        setCustomers([]);
      }
    }, 500);
    return () => clearTimeout(handler);
  }, [query]);

  const search = async (q: string) => {
    setLoading(true);
    try {
      const res = await salesApi.searchCustomers(q);
      if (res.success && res.customers) {
        setCustomers(res.customers);
      }
    } catch (err: any) {
      console.warn(err);
    } finally {
      setLoading(false);
    }
  };

  const renderItem = ({ item }: { item: Customer }) => (
    <TouchableOpacity 
      style={styles.card} 
      onPress={() => navigation.navigate('CustomerDetail', { customer: item })}
      testID="customer-card"
    >
      <Text style={styles.name}>{item.displayName || item.phone}</Text>
      <Text style={styles.phone}>{item.phone}</Text>
      {item.location && item.location.village && (
        <Text style={styles.location}>{item.location.village}, {item.location.district}</Text>
      )}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Sales Dashboard</Text>
      
      <TextInput
        style={styles.searchInput}
        placeholder="Search customers by name or phone..."
        value={query}
        onChangeText={setQuery}
        testID="search-input"
      />
      
      <Button 
        title="+ New Customer" 
        onPress={() => navigation.navigate('CreateCustomer')}
        color={colors.safetyOrange}
        testID="btn-new-customer"
      />

      {loading && <ActivityIndicator style={{ marginTop: spacing.md }} color={colors.safetyOrange} testID="loading-indicator" />}

      <FlatList
        data={customers}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          !loading && query.length > 2 ? <Text style={styles.empty} testID="empty-list">No customers found.</Text> : null
        }
        testID="customer-list"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.lightGrey, padding: spacing.md },
  header: { fontSize: 24, fontWeight: 'bold', color: colors.navy, marginBottom: spacing.md },
  searchInput: { 
    backgroundColor: colors.white, 
    padding: spacing.sm, 
    borderRadius: 8, 
    borderWidth: 1, 
    borderColor: colors.navy,
    marginBottom: spacing.md 
  },
  list: { marginTop: spacing.md },
  card: { 
    backgroundColor: colors.white, 
    padding: spacing.md, 
    borderRadius: 8, 
    marginBottom: spacing.sm,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  name: { fontSize: 18, fontWeight: 'bold', color: colors.navy },
  phone: { fontSize: 14, color: colors.darkGrey },
  location: { fontSize: 12, color: colors.darkGrey, marginTop: spacing.xs },
  empty: { textAlign: 'center', marginTop: spacing.lg, color: colors.darkGrey }
});
