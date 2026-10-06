import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AuroraBackground } from "@/components/AuroraBackground";
import { useBugReport } from "@/components/BugReport";
import { Button } from "@/components/ui";
import { HOME_ROUTE } from "@/lib/routes";
import { useAuth } from "@/store/auth";
import { colors, fonts, spacing } from "@/theme";

/**
 * Ruta que no existe: un enlace viejo, un href mal escrito, un push de una versión más
 * nueva. Sustituye la «Unmatched Route» de expo-router —en inglés y sin salida— por una
 * pantalla de la marca con vuelta al inicio.
 *
 * No redirige sola a propósito: si el href roto fuera el de la propia entrada (como en la
 * 1.0.3), un redirect automático rebotaría aquí en bucle. Con el botón, a lo sumo, el
 * jugador ve esta pantalla y puede reportarla.
 */
export default function NotFound() {
  const router = useRouter();
  const token = useAuth((s) => s.token);
  // `open` trae un no-op por defecto, así que es seguro aunque falte el provider.
  const { open } = useBugReport();
  return (
    <View style={{ flex: 1 }}>
      <AuroraBackground />
      <SafeAreaView style={styles.wrap}>
        <Ionicons name="compass-outline" size={56} color={colors.primary} />
        <Text style={styles.title}>No encontramos esta pantalla</Text>
        <Text style={styles.msg}>
          El enlace que abriste ya no existe o cambió de lugar. Vuelve al inicio para
          seguir.
        </Text>
        <View style={styles.actions}>
          <Button
            title="Ir al inicio"
            onPress={() => router.replace(token ? HOME_ROUTE : "/login")}
          />
          <Button title="Reportar el problema" variant="glass" onPress={open} />
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontFamily: fonts.display,
    letterSpacing: -0.3,
    marginTop: spacing.sm,
    textAlign: "center",
  },
  msg: { color: colors.textMuted, fontSize: 15, textAlign: "center", lineHeight: 21 },
  actions: { alignSelf: "stretch", gap: spacing.sm, marginTop: spacing.lg },
});
