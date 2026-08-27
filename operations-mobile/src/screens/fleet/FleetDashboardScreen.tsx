import React from 'react';
import { View, Text, StyleSheet, Button } from 'react-native';
import { colors, spacing } from '../../theme/tokens';

export default function FleetDashboardScreen({ navigation }: any) {
  return (
    <View style={styles.container}>
      <Text style={styles.header}>Fleet Operations</Text>
      
      <View style={styles.card}>
        <Text style={styles.title}>Daily Schedule</Text>
        <Text style={styles.description}>View today's assignments, pilots, and drones.</Text>
        <Button 
          title="View Schedule" 
          color={colors.navy}
          onPress={() => navigation.navigate('FleetSchedule')}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>Live Exceptions</Text>
        <Text style={styles.description}>Monitor delays, grounded drones, and issues.</Text>
        <Button 
          title="View Exceptions" 
          color={colors.safetyOrange}
          onPress={() => navigation.navigate('FleetExceptions')}
        />
      </View>
    </View>
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
  },
  title: { fontSize: 20, fontWeight: 'bold', color: colors.navy, marginBottom: spacing.sm },
  description: { fontSize: 14, color: colors.darkGrey, marginBottom: spacing.md }
});
