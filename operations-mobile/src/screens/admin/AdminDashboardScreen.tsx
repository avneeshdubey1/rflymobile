// @ts-nocheck
import React from 'react';
import { View, Text, StyleSheet, Button, ScrollView } from 'react-native';
import { colors, spacing } from '../../theme/tokens';

export default function AdminDashboardScreen({ navigation }: any) {
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.header}>Admin Home</Text>

      <View style={styles.card}>
        <Text style={styles.title}>1. Operational Review Queues</Text>
        <Text style={styles.description}>Review pending approvals and system alerts.</Text>
        <Button 
          title="Review Queues (Stub)" 
          color={colors.darkGrey}
          onPress={() => console.log('Navigate to Review Queues')}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>2. Customer & Intake</Text>
        <Text style={styles.description}>Manage customers and lead intake (Sales reuse).</Text>
        <Button 
          title="Sales Intake" 
          color={colors.safetyOrange}
          onPress={() => navigation.navigate('SalesDashboard')}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>3. Assignments & Exceptions</Text>
        <Text style={styles.description}>Manage daily schedule and exceptions (Fleet reuse).</Text>
        <Button 
          title="Fleet Operations" 
          color={colors.navy}
          onPress={() => navigation.navigate('FleetDashboard')}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>4. Team Management</Text>
        <Text style={styles.description}>Manage users, roles, and administrative guards.</Text>
        <Button 
          title="Team Directory" 
          color={colors.darkGrey}
          onPress={() => navigation.navigate('TeamManagement')}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>5. Asset Management</Text>
        <Text style={styles.description}>Drone, LMV, Pilot management + operating-centre transfers.</Text>
        <Button 
          title="Assets & Transfers" 
          color={colors.safetyOrange}
          onPress={() => navigation.navigate('AssetManagement')}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>6. Feasible Regions</Text>
        <Text style={styles.description}>Manage operating centers and radius boundaries.</Text>
        <Button 
          title="Regions (Phase 6C)" 
          color={colors.navy}
          onPress={() => navigation.navigate('RegionManagement')}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>7. Auto-Assignment Policy</Text>
        <Text style={styles.description}>Configure revision-protected assignment policies.</Text>
        <Button 
          title="Policy (Phase 6C)" 
          color={colors.darkGrey}
          onPress={() => navigation.navigate('PolicyManagement')}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>8. Master Data</Text>
        <Text style={styles.description}>Server-backed master-data configuration for roles.</Text>
        <Button 
          title="Master Data (Phase 6C)" 
          color={colors.safetyOrange}
          onPress={() => navigation.navigate('MasterDataManagement')}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>9. Live Pilot Location</Text>
        <Text style={styles.description}>Track active-mission Pilot locations.</Text>
        <Button 
          title="Live Map (Phase 6C)" 
          color={colors.navy}
          onPress={() => navigation.navigate('PilotLocation')}
        />
      </View>
      
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.lg, backgroundColor: colors.lightGrey },
  header: { fontSize: 24, fontWeight: 'bold', color: colors.navy, marginBottom: spacing.xl },
  card: { 
    backgroundColor: colors.white, 
    padding: spacing.md, 
    borderRadius: 8, 
    marginBottom: spacing.lg,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    borderLeftWidth: 4,
    borderLeftColor: colors.navy
  },
  title: { fontSize: 18, fontWeight: 'bold', color: colors.navy, marginBottom: spacing.sm },
  description: { fontSize: 14, color: colors.darkGrey, marginBottom: spacing.md }
});
