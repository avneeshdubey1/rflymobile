import React from 'react';
import { View, Text, StyleSheet, Button } from 'react-native';
import { colors, spacing } from '../theme/tokens';

export default function RoleShellScreen({ navigation }: any) {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Operations Dashboard</Text>
      
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
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.white },
  text: { fontSize: 24, color: colors.navy, marginBottom: spacing.xl },
  actions: { width: '80%' }
});
