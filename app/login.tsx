import { useRouter } from "expo-router";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { Button } from "@/components/ui";
import { api } from "@/lib/api";
import { useAuth } from "@/store/auth";
import { colors, radius, spacing } from "@/theme";

export default function Login() {
  const router = useRouter();
  const setSession = useAuth((s) => s.setSession);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onLogin() {
    setError("");
    setLoading(true);
    try {
      const data = await api.login(email.trim(), password);
      if (!data.user?.players?.length) {
        setError("Tu cuenta no está vinculada a ningún jugador.");
        return;
      }
      setSession(data.token, { id: data.user.id, email: data.user.email, name: data.user.name });
      router.replace("/(tabs)");
    } catch (e: any) {
      setError(e?.message ?? "No se pudo iniciar sesión.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.root}
    >
      <View style={styles.inner}>
        <Text style={styles.logo}>
          Smatch<Text style={{ color: colors.primary }}>.</Text>
        </Text>
        <Text style={styles.subtitle}>Consulta tu jornada y tu ranking.</Text>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Correo"
            placeholderTextColor={colors.ink400}
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <TextInput
            style={styles.input}
            placeholder="Contraseña"
            placeholderTextColor={colors.ink400}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
          {!!error && <Text style={styles.error}>{error}</Text>}
          <Button title="Entrar" onPress={onLogin} loading={loading} />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink900 },
  inner: { flex: 1, justifyContent: "center", padding: spacing.lg },
  logo: { fontSize: 40, fontWeight: "800", letterSpacing: -1, color: colors.textInverse },
  subtitle: { color: colors.ink400, marginTop: spacing.sm, marginBottom: spacing.xl },
  form: { gap: spacing.md },
  input: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    minHeight: 52,
    paddingHorizontal: spacing.md,
    fontSize: 16,
    color: colors.ink900,
  },
  error: { color: "#FCA5A5", fontSize: 14 },
});
