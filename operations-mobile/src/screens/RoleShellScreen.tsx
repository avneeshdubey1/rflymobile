import React from 'react';
import { View, Text, StyleSheet, Button } from 'react-native';
import { colors, spacing } from '../theme/tokens';
import { useAuthStore } from '../store/auth';
import { authApi } from '../api/auth';

export default function RoleShellScreen({ navigation }: any) {
  const { logout, profile, capabilities } = useAuthStore();

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch (e: any) {
      // ignore
    } finally {
      await logout();
    }
  };

  const caps = capabilities || [];
  const hasSales = caps.includes('SALES_INTAKE');
  const hasFleet = caps.includes('FLEET_SCHEDULE');
  const hasAdmin = profile?.role === 'ADMIN';
  const hasNone = !hasSales && !hasFleet && !hasAdmin;

  return (
    <View style={styles.container}>
      <Text style={styles.text}>Operations Dashboard</Text>
      {profile && <Text style={{ marginBottom: spacing.lg }}>Welcome, {profile.displayName || profile.employeeCode || 'team member'}</Text>}
      
      <View style={styles.actions}>
        {hasSales && (
          <View>
            <Button 
              title="Sales / Intake" 
              color={colors.safetyOrange}
              onPress={() => navigation.navigate('SalesDashboard')}
              testID="btn-sales"
            />
            <View style={{ height: 16 }} />
          </View>
        )}
        
        {hasFleet && (
          <View>
            <Button 
              title="Fleet Operations" 
              color={colors.navy}
              onPress={() => navigation.navigate('FleetDashboard')}
              testID="btn-fleet"
            />
            <View style={{ height: 16 }} />
          </View>
        )}

        {hasAdmin && (
          <View>
            <Button 
              title="Admin Controls" 
              color={colors.darkGrey}
              onPress={() => navigation.navigate('AdminDashboard')}
              testID="btn-admin"
            />
            <View style={{ height: 16 }} />
          </View>
        )}

        {hasNone && (
          <Text style={styles.noAccess} testID="no-access">No access provisions</Text>
        )}

        <View style={{ height: 32 }} />
        <Button 
          title="Logout" 
          color="red"
          onPress={handleLogout}
          testID="btn-logout"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.white },
  text: { fontSize: 24, color: colors.navy, marginBottom: spacing.md },
  noAccess: { fontSize: 16, color: 'red', textAlign: 'center', marginBottom: spacing.md },
  actions: { width: '80%' }
});
