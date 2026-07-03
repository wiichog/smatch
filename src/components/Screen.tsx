import { useEffect, useRef, type ReactNode } from "react";
import { Animated, Easing, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AuroraBackground } from "./AuroraBackground";
import { colors, fonts, spacing } from "@/theme";

/**
 * Contenedor de pantalla: fondo aurora + safe area (respira del notch/Dynamic Island)
 * + cabecera editorial opcional (overline lima + título display + subtítulo + slot
 * derecho, p. ej. avatar). El contenido entra con fade + rise en el primer montaje.
 */
export function Screen({
  title,
  subtitle,
  right,
  children,
}: {
  title?: string;
  subtitle?: string;
  /** Slot a la derecha del título (avatar del usuario, botón, etc.). */
  right?: ReactNode;
  children: ReactNode;
}) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 340,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
      useNativeDriver: true,
    }).start();
  }, [anim]);

  return (
    <View style={{ flex: 1 }}>
      <AuroraBackground />
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <Animated.View
          style={{
            flex: 1,
            opacity: anim,
            transform: [
              { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) },
            ],
          }}
        >
          {title && (
            <View style={styles.header}>
              <View style={{ flex: 1 }}>
                {/* Overline lima — firma editorial (misma idea que el kicker del panel) */}
                <View style={styles.overline} />
                <Text style={styles.title}>{title}</Text>
                {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
              </View>
              {right}
            </View>
          )}
          {children}
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

const styles = {
  header: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  overline: { width: 28, height: 3, borderRadius: 2, backgroundColor: colors.primary, marginBottom: 10 },
  title: { fontSize: 30, fontFamily: fonts.display, color: colors.text, letterSpacing: -0.5 },
  subtitle: { color: colors.textMuted, marginTop: 4, fontSize: 14 },
};
