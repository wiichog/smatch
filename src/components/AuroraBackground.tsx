import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, View } from "react-native";

import { alpha, colors } from "@/theme";

/**
 * Fondo de la app: grafito cinematográfico con auroras de marca (glow lima arriba-izq,
 * turquesa arriba-der) fundidas a negro — el "look de la landing" en todas las pantallas,
 * sin costo de blur. El lima aparece sólo como glow tenue (la acción se reserva a los CTAs).
 */
export function AuroraBackground() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Base grafito con leve elevación arriba → profundidad abajo */}
      <LinearGradient
        colors={[colors.ink900, colors.surface, "#070809"]}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />
      {/* Aurora lima (esquina superior izquierda) */}
      <LinearGradient
        colors={[alpha(colors.primary, 0.14), "transparent"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.75, y: 0.5 }}
        style={StyleSheet.absoluteFill}
      />
      {/* Aurora turquesa (esquina superior derecha) */}
      <LinearGradient
        colors={[alpha(colors.highlight, 0.16), "transparent"]}
        start={{ x: 1, y: 0 }}
        end={{ x: 0.25, y: 0.55 }}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}
