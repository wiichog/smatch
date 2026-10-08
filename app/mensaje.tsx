/**
 * Mensaje del club (2026-10). Lo abre el push `club_message`: la notificación corta el
 * texto a un par de líneas y aquí se lee completo. No hay buzón en el servidor; el push
 * trae el texto (hasta 1,500 caracteres) y el correo lleva el mensaje entero.
 */
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { GlassCard } from "@/components/Glass";
import { Screen } from "@/components/Screen";
import { Muted } from "@/components/ui";
import { PARAGRAPH } from "@/lib/notifications";
import { HOME_ROUTE } from "@/lib/routes";
import { colors, fonts, MAX_FONT_SCALE, spacing } from "@/theme";

export default function ClubMessageScreen() {
  const router = useRouter();
  const { title, body, club, truncated } = useLocalSearchParams<{
    title?: string;
    body?: string;
    club?: string;
    truncated?: string;
  }>();

  function close() {
    // Abierta desde un push con la app cerrada no hay nada atrás: va a Inicio.
    if (router.canGoBack()) router.back();
    else router.replace(HOME_ROUTE);
  }

  return (
    <Screen
      title="Mensaje"
      subtitle={club ? `De ${club}` : "De tu club"}
      right={
        <Pressable onPress={close} hitSlop={12} accessibilityLabel="Cerrar">
          <Ionicons name="close" size={26} color={colors.textMuted} />
        </Pressable>
      }
    >
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <GlassCard strong style={styles.card}>
          <View style={styles.kickerRow}>
            <Ionicons name="megaphone" size={16} color={colors.primary} />
            <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.kicker} numberOfLines={1}>
              {club || "Tu club"}
            </Text>
          </View>
          {!!title && (
            <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.title} accessibilityRole="header">
              {title}
            </Text>
          )}
          <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.body} selectable>
            {body
              ? body.split(PARAGRAPH).join("\n")
              : "Tu club te mandó un mensaje. Lo tienes completo en tu correo."}
          </Text>
        </GlassCard>
        {truncated === "1" && (
          <Muted style={styles.note}>El mensaje sigue: te llegó completo por correo.</Muted>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: 120 },
  card: { gap: spacing.md },
  kickerRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  kicker: {
    flex: 1,
    color: colors.primary,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  title: { color: colors.text, fontFamily: fonts.display, fontSize: 22, lineHeight: 28 },
  body: { color: colors.text, fontSize: 16, lineHeight: 24 },
  note: { marginTop: spacing.md, textAlign: "center" },
});
