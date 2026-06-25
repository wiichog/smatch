import { useRouter } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui";
import { api } from "@/lib/api";
import { useAuth } from "@/store/auth";
import { colors, radius, spacing } from "@/theme";

// Mismo video del hero de la landing / login web (placeholder — reemplazar por
// un clip de pádel propio servido desde CDN).
const LOGIN_VIDEO =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260618_174853_aac61aa2-0f3f-4cf1-bc78-7f657dd11164.mp4";

export default function Login() {
  const router = useRouter();
  const setSession = useAuth((s) => s.setSession);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Video de fondo en loop, silenciado y autoplay.
  const player = useVideoPlayer(LOGIN_VIDEO, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });

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
    <View style={styles.root}>
      <VideoView
        style={StyleSheet.absoluteFill}
        player={player}
        contentFit="cover"
        nativeControls={false}
      />
      {/* Scrim para legibilidad del formulario sobre el video */}
      <View style={styles.scrim} />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.kav}
      >
        <View style={styles.inner}>
          <Logo size={48} dark />
          <Text style={styles.subtitle}>Consulta tu jornada y tu ranking.</Text>

          <View style={styles.form}>
            <TextInput
              style={styles.input}
              placeholder="Correo"
              placeholderTextColor="rgba(255,255,255,0.5)"
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
            <TextInput
              style={styles.input}
              placeholder="Contraseña"
              placeholderTextColor="rgba(255,255,255,0.5)"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
            {!!error && <Text style={styles.error}>{error}</Text>}
            <Button title="Entrar" onPress={onLogin} loading={loading} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink900 },
  scrim: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(11,12,14,0.62)",
  },
  kav: { flex: 1 },
  inner: { flex: 1, justifyContent: "center", padding: spacing.lg },
  subtitle: { color: "rgba(255,255,255,0.7)", marginTop: spacing.md, marginBottom: spacing.xl },
  form: { gap: spacing.md },
  input: {
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    borderRadius: radius.md,
    minHeight: 52,
    paddingHorizontal: spacing.md,
    fontSize: 16,
    color: colors.text,
  },
  error: { color: "#FCA5A5", fontSize: 14 },
});
