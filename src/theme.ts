/**
 * Tokens de Smatch para la app móvil (mismo sistema que web: §7 de la spec).
 * La app va en TEMA OSCURO cinematográfico, igual que la landing y el panel:
 * base grafito, superficies "liquid glass" (blur iOS), glows lima/turquesa y el
 * lima reservado para la acción. Tipografía display = Space Grotesk (la de la landing).
 *
 * Las llaves de `colors` se conservan para que ninguna pantalla existente se rompa.
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
  highlight: "#00C2A8", // turquesa cancha — highlight puntual (legible SOLO sobre oscuro)
  highlight700: "#007A6A", // variante oscura: turquesa legible sobre fondo CLARO (pills, chips)
  highlightSoft: "#D6FAF4",
  surface: "#0B0C0E", // fondo de página (oscuro)

  // Vidrio (liquid glass sobre grafito) — alineado a la landing (border-white/10 bg-white/6)
  card: "rgba(255,255,255,0.06)",
  cardBorder: "rgba(255,255,255,0.12)",
  glass: "rgba(255,255,255,0.06)",
  glassStrong: "rgba(255,255,255,0.10)",
  glassBorder: "rgba(255,255,255,0.14)",

  white: "#FFFFFF",
  text: "#F6F7F8", // texto primario (claro)
  textMuted: "rgba(255,255,255,0.60)", // texto secundario (claro atenuado)
  textFaint: "rgba(255,255,255,0.40)", // terciario (overlines, contadores)
  textInverse: "#F6F7F8",
  onPrimary: "#0E0F12", // texto sobre superficies lima sólidas
  danger: "#FF6B6B",
  success: "#34D399",
  warning: "#F5B851",
} as const;

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;
export const radius = { sm: 12, md: 14, lg: 20, xl: 28, full: 999, pill: 999 } as const;

export const font = {
  heading: { fontWeight: "800" as const, letterSpacing: -0.5, color: colors.text },
};

/** Tipografía display (Space Grotesk) — titulares y wordmark, como la landing y el web.
 * El sistema se mantiene para el texto corrido. Cargadas en `app/_layout.tsx`. */
export const fonts = {
  display: "SpaceGrotesk_700Bold",
  displaySemi: "SpaceGrotesk_600SemiBold",
  displayMedium: "SpaceGrotesk_500Medium",
  displayLight: "SpaceGrotesk_300Light",
} as const;

/** Sombra profunda y difusa para elevar superficies de vidrio sobre el grafito. */
export const glassShadow = {
  shadowColor: "#000000",
  shadowOpacity: 0.45,
  shadowRadius: 22,
  shadowOffset: { width: 0, height: 12 },
  elevation: 8,
} as const;

/** `#rrggbb` → `rgba(...)`. Para tintes de marca/vidrio derivados de los tokens
 * (evita repetir literales rgba(...) por las pantallas). */
export function alpha(hex: string, opacity: number): string {
  const r = Number.parseInt(hex.slice(1, 3), 16);
  const g = Number.parseInt(hex.slice(3, 5), 16);
  const b = Number.parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${opacity})`;
}

/** Paleta de avatares: color estable por persona (hash del nombre). Armoniza sobre
 * grafito; el lima se omite a propósito (reservado para la acción). El fondo va tenue
 * y las iniciales al color pleno para contraste. */
const AVATAR_HUES = [
  "#00C2A8", // turquesa cancha
  "#5AA9FF", // azul
  "#B98CFF", // violeta
  "#F5B851", // ámbar
  "#FF8FA3", // rosa
  "#6BE3B8", // menta
] as const;

export function avatarColor(name?: string | null): string {
  if (!name) return AVATAR_HUES[0];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_HUES[h % AVATAR_HUES.length];
}
