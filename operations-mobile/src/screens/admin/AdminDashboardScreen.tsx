import React from 'react';
import { View, Text, StyleSheet, Button, ScrollView } from 'react-native';
import { colors, spacing } from '../../theme/tokens';

export default function AdminDashboardScreen({ navigation }: any) {
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.header}>Admin Home</Text>

      <View style={styles.card}>
        <Text style={styles.title}>Customer & Intake</Text>
        <Text style={styles.description}>Manage customers and lead intake (Sales reuse).</Text>
        <Button 
          title="Sales Intake" 
          color={colors.safetyOrange}
          onPress={() => navigation.navigate('SalesDashboard')}
          testID="btn-sales"
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>Assignments & Exceptions</Text>
        <Text style={styles.description}>Manage daily schedule and exceptions (Fleet reuse).</Text>
        <Button 
          title="Fleet Operations" 
          color={colors.navy}
          onPress={() => navigation.navigate('FleetDashboard')}
          testID="btn-fleet"
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>Team Management</Text>
        <Text style={styles.description}>Manage users, roles, and administrative guards.</Text>
        <Button 
          title="Team Directory" 
          color={colors.darkGrey}
          onPress={() => navigation.navigate('TeamManagement')}
          testID="btn-team"
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>Asset Management</Text>
        <Text style={styles.description}>Drone, LMV, Pilot management + operating-centre transfers.</Text>
        <Button 
          title="Assets & Transfers" 
          color={colors.safetyOrange}
          onPress={() => navigation.navigate('AssetManagement')}
          testID="btn-assets"
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>Feasible Regions</Text>
        <Text style={styles.description}>Manage operating centers and radius boundaries.</Text>
        <Button 
          title="Regions" 
          color={colors.navy}
          onPress={() => navigation.navigate('RegionManagement')}
          testID="btn-regions"
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>Auto-Assignment Policy</Text>
        <Text style={styles.description}>Configure revision-protected assignment policies.</Text>
        <Button 
          title="Policy" 
          color={colors.darkGrey}
          onPress={() => navigation.navigate('PolicyManagement')}
          testID="btn-policy"
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>Master Data</Text>
        <Text style={styles.description}>Server-backed master-data configuration for roles.</Text>
        <Button 
          title="Master Data" 
          color={colors.safetyOrange}
          onPress={() => navigation.navigate('MasterDataManagement')}
          testID="btn-master"
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
