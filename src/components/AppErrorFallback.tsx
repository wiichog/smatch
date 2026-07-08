import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AuroraBackground } from "@/components/AuroraBackground";
import { useBugReport } from "@/components/BugReport";
import { Button } from "@/components/ui";
import { colors, fonts, spacing } from "@/theme";

/**
 * Fallback global cuando una pantalla lanza un error en render. En vez de matar la app
 * (pantalla blanca o cierre en release, sin log), mostramos una tarjeta de marca con
 * reintento y reporte. Es la ÚLTIMA línea de defensa: ningún dato raro del servidor debe
 * volver a tumbar toda la app — a lo sumo esta pantalla. Se conecta vía el idiom de
 * expo-router: cada layout exporta `ErrorBoundary` y recibe { error, retry }.
 */
export function AppErrorFallback({ error, retry }: { error: Error; retry: () => void }) {
  // `open` trae un no-op por defecto, así que es seguro aunque el fallback se monte
  // fuera del BugReportProvider.
  const { open } = useBugReport();
  return (
    <View style={{ flex: 1 }}>
      <AuroraBackground />
      <SafeAreaView style={styles.wrap}>
        <Ionicons name="alert-circle-outline" size={56} color={colors.primary} />
        <Text style={styles.title}>Algo salió mal</Text>
        <Text style={styles.msg}>
          Se produjo un error al mostrar esta pantalla. Puedes reintentar; si vuelve a
          pasar, repórtalo y lo revisamos.
        </Text>
        {__DEV__ && !!error?.message && (
          <Text style={styles.detail} numberOfLines={4}>
            {error.message}
          </Text>
        )}
        <View style={styles.actions}>
          <Button title="Reintentar" onPress={retry} />
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
  },
  msg: { color: colors.textMuted, fontSize: 15, textAlign: "center", lineHeight: 21 },
  detail: {
    color: colors.textFaint,
    fontSize: 12,
    fontFamily: "monospace",
    textAlign: "center",
    marginTop: spacing.sm,
  },
  actions: { alignSelf: "stretch", gap: spacing.sm, marginTop: spacing.lg },
});
