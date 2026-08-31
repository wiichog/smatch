# Smatch — Guía de publicación (App Store + Google Play)

Checklist preventivo para que el **primer build y submit pasen a la primera**. Lo que ya
quedó configurado en el repo está marcado ✅; lo que **tú** debes hacer (credenciales,
consola de Apple/Google) está marcado ⚠️.

> Antes de CADA build: `npx tsc --noEmit` (app) y `pytest` (backend). Ambos deben pasar.

---

## 1) SDK de iOS / imagen de build (causa #1 de rechazos)
- ✅ `eas.json` → `build.production.ios.image` = **`macos-sequoia-15.6-xcode-26.2`**.
  - Xcode 26.2 = SDK iOS 26 → evita el rechazo **ITMS-90725**.
  - **NO** se usa `latest` (= `macos-tahoe-26.4-xcode-26.4`): el clang de Xcode 26.4 rompe
    la librería `fmt` (`error: consteval ... is not a constant expression`) en React
    Native < 0.81. Esta app es Expo SDK 51 (RN 0.74), así que **26.2 es obligatorio**.
  - Si en el futuro Apple obliga a Xcode 26.4: subir el Expo SDK (a uno con RN ≥ 0.81) o
    compilar el pod `fmt` en C++17. Confirmado contra la doc de EAS (imagen vigente).

## 2) Submit no interactivo — App Store Connect API Key
- ⚠️ App Store Connect → **Users and Access → Integrations** → crea una API Key con rol
  **App Manager**. Descarga el `.p8` (¡solo se baja una vez!).
- ⚠️ Guarda el `.p8` **fuera del repo** o en `./credentials/` (ya está en `.gitignore`,
  junto con `*.p8`). Coloca el archivo en la ruta de `eas.json`.
- ✅ `eas.json` → `submit.production.ios` ya tiene los campos; **reemplaza** los valores:
  - `ascAppId` (Apple ID numérico de la app), `appleTeamId`, `ascApiKeyId`,
    `ascApiKeyIssuerId`, y `ascApiKeyPath` (`./credentials/AuthKey.p8`).
- Con esto: `eas submit -p ios --latest --non-interactive` sube sin contraseñas, y el
  primer `eas build -p ios` puede usar la misma key para credenciales.

## 3) Cumplimiento de exportación
- ✅ `app.json` → `ios.infoPlist.ITSAppUsesNonExemptEncryption = false` (solo HTTPS
  estándar). Evita el prompt de documentación de encriptación en cada envío.

## 4) iPad / screenshots
- ✅ `app.json` → `ios.supportsTablet = false` (solo iPhone). No tendrás que entregar
  capturas de iPad. (Se fijó **antes** del build; cambia el binario.)

## 5) App Store Connect — al crear la app
- ⚠️ **SKU único** (no reutilices uno existente).
- ⚠️ El **Bundle ID** de iOS es `com.devpackgroup.smatch`. Debe coincidir **exactamente**
  con el de tu app iOS en Firebase (`GoogleService-Info.plist`), o push/Crashlytics no
  funcionan. El package de Android es el mismo: `com.devpackgroup.smatch`.
- ⚠️ Si una app vieja ya ocupa el nombre "Smatch", renómbrala para liberarlo.

## 6) Política de privacidad (obligatoria en ambas tiendas)
- ✅ Página pública y viva: **https://www.smatchapp.mx/privacidad**
  (y términos en `/terminos`). Son rutas Next.js reales (no SPA estática), así que se
  sirven directo en Amplify sin depender de reglas 404-rewrite.
- ⚠️ Tras desplegar el web, **abre la URL** y confirma que carga la política (no la home).

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

## 9) Android (Google Play)
- ⚠️ **Cuenta nueva → closed testing obligatorio** (12 testers × 14 días) antes de
  producción. **Arráncalo cuanto antes.** Sube primero a `internal` para validar el AAB.
- ⚠️ Play Console → **Setup → API access** → crea/usa un **service account JSON** y
  colócalo en `./credentials/play-service-account.json` (ya en `.gitignore`).
- ✅ `eas.json` → `submit.production.android.serviceAccountKeyPath` ya apunta ahí
  (`track: internal`; promueve a closed/production después).

## Firebase / push (FCM)
- ⚠️ Crea apps iOS y Android en Firebase con el bundle/package `com.devpackgroup.smatch`.
- ⚠️ Baja `GoogleService-Info.plist` (iOS) y `google-services.json` (Android). Están en
  `.gitignore`; provéelos al build como **EAS file secrets** y referencia
  `ios.googleServicesFile` / `android.googleServicesFile` en `app.json` al activarlo.
- ✅ El backend ya envía push (Firebase Admin) al publicar jornada; activa con
  `PUSH_ENABLED=True` + `FIREBASE_CREDENTIALS` (service account) en Secrets Manager.

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

# Submit no interactivo (tras configurar las credenciales en eas.json)
eas submit -p ios --latest --non-interactive
eas submit -p android --latest --non-interactive

# En PRODUCCIÓN del backend, antes de mandar a revisión:
python manage.py seed_demo
```

## URL del backend en el build
`eas.json` fija `EXPO_PUBLIC_API_URL` por perfil (production → `https://api.smatchapp.mx`).
La app la lee con prioridad sobre `extra.apiUrl`. Así el build de tienda pega a prod y el
login demo del revisor funciona.
