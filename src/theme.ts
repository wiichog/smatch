/** Tokens de Smatch para la app móvil (mismo sistema que web: §7 de la spec). */
export const colors = {
  primary: "#C2FF1C", // lima eléctrico — la acción / la pelota
  primaryDark: "#A6E000",
  ink900: "#0E0F12", // grafito — base/estructura/fondos oscuros
  ink800: "#1A1C20",
  ink700: "#2A2D33",
  ink500: "#565B63",
  ink400: "#7A7F88",
  ink200: "#D2D4D8",
  ink100: "#E9EAEC",
  highlight: "#00C2A8", // turquesa cancha — highlight puntual
  highlightSoft: "#D6FAF4",
  surface: "#F2F4F5",
  white: "#FFFFFF",
  text: "#0E0F12",
  textMuted: "#565B63",
  textInverse: "#F6F7F8",
  danger: "#DC2626",
};

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };
export const radius = { md: 10, lg: 14, xl: 18, full: 999 };

export const font = {
  heading: { fontWeight: "800" as const, letterSpacing: -0.5, color: colors.ink900 },
};
