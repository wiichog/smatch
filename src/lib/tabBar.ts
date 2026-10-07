/**
 * Medidas de la barra de pestañas flotante (`app/(tabs)/_layout.tsx`), en un solo lugar:
 * una pantalla de pestaña que fija algo abajo (el botón de Reservar) tiene que saber
 * dónde termina la barra para no quedar debajo de ella.
 */
export const TAB_BAR_HEIGHT = 66;

/** Distancia del borde inferior de la pantalla a la barra (respeta el safe-area). */
export function tabBarBottom(insetsBottom: number): number {
  return (insetsBottom || 10) + 6;
}
