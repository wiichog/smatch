/**
 * Tokens de Smatch para la app móvil (mismo sistema que web: §7 de la spec).
 * La app va en TEMA OSCURO, igual que la landing y el panel: base grafito,
 * tarjetas "glass", texto claro y lima/turquesa como acentos.
 */
export const colors = {
  primary: "#C2FF1C", // lima eléctrico — la acción / la pelota
  primaryDark: "#A6E000",
  ink900: "#0E0F12", // grafito — base/estructura/fondos oscuros (cajas, avatar)
  ink800: "#1A1C20",
  ink700: "#2A2D33",
  ink500: "#565B63",
  ink400: "#7A7F88",
  ink200: "#D2D4D8",
  ink100: "#E9EAEC",
  highlight: "#00C2A8", // turquesa cancha — highlight puntual
  highlightSoft: "#D6FAF4",
  surface: "#0B0C0E", // fondo de página (oscuro)
  card: "rgba(255,255,255,0.06)", // tarjeta glass sobre el fondo oscuro
  cardBorder: "rgba(255,255,255,0.12)", // borde sutil de tarjetas/inputs
  white: "#FFFFFF",
  text: "#F6F7F8", // texto primario (claro)
  textMuted: "rgba(255,255,255,0.60)", // texto secundario (claro atenuado)
  textInverse: "#F6F7F8",
  danger: "#DC2626",
};

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };
export const radius = { md: 10, lg: 14, xl: 18, full: 999 };

export const font = {
  heading: { fontWeight: "800" as const, letterSpacing: -0.5, color: colors.text },
};
