# Smatch — Guía de publicación (App Store + Google Play)

Checklist preventivo para que el **primer build y submit pasen a la primera**. Lo que ya
quedó configurado en el repo está marcado ✅; lo que **tú** debes hacer (credenciales,
consola de Apple/Google) está marcado ⚠️.

> Antes de CADA build: `npx tsc --noEmit` (app) y `pytest` (backend). Ambos deben pasar.

---

## 0) Estado de publicación HOY (verificado contra las APIs de las tiendas)
- **App Store: PUBLICADA.** Se llama **SmatchApp**, versión pública **1.0.1** (27-jun-2026).
  Ficha: `https://apps.apple.com/mx/app/smatchapp/id6783975528` (Apple ID `6783975528`,
  el mismo `ascAppId` de `eas.json`).
- **Google Play: NO PUBLICADA.** La URL de Play devuelve **404**; la app sigue en pruebas
  internas. **No enlaces a Play todavía** (landing, correos, ficha de Apple): sería un
  enlace roto. Por eso `eas.json` usa `track: internal` — es lo correcto, no lo cambies.
- Versión que vas a subir en este ciclo: **1.0.3** (`app.json` → `expo.version`).
  `buildNumber` / `versionCode` **no** se tocan a mano: `eas.json` usa
  `appVersionSource: "remote"` + `autoIncrement`, EAS los lleva solo.

## 1) SDK de iOS / imagen de build (causa #1 de rechazos)
- ✅ `eas.json` → `build.production.ios.image` = **`macos-tahoe-26.4-xcode-26.4`**.
  - Xcode 26.4 = SDK iOS 26 → evita el rechazo **ITMS-90725**.
  - Esta app es **Expo SDK 56 (RN 0.85.3, React 19.2.3)** — muy por encima de RN 0.81, así
    que no le pega el bug de `fmt` (`consteval ... is not a constant expression`) que
    obligaba a quedarse en Xcode 26.2 cuando la app era SDK 51.
  - ✅ `eas.json` → `build.production.node` = `22.20.0` (fija el toolchain del build).

## 2) Submit no interactivo — App Store Connect API Key
- ⚠️ App Store Connect → **Users and Access → Integrations** → crea una API Key con rol
  **App Manager**. Descarga el `.p8` (¡solo se baja una vez!).
- ⚠️ Guarda el `.p8` **fuera del repo** o en `./credentials/` (ya está en `.gitignore`,
  junto con `*.p8`). Coloca el archivo en la ruta de `eas.json`.
- ✅ `eas.json` → `submit.production.ios` ya tiene **`ascAppId` (`6783975528`) y
  `appleTeamId` (`QXV7M29LA8`)**.
- ⚠️ **Faltan** `ascApiKeyId`, `ascApiKeyIssuerId` y `ascApiKeyPath`
  (`./credentials/AuthKey.p8`): hoy **no están en `eas.json`**. Sin ellos el submit pide
  login interactivo. Agrégalos (o pásalos por flags/env) antes de correr el submit.
- Con esto: `eas submit -p ios --latest --non-interactive` sube sin contraseñas, y el
  `eas build -p ios` puede usar la misma key para credenciales.

## 3) Cumplimiento de exportación
- ✅ `app.json` → `ios.infoPlist.ITSAppUsesNonExemptEncryption = false` (solo HTTPS
  estándar). Evita el prompt de documentación de encriptación en cada envío.

## 4) iPad / screenshots
- ✅ `app.json` → `ios.supportsTablet = false` (solo iPhone). No tendrás que entregar
  capturas de iPad. (Se fijó **antes** del build; cambia el binario.)

## 5) App Store Connect — la app YA existe
- ✅ La ficha ya está creada y publicada como **SmatchApp** (Apple ID `6783975528`). **No**
  crees una app nueva ni un SKU nuevo: este ciclo es una **actualización** a 1.0.3.
- ✅ El **Bundle ID** de iOS es `com.devpackgroup.smatch` (no se puede cambiar). El package
  de Android es el mismo: `com.devpackgroup.smatch`.
- ⚠️ En la ficha, el nombre visible es "SmatchApp" (no "Smatch"): si actualizas textos de
  marketing, respeta ese nombre o cámbialo a conciencia en la ficha.

## 6) Política de privacidad, soporte y borrado de cuenta
- ✅ Páginas públicas y vivas: **https://www.smatchapp.mx/privacidad**,
  **/terminos**, **/soporte** y **/eliminar-cuenta**. Son rutas Next.js reales (no SPA
  estática), así que se sirven directo en Amplify sin depender de reglas 404-rewrite.
- ✅ **Alcanzables DESDE DENTRO de la app**: el tab **Perfil** tiene el grupo "Ayuda y
  legal" con los tres enlaces (privacidad, soporte, eliminar cuenta). Apple lo exige para
  el borrado de cuenta y lo revisa en la 5.1.1.
- ⚠️ Tras desplegar el web, **abre las cuatro URLs** y confirma que cargan (no la home).

## 6-bis) Permisos de iOS (purpose strings) — Guideline 5.1.1
- ✅ `app.json` → `expo-image-picker.photosPermission` nombra **los tres** usos reales de
  la galería: foto de perfil, foto de la bitácora de la jornada y captura al reportar un
  problema. Una purpose string incompleta es motivo de rechazo.
- ✅ `expo-image-picker` con `cameraPermission: false` y `microphonePermission: false`: la
  app **no** usa cámara ni micrófono, y el plugin metía esos permisos (en inglés) al
  Info.plist por default. Android ya los bloquea vía `android.blockedPermissions`.
- ✅ `expo-sensors` con `motionPermission` **en español**: el movimiento sí se usa (sacudir
  el teléfono abre el reporte de un problema).
