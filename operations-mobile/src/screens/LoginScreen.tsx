import React from 'react';
import { View, Text, Button, StyleSheet } from 'react-native';
import { colors, spacing } from '../theme/tokens';

export default function LoginScreen({ navigation }: any) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>RFLY Operations Login</Text>
      <Button 
        title="Sign In" 
        color={colors.safetyOrange}
        onPress={() => navigation.replace('RoleShell')} 
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.lightGrey },
  title: { fontSize: 24, fontWeight: 'bold', color: colors.navy, marginBottom: spacing.lg }
});
