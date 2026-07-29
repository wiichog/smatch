import { LinearGradient } from "expo-linear-gradient";
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
import { SafeAreaView } from "react-native-safe-area-context";

import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui";
import { api } from "@/lib/api";
import { enterAppAfterLogin } from "@/lib/notifications";
import { useAuth } from "@/store/auth";
import { alpha, colors, fonts, radius, spacing } from "@/theme";

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
      setSession(data.token, {
        id: data.user.id,
        email: data.user.email,
        name: data.user.name ?? "",
        avatar_url: data.user.avatar_url ?? null,
      });
      // Si la app la abrió un push sin sesión, entra directo a su destino. Una sola
      // navegación: dos hacia `(tabs)` en el mismo tick duplican el navegador.
      enterAppAfterLogin();
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
      {/* Scrim cinematográfico: transparente arriba (se ve el video) → grafito abajo
          (legibilidad del formulario), con tinte turquesa como la landing. */}
      <LinearGradient
        colors={[alpha(colors.surface, 0.35), alpha(colors.surface, 0.55), alpha(colors.surface, 0.96)]}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={[alpha(colors.highlight, 0.14), "transparent"]}
        start={{ x: 1, y: 0 }}
        end={{ x: 0.2, y: 0.5 }}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.kav}
        >
          <View style={styles.inner}>
            <Logo size={52} dark />
            <Text style={styles.tagline}>Tu liga de pádel, siempre en juego.</Text>
            <Text style={styles.subtitle}>Consulta tu jornada, tu cancha y tu ranking.</Text>

            <View style={styles.form}>
              <TextInput
                style={styles.input}
                placeholder="Correo"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
              />
              <TextInput
                style={styles.input}
                placeholder="Contraseña"
                placeholderTextColor={colors.textMuted}
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />
              {!!error && <Text style={styles.error}>{error}</Text>}
              <Button title="Entrar" onPress={onLogin} loading={loading} />
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink900 },
  kav: { flex: 1 },
  inner: { flex: 1, justifyContent: "flex-end", padding: spacing.lg, paddingBottom: spacing.xl },
  tagline: {
    color: colors.text,
    fontSize: 30,
    fontFamily: fonts.display,
    letterSpacing: -0.5,
    marginTop: spacing.lg,
    lineHeight: 34,
  },
  subtitle: { color: colors.textMuted, marginTop: spacing.sm, marginBottom: spacing.lg, fontSize: 15 },
  form: { gap: spacing.md },
  input: {
    backgroundColor: colors.glassStrong,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    borderRadius: radius.lg,
    minHeight: 54,
    paddingHorizontal: spacing.md,
    fontSize: 16,
    color: colors.text,
  },
  error: { color: colors.danger, fontSize: 14 },
});
