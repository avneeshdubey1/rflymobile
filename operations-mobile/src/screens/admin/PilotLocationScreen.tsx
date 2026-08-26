// @ts-nocheck
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing } from '../../theme/tokens';

export default function PilotLocationScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.header}>Active Pilot Location</Text>
      <View style={styles.mapStub}>
        <Text style={styles.mapText}>[Map View Stub]</Text>
        <Text style={styles.mapSub}>Latest active-mission coordinates will be rendered here.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.md, backgroundColor: colors.lightGrey },
  header: { fontSize: 20, fontWeight: 'bold', color: colors.navy, marginBottom: spacing.md },
  mapStub: { flex: 1, backgroundColor: colors.white, justifyContent: 'center', alignItems: 'center', borderRadius: 8 },
  mapText: { fontSize: 24, fontWeight: 'bold', color: colors.darkGrey },
  mapSub: { fontSize: 14, color: colors.darkGrey, marginTop: spacing.md }
});
