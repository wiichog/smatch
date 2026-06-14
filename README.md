# Smatch — App móvil del jugador (Expo + React Native)

App de **consulta** para el jugador de pádel (§6.3 de la especificación): ve su
próxima jornada, confirma disponibilidad, revisa su ranking y su historial. Consume
el **mismo backend** (`api/v2/`), no hay backend aparte.

## Stack
Expo SDK 51 · React Native 0.74 · expo-router (file-based) · TypeScript ·
`@tanstack/react-query` (datos de servidor) · `zustand` + `expo-secure-store` (sesión)
· `@expo/vector-icons`. Mismos tokens de marca que el web (lima/grafito/turquesa).

## Arranque
```bash
npm install
# Apunta la app al backend: edita app.json → expo.extra.apiUrl
#   (emulador Android usa http://10.0.2.2:8000 ; iOS sim usa http://localhost:8000)
npm start            # abre Expo; escanea el QR con Expo Go
npm run typecheck    # tsc --noEmit
```
Necesita un usuario con un `Player` vinculado (`Player.linked_user`). Crea el vínculo
desde el Django admin del backend.

## Estructura
```
app/
  _layout.tsx          # providers (react-query) + Stack
  index.tsx            # redirige según sesión (hidrata SecureStore)
  login.tsx            # login → guarda token (exige Player vinculado)
  (tabs)/
    _layout.tsx        # tabs: Jornada · Ranking · Historial · Perfil
    index.tsx          # próxima jornada + confirmar disponibilidad
    ranking.tsx        # ranking por liga + posición
    history.tsx        # historial de resultados
    profile.tsx        # perfil + cerrar sesión
src/
  lib/api.ts           # cliente fetch (Token DRF), endpoints /api/v2/me/*
  store/auth.ts        # zustand + persist en SecureStore
  hooks.ts             # react-query: useNextRound, useRankings, useHistory...
  components/ui.tsx     # Button, Card, Pill, H1 (StyleSheet)
  theme.ts             # tokens de color/espaciado de Smatch
```

## Endpoints consumidos (api/v2)
`/me/profile/` · `/me/next-round/` · `/me/availability/` · `/me/rankings/` ·
`/me/history/`. Auth: `Authorization: Token <token>`.

## Push notifications (Firebase / FCM)
Implementadas con `expo-notifications` + `expo-device`. Al iniciar sesión la app
obtiene el token NATIVO del dispositivo (`getDevicePushTokenAsync`) y lo registra en
`POST /api/v2/me/devices/` (`provider: "fcm"`). El backend manda el push al publicar
una jornada (Firebase Admin). Para un build real:
- Crear proyecto en Firebase y bajar `google-services.json` (Android) / config iOS.
- En EAS, añadir `android.googleServicesFile` en `app.json` y subir el service account
  al backend (`FIREBASE_CREDENTIALS` en Secrets Manager) con `PUSH_ENABLED=True`.

## Build (EAS) — pendiente de configurar
`eas build` para iOS/Android (íconos/splash con el isotipo).
```
