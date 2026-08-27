import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, ActivityIndicator } from 'react-native';
import { colors, spacing } from '../theme/tokens';
import { authApi } from '../api/auth';
import { useAuthStore } from '../store/auth';

export default function LoginScreen({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const { establishSession } = useAuthStore();

  const handleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await authApi.login({ email, password });
      const bootstrap = await authApi.bootstrap(result.session.accessToken);
      if (!['ADMIN', 'FLEET_MANAGER', 'SALES'].includes(bootstrap.profile.role)) {
        throw new Error('This account is not permitted to use staff sign-in.');
      }
      await establishSession(result.session.accessToken, bootstrap.profile, bootstrap.capabilities);
    } catch (err: any) {
      if (err.status === 401) {
        setError('Invalid credentials');
      } else {
        setError(err.message || 'Login failed');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>RFLY Operations Login</Text>
      
      <View style={styles.form}>
        <TextInput 
          style={styles.input} 
          placeholder="Email" 
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput 
          style={styles.input} 
          placeholder="Password" 
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
        
        {error ? <Text style={styles.error}>{error}</Text> : null}
        
        {loading ? (
          <ActivityIndicator color={colors.safetyOrange} />
        ) : (
          <Button 
            title="Sign In (Staff)" 
            color={colors.safetyOrange}
            onPress={handleLogin} 
            disabled={!email || !password}
          />
        )}
      </View>

      <View style={{ marginTop: spacing.xl }}>
        <Button 
          title="I am a Farmer" 
          color={colors.navy}
          onPress={() => navigation.navigate('FarmerPhone')} 
        />
        <View style={{ height: spacing.md }} />
        <Button 
          title="B2B Partner Login" 
          color={colors.darkGrey}
          onPress={() => navigation.navigate('BusinessLogin')} 
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.lightGrey, padding: spacing.lg },
  title: { fontSize: 24, fontWeight: 'bold', color: colors.navy, marginBottom: spacing.lg },
  form: { width: '100%', maxWidth: 400, backgroundColor: 'white', padding: spacing.lg, borderRadius: 8, elevation: 2 },
  input: { borderWidth: 1, borderColor: colors.darkGrey, padding: spacing.md, marginBottom: spacing.md, borderRadius: 4 },
  error: { color: 'red', marginBottom: spacing.md, textAlign: 'center' }
});