- ✅ `app.json` → `userInterfaceStyle: "dark"`: la app es enteramente oscura (grafito
  `#0E0F12`); en `light` el selector de fotos y el teclado del sistema salían en claro.

## 7) Cuenta demo para el revisor de Apple
- ✅ Comando idempotente en el backend: **`python manage.py seed_demo`** (córrelo en
  **PRODUCCIÓN**). Crea club + jugador vinculado + jornada publicada y respeta unique
  (get_or_create, teléfono en blanco, dominio centinela `@smatch-demo.app`).
- Credenciales (ponlas en "Datos de inicio de sesión" de la ficha de App Store y en el
  acceso de revisor de Play):
  - **Usuario:** `revisor@smatch-demo.app`
  - **Contraseña:** `SmatchReview!2026`
- ✅ Verificado: el login funciona y el revisor ve su próxima jornada (Liga Demo).
- ⚠️ Confirma que el login funciona **contra prod** (`api.smatchapp.mx`) tras
  correr `seed_demo` ahí.

## 8) Pagos fuera de Apple IAP — preempte el rechazo
- La app móvil del jugador es **de consulta** (no cobra dentro de la app). Las
  suscripciones de los clubes a Smatch son **servicios de software del mundo real (B2B)**
  y se cobran fuera de las tiendas.
- ⚠️ En **App Review Information → Notes** pega:
  > La app es de consulta para jugadores de pádel; no vende bienes digitales ni contiene
  > compras dentro de la app. Las suscripciones de los clubes son un servicio de software
  > B2B cobrado fuera de la app, conforme al **Guideline 3.1.3(e)**. Cuenta demo incluida.

## 9) Android (Google Play) — **la app NO está publicada**
- ⚠️ Verificado hoy: la URL de Play da **404**. Sigue en pruebas internas, así que **no
  hay enlace de Play que puedas usar en ningún lado todavía**.
- ⚠️ **Cuenta nueva → closed testing obligatorio** (12 testers × 14 días) antes de
  producción. **Arráncalo cuanto antes.** Sube primero a `internal` para validar el AAB.
- ⚠️ Play Console → **Setup → API access** → crea/usa un **service account JSON** y
  colócalo en `./credentials/play-service-account.json` (ya en `.gitignore`, por la regla
  `*service-account*.json`).
- ✅ `eas.json` → `submit.production.android.serviceAccountKeyPath` ya apunta ahí, con
  `track: internal`. **Es lo correcto mientras Play no publique**; promueve a
  closed/production después.

## Push — **Expo Push, no Firebase**
- ✅ La app obtiene un **Expo push token** (`ExponentPushToken[...]`) con
  `expo-notifications` y lo registra en `/api/v2/me/devices/` (ver `src/lib/push.ts`).
  **NO** usa `@react-native-firebase` ni `getDevicePushTokenAsync()`.
- ✅ El backend envía por la **API HTTP de Expo Push**
  (`https://exp.host/--/api/v2/push/send`, ver `messaging/services/push.py`), que rutea a
  APNs (iOS) y FCM (Android). No hay `firebase-admin` ni `FIREBASE_CREDENTIALS`.
- ⚠️ Activa con `PUSH_ENABLED=true` en el entorno del backend (con `False` el envío se
  **simula** y no toca la red). Diagnóstico: `python manage.py push_diag`.
- ℹ️ `GoogleService-Info.plist` y `google-services.json` **sí están commiteados** (el
  `.gitignore` lo dice explícitamente: son config de cliente, no secretos). Hoy son
  **residuales**: `app.json` no referencia `ios.googleServicesFile` ni
  `android.googleServicesFile`, y con Expo Push no hacen falta.

---

## Comandos
```bash
# Verificar SIEMPRE antes de buildear
npx tsc --noEmit                         # en smatch_app
(cd ../smatch_back && pytest)            # backend verde

# Login a EAS (una vez)
eas login

# Builds de producción
eas build -p ios --profile production
eas build -p android --profile production

# Submit no interactivo (requiere ascApiKeyId/IssuerId/Path en eas.json — HOY FALTAN)
eas submit -p ios --latest --non-interactive
eas submit -p android --latest --non-interactive   # cae en el track `internal` de Play

# En PRODUCCIÓN del backend, antes de mandar a revisión:
python manage.py seed_demo
```

## URL del backend en el build
`eas.json` fija `EXPO_PUBLIC_API_URL` por perfil (production y preview →
`https://api.smatchapp.mx`; development → `http://localhost:8000`). La app la lee con
prioridad sobre `extra.apiUrl` (`src/lib/api.ts`). Así el build de tienda pega a prod y el
login demo del revisor funciona.

Tres defensas para que un build de tienda **nunca** salga apuntando a localhost:
- `src/lib/api.ts` encadena con `||` (no `??`): una env var **definida pero vacía** no es
  nullish y se colaría, dejando la app pegando a la nada.
- `app.json` → `extra.apiUrl` = `https://api.smatchapp.mx`, y el último recurso del
  encadenamiento también es prod. Ya no hay ningún localhost en `app.json`.
- El único `http://localhost:8000` que queda en el código vive detrás de `__DEV__`, así que
  no existe en un binario de release. Un build de tienda atorado en localhost lo **bloquea
  ATS** en iOS sin error claro, y se ve como "no carga nada" en la revisión de Apple.

Ojo con el orden: la rama `__DEV__` va **antes** de `extra.apiUrl`. `expo start` contra el
backend local no inyecta `EXPO_PUBLIC_API_URL`, y sin esa rama el desarrollo escribiría en
producción. Si en dev necesitas pegarle a prod (o a tu IP de LAN desde un teléfono),
exporta `EXPO_PUBLIC_API_URL` — tiene prioridad sobre todo lo demás.
