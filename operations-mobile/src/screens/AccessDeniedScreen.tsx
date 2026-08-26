// @ts-nocheck
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/tokens';

export default function AccessDeniedScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Access Denied</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.white },
  text: { fontSize: 20, color: colors.error }
});
