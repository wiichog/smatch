/**
 * A dónde entra la app: la pestaña Inicio.
 *
 * Siempre una pantalla CONCRETA, nunca el grupo `/(tabs)` a secas. El grupo no tiene
 * `index` —la jornada vive en `jornada.tsx` para no chocar con `app/index.tsx` por `/`—,
 * así que `/(tabs)` no resuelve a ninguna pantalla y expo-router pinta «Unmatched Route».
 * Así salió la 1.0.3: al iniciar sesión y en cada arranque con la sesión guardada.
 */
export const HOME_ROUTE = "/(tabs)/dashboard";
