import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { useAuthStore } from "../src/store/auth";
import { Banner, Button } from "../src/design-system/components";
import {
  colors,
  radius,
  spacing,
  typography,
} from "../src/design-system/tokens";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const { login, status, error } = useAuthStore();
  const loading = status === "AUTHENTICATING" || status === "BOOTSTRAPPING";

  useEffect(() => setValidationError(null), [email, password]);

  const handleLogin = () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password) {
      setValidationError("Enter both your work email and password.");
      return;
    }
    void login(normalizedEmail, password);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.brand}>
          <MaterialIcons
            name="flight-takeoff"
            size={52}
            color={colors.accent}
          />
          <Text style={styles.title}>RFLY Pilot</Text>
          <Text style={styles.subtitle}>Field Operations Terminal</Text>
        </View>

        <View style={styles.panel}>
          {validationError || error ? (
            <Banner
              tone="error"
              title="Sign-in failed"
              message={validationError || error || undefined}
            />
          ) : null}
          <Text style={styles.label}>WORK EMAIL</Text>
          <TextInput
            style={styles.input}
            placeholder="pilot@company.com"
            placeholderTextColor={colors.textSecondary}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="username"
            value={email}
            onChangeText={setEmail}
            editable={!loading}
            returnKeyType="next"
          />
          <Text style={[styles.label, styles.passwordLabel]}>PASSWORD</Text>
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor={colors.textSecondary}
            secureTextEntry
            textContentType="password"
            value={password}
            onChangeText={setPassword}
            editable={!loading}
            onSubmitEditing={handleLogin}
            returnKeyType="go"
          />
          <Button
            title="Sign In"
            onPress={handleLogin}
            loading={loading}
            style={styles.signIn}
          />
        </View>

        <Text style={styles.version}>
          SYSTEM SECURE • V{Constants.expoConfig?.version ?? "1.0.0"}
        </Text>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  keyboard: { flex: 1, justifyContent: "center", padding: spacing.lg },
  brand: { alignItems: "center", marginBottom: spacing.xl },
  title: {
    ...typography.heading,
    fontSize: 34,
    color: colors.primary,
    marginTop: spacing.sm,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  panel: {
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.disabled,
  },
  label: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: "700",
    marginBottom: spacing.sm,
  },
  passwordLabel: { marginTop: spacing.md },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: colors.textSecondary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
    fontSize: 16,
  },
  signIn: { marginTop: spacing.lg },
  version: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: spacing.lg,
    letterSpacing: 1,
  },
});
