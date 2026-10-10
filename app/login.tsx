import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui";
import { api } from "@/lib/api";
import { enterAppAfterLogin, enterClubAfterLogin } from "@/lib/notifications";
import { toAuthUser, useAuth } from "@/store/auth";
import { alpha, colors, fonts, MAX_FONT_SCALE, radius, spacing } from "@/theme";

// Mismo video del hero de la landing / login web (placeholder — reemplazar por
// un clip de pádel propio servido desde CDN).
const LOGIN_VIDEO =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260618_174853_aac61aa2-0f3f-4cf1-bc78-7f657dd11164.mp4";

export default function Login() {
  // `expired`: la raíz trajo aquí a alguien cuya sesión ya no sirve (401): se le dice
  // por qué volvió a esta pantalla en vez de dejarlo adivinar.
  const { expired } = useLocalSearchParams<{ expired?: string }>();
  const setSession = useAuth((s) => s.setSession);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  // «¿Olvidaste tu contraseña?» (2026-10-09): el mismo formulario cambia a pedir el
  // enlace. `sentTo` = a qué correo se pidió (el servidor no dice si existe la cuenta).
  const [forgot, setForgot] = useState(false);
  const [sentTo, setSentTo] = useState("");

  // Video de fondo en loop, silenciado y autoplay.
  const player = useVideoPlayer(LOGIN_VIDEO, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });

  async function onLogin() {
    setError("");
    // Sin esto el backend contestaba «password: Este campo no puede estar en blanco».
    if (!email.trim() || !password) {
      setError("Escribe tu correo y tu contraseña.");
      return;
    }
    setLoading(true);
    try {
      const data = await api.login(email.trim(), password);
      const user = toAuthUser(data.user);
      const session = data.session === "device" ? "device" : "shared";
      if (!user.players_count && !user.memberships?.length) {
        setError("Tu cuenta no está vinculada a ningún jugador. Pídele a tu club que te invite.");
        // El backend ya abrió una sesión para este teléfono: se cierra para no dejarla viva.
        if (session === "device") void api.logout(data.token).catch(() => {});
        return;
      }
      setSession(data.token, user, session);
      // Staff sin jugador (dueño, administrador): entra al modo club (fase 3, 2026-10).
      // Antes se le cerraba la puerta con «esta app es para jugadores».
      if (!user.players_count) {
        enterClubAfterLogin();
        return;
      }
      // Si la app la abrió un push sin sesión, entra directo a su destino. Una sola
      // navegación: dos hacia `(tabs)` en el mismo tick duplican el navegador.
      enterAppAfterLogin();
    } catch (e: any) {
      setError(e?.message ?? "No se pudo iniciar sesión.");
    } finally {
      setLoading(false);
    }
  }

  async function onForgot() {
    setError("");
    const correo = email.trim();
    if (!correo.includes("@")) {
      setError("Escribe el correo con el que entras a Smatch.");
      return;
    }
    setLoading(true);
    try {
      await api.forgotPassword(correo);
      setSentTo(correo);
    } catch (e: any) {
      setError(
        e?.status === 429
          ? "Demasiados intentos. Espera unos minutos y vuelve a probar."
          : e?.message ?? "No pudimos mandar el enlace. Intenta de nuevo."
      );
    } finally {
      setLoading(false);
    }
  }

  function backToLogin() {
    setForgot(false);
    setSentTo("");
    setError("");
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
            <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.tagline}>Tu liga de pádel, siempre en juego.</Text>
            <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.subtitle}>Consulta tu jornada, tu cancha y tu ranking.</Text>

            {forgot ? (
              <View style={styles.form}>
                {sentTo ? (
                  <View style={styles.helpBox}>
                    <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.sentTitle}>Revisa tu correo</Text>
                    <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.helpText}>
                      Si hay una cuenta con {sentTo}, te mandamos un enlace para crear una contraseña nueva. Vence
                      en una hora. Ábrelo, elige tu contraseña y vuelve aquí a entrar.
                    </Text>
                    <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.helpSmall}>
                      ¿No llega? Revisa spam. Si tu club te dio de alta con otro correo, pídele que te reenvíe la
                      invitación.
                    </Text>
                  </View>
                ) : (
                  <>
                    <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.notice}>
                      Escribe tu correo y te mandamos un enlace para crear una contraseña nueva.
                    </Text>
                    <TextInput maxFontSizeMultiplier={MAX_FONT_SCALE}
                      style={styles.input}
                      placeholder="Correo"
                      placeholderTextColor={colors.textMuted}
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="email-address"
                      textContentType="username"
                      value={email}
                      onChangeText={setEmail}
                      onSubmitEditing={onForgot}
                      returnKeyType="send"
                      accessibilityLabel="Correo"
                    />
                    {!!error && <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.error}>{error}</Text>}
                    <Button title="Mandarme el enlace" onPress={onForgot} loading={loading} />
                  </>
                )}
                <Pressable onPress={backToLogin} hitSlop={8} accessibilityRole="button">
                  <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.helpLink}>Volver a iniciar sesión</Text>
                </Pressable>
              </View>
            ) : (
            <View style={styles.form}>
              {expired === "1" && !error && (
                <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.notice}>
                  Tu sesión terminó (cambió tu contraseña o se cerró desde otro lado). Vuelve a entrar.
                </Text>
              )}
              <TextInput maxFontSizeMultiplier={MAX_FONT_SCALE}
                style={styles.input}
                placeholder="Correo"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
              />
              <TextInput maxFontSizeMultiplier={MAX_FONT_SCALE}
                style={styles.input}
                placeholder="Contraseña"
                placeholderTextColor={colors.textMuted}
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />
              {!!error && <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.error}>{error}</Text>}
              <Button title="Entrar" onPress={onLogin} loading={loading} />
              <View style={styles.links}>
                <Pressable
                  onPress={() => {
                    setError("");
                    setHelpOpen(false);
                    setForgot(true);
                  }}
                  hitSlop={8}
                  accessibilityRole="button"
                >
                  <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.helpLink}>¿Olvidaste tu contraseña?</Text>
                </Pressable>
                {/* La cuenta del jugador la crea su CLUB con una invitación por correo. */}
                <Pressable onPress={() => setHelpOpen((v) => !v)} hitSlop={8} accessibilityRole="button">
                  <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.helpLink}>¿Primera vez?</Text>
                </Pressable>
              </View>
              {helpOpen && (
                <View style={styles.helpBox}>
                  <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.helpText}>
                    Tu club te manda una invitación por correo para crear tu contraseña. Si no te llegó, pídele a tu
                    club que te la reenvíe.
                  </Text>
                </View>
              )}
            </View>
            )}
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
  notice: { color: colors.text, fontSize: 14, textAlign: "center" },
  helpLink: { color: colors.textMuted, fontSize: 14, textAlign: "center", textDecorationLine: "underline" },
  helpBox: {
    backgroundColor: alpha(colors.ink900, 0.6),
    borderColor: colors.glassBorder,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  helpText: { color: colors.text, fontSize: 14, lineHeight: 20 },
  helpSmall: { color: colors.textMuted, fontSize: 13, lineHeight: 18, marginTop: spacing.sm },
  sentTitle: { color: colors.text, fontSize: 17, fontWeight: "800", marginBottom: spacing.xs },
  links: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: spacing.xs },
});
