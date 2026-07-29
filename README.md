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
    _layout.tsx        # tabs: Inicio · Jornada · Ranking · Historial · Perfil
    dashboard.tsx      # inicio: resumen, ligas inscritas, torneos abiertos
    jornada.tsx        # próxima jornada + confirmar disponibilidad (?round_id= la fija)
    ranking.tsx        # ranking por liga + posición (?league_id= resalta una)
    history.tsx        # historial de resultados
    profile.tsx        # perfil + cerrar sesión
  disputes.tsx         # impugnaciones por votar (?dispute_id= resalta una)
src/
  lib/api.ts           # cliente fetch (Token DRF), endpoints /api/v2/me/*
  lib/push.ts          # registro/baja del Expo push token
  lib/notifications.ts # a qué pantalla lleva cada push al tocarlo
  store/auth.ts        # zustand + persist en SecureStore
  hooks.ts             # react-query: useNextRound, useRankings, useHistory...
  components/ui.tsx     # Button, Card, Pill, H1 (StyleSheet)
  theme.ts             # tokens de color/espaciado de Smatch
```

## Endpoints consumidos (api/v2)
`/me/profile/` · `/me/next-round/` · `/me/availability/` · `/me/rankings/` ·
`/me/history/`. Auth: `Authorization: Token <token>`.

## Push notifications (Expo Push, **no** Firebase nativo)
Arquitectura:
1. La app obtiene un **Expo push token** (`ExponentPushToken[...]`) con `expo-notifications`
   (`src/lib/push.ts`, llamado tras el login en `(tabs)/_layout.tsx`) y lo registra en
   `POST /api/v2/me/devices/` (`{ push_token, platform }`).
2. El backend envía a la **API de Expo Push** (`https://exp.host/--/api/v2/push/send`), que
   rutea a **APNs** (iOS) y **FCM** (Android). El backend no habla con APNs ni FCM directo.

> No usamos `@react-native-firebase/*` ni `use_frameworks!` (rompen el build iOS), ni
> `getDevicePushTokenAsync()` (en iOS da el token APNs crudo, que Expo/FCM rechazan).

### Credenciales (EAS / Apple / Expo — no es código)
- **iOS:** una **APNs Auth Key (.p8)** de entorno **Production** debe existir en el portal de
  Apple y estar cargada en Expo. Si Expo apunta a una key inexistente → APNs da
  `InvalidProviderToken` (403). Config/arreglo: `eas credentials` → iOS → production →
  Push Notifications Key. (Apple limita keys por cuenta; una key Production sirve para toda
  la cuenta.) Cambiar la key **no** requiere rebuild.
- **Android:** subí el service account de FCM: `eas credentials` → Android → Google Service
  Account → FCM V1.
- **Backend:** `PUSH_ENABLED=true` (env/Secrets Manager). `EXPO_ACCESS_TOKEN` solo si activás
  Enhanced Security en Expo. Con `PUSH_ENABLED=false` el backend simula (no toca la red).

### Verificación
En un iPhone **real** (no simulador) instalado por TestFlight, logueá un jugador y corré en el
backend: `python manage.py push_diag --user <correo>` (o `--player <id>`). Manda un push y lee
el **receipt** (entrega real). `InvalidProviderToken` → key APNs mala en EAS;
`DeviceNotRegistered` → token vencido (se borra, reabrí la app).

## Build (EAS)
```bash
eas build --platform ios --profile production
```
La imagen está fijada en **Xcode 16.1** (`eas.json`): iOS 18 SDK (lo exige Apple) y estable
para que `expo-device` compile. **No** usar Xcode 26.x con Expo SDK 51.
```
