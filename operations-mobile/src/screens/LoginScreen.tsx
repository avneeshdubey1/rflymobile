import React from 'react';
import { View, Text, Button, StyleSheet } from 'react-native';
import { colors, spacing } from '../theme/tokens';

export default function LoginScreen({ navigation }: any) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>RFLY Operations Login</Text>
      <Button 
        title="Sign In (Staff)" 
        color={colors.safetyOrange}
        onPress={() => navigation.replace('RoleShell')} 
      />
      <View style={{ marginTop: spacing.xl }}>
        <Button 
          title="I am a Farmer" 
          color={colors.navy}
          onPress={() => navigation.navigate('FarmerPhone')} 
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.lightGrey },
  title: { fontSize: 24, fontWeight: 'bold', color: colors.navy, marginBottom: spacing.lg }
});
