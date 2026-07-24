import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { alpha } from "@/theme";

/**
 * Motivo decorativo "cancha de pádel nocturna" (tickets #54–#59).
 *
 * Dibuja la geometría real de una cancha —perímetro, red, líneas de servicio y línea
 * central— bajo la luz fría de los focos, compuesta SÓLO con `View` +
 * `expo-linear-gradient`. Arte 100 % original: sin fotos, sin marcas, sin siluetas de
 * personas y sin dependencias nativas nuevas (la app no tiene `react-native-svg`).
 *
 * Es DECORATIVO, no estructural:
 * - opacidades bajas y `pointerEvents="none"` → nunca compite con el contenido;
 * - las líneas se apagan hacia abajo (se alejan de la luz), así el motivo se disuelve
 *   solo, sin máscaras ni cortes duros;
 * - el azul cobalto vive ÚNICAMENTE aquí. El sistema de la app conserva su acento de
 *   marca (lima sobre grafito, `src/theme.ts`); esto no es un token nuevo.
 *
 * Úsalo con criterio: cabeceras y estados vacíos. NO detrás de listas densas.
 *
 * @example
 * <GlassCard style={{ overflow: "hidden" }}>
 *   <CourtBackdrop />
 *   …contenido…
 * </GlassCard>
 */

/** Paleta local del motivo. NO son tokens de marca: no las uses en la UI. */
const COBALT = "#1A46A8"; // azul cancha
const COBALT_DEEP = "#08132E"; // sombra nocturna
const FLOOD = "#A8CBFF"; // luz fría del foco
const LINE = "#EAF2FF"; // pintura de las líneas

/**
 * Proporciones reales: la cancha mide 20 × 10 m (de ahí el `aspectRatio: 2`) y la
 * línea de servicio está a 6.95 m de la red → 3.05 m del fondo = 15.25 % del largo.
 */
const SERVICE = "15.25%";

export type CourtBackdropProps = {
  /** Fuerza del motivo (0 = invisible, 1 = base, hasta 1.5). Se aplica a TODAS las capas. */
  intensity?: number;
  /** Alto fijo en px. Si se omite, ocupa todo el contenedor. */
  height?: number;
  /** Extras del contenedor (p. ej. `borderRadius` cuando no vive dentro de una tarjeta). */
  style?: StyleProp<ViewStyle>;
};

export function CourtBackdrop({ intensity = 1, height, style }: CourtBackdropProps) {
  const k = Math.max(0, Math.min(1.5, Number.isFinite(intensity) ? intensity : 1));
  const line = (o: number) => alpha(LINE, o * k);

  return (
    <View
      pointerEvents="none"
      style={[styles.root, height != null ? { height } : styles.fill, style]}
    >
      {/* 1 · Noche de cancha: cobalto arriba que se funde con el grafito de la app */}
      <LinearGradient
        colors={[alpha(COBALT, 0.3 * k), alpha(COBALT_DEEP, 0.16 * k), "transparent"]}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* 2 · Haz de los focos cayendo desde arriba */}
      <LinearGradient
        colors={[alpha(FLOOD, 0.14 * k), alpha(FLOOD, 0.03 * k), "transparent"]}
        locations={[0, 0.4, 0.85]}
        style={StyleSheet.absoluteFill}
      />

      {/* 3 · Los dos focos del fondo (glow por círculos concéntricos: sin SVG, sin blur) */}
      <View style={styles.lamps}>
        <Glow size={160} opacity={k} />
        <Glow size={160} opacity={k} />
      </View>

      {/* 4 · Geometría de la cancha — 2:1, sangra por los lados y por abajo */}
      <View style={styles.court}>
        {/* Reflejo del cristal en el muro del fondo */}
        <LinearGradient
          colors={[alpha(FLOOD, 0.1 * k), "transparent"]}
          style={styles.wallSheen}
        />

        {/* Muro del fondo (el más iluminado) */}
        <View style={[styles.hLine, { top: 0, backgroundColor: line(0.26) }]} />
        {/* Muros laterales: se apagan al alejarse de la luz */}
        <FadeLine style={[styles.vLine, { left: 0 }]} from={0.22 * k} />
        <FadeLine style={[styles.vLine, { right: 0 }]} from={0.22 * k} />
        {/* Líneas de servicio (a 6.95 m de la red) */}
        <FadeLine style={[styles.vLine, { left: SERVICE }]} from={0.16 * k} />
        <FadeLine style={[styles.vLine, { right: SERVICE }]} from={0.16 * k} />
        {/* Línea central de servicio: corre de una línea de servicio a la otra */}
        <View
          style={[styles.hLine, { top: "50%", left: SERVICE, right: SERVICE, backgroundColor: line(0.1) }]}
        />
        {/* Muro contrario, apenas insinuado */}
        <View style={[styles.hLine, { bottom: 0, backgroundColor: line(0.06) }]} />

        {/* Red + postes */}
        <View style={styles.net}>
          <LinearGradient colors={[line(0.38), line(0.06)]} style={StyleSheet.absoluteFill} />
        </View>
        <View style={[styles.post, { top: -3, backgroundColor: line(0.32) }]} />
        <View style={[styles.post, { bottom: -3, backgroundColor: line(0.1) }]} />
      </View>
    </View>
  );
}

/** Línea que se desvanece hacia abajo (la luz cae desde el fondo de la cancha). */
function FadeLine({ style, from }: { style: StyleProp<ViewStyle>; from: number }) {
  return (
    <View style={style}>
      <LinearGradient
        colors={[alpha(LINE, from), alpha(LINE, from * 0.12)]}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

/** Halo suave por acumulación de círculos concéntricos (alternativa barata al radial). */
function Glow({ size, opacity }: { size: number; opacity: number }) {
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      {[1, 0.82, 0.66, 0.5, 0.36, 0.22].map((f) => (
        <View
          key={f}
          style={{
            position: "absolute",
            width: size * f,
            height: size * f,
            borderRadius: size,
            backgroundColor: alpha(FLOOD, 0.045 * opacity),
          }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { position: "absolute", top: 0, left: 0, right: 0, overflow: "hidden" },
  fill: { bottom: 0 },
  lamps: {
    position: "absolute",
    top: -56,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-around",
  },
  // Ancho explícito (no left+right) para que Yoga derive el alto del `aspectRatio`.
  court: { position: "absolute", left: "-8%", top: "14%", width: "116%", aspectRatio: 2 },
  wallSheen: { position: "absolute", top: 0, left: 0, right: 0, height: "18%" },
  hLine: { position: "absolute", left: 0, right: 0, height: 1 },
  vLine: { position: "absolute", top: 0, bottom: 0, width: 1 },
  net: { position: "absolute", top: "-2%", bottom: "-2%", left: "50%", width: 2, marginLeft: -1 },
  post: { position: "absolute", left: "50%", marginLeft: -2, width: 4, height: 7, borderRadius: 2 },
});
