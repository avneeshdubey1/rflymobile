import React from 'react';
import { View, Text, StyleSheet, Button } from 'react-native';
import { colors, spacing } from '../theme/tokens';
import { useAuthStore } from '../store/auth';
import { authApi } from '../api/auth';

export default function RoleShellScreen({ navigation }: any) {
  const { logout, profile } = useAuthStore();

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch (e: any) {
      // ignore
    } finally {
      await logout();
      navigation.replace('Login');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.text}>Operations Dashboard</Text>
      {profile && <Text style={{ marginBottom: spacing.lg }}>Welcome, {profile.name || profile.displayName || profile.email}</Text>}
      
      <View style={styles.actions}>
        <Button 
          title="Sales / Intake" 
          color={colors.safetyOrange}
          onPress={() => navigation.navigate('SalesDashboard')}
        />
        <View style={{ height: 16 }} />
        <Button 
          title="Fleet Operations" 
          color={colors.navy}
          onPress={() => navigation.navigate('FleetDashboard')}
        />
        <View style={{ height: 16 }} />
        <Button 
          title="Admin Controls" 
          color={colors.darkGrey}
          onPress={() => navigation.navigate('AdminDashboard')}
        />
        <View style={{ height: 32 }} />
        <Button 
          title="Logout" 
          color="red"
          onPress={handleLogout}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.white },
  text: { fontSize: 24, color: colors.navy, marginBottom: spacing.md },
  actions: { width: '80%' }
});
