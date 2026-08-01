# Generar el APK e instalarlo en Android

Cómo sacar un `.apk` instalable sin publicar en Play Store. No hace falta cuenta de Google
Play: la cuenta de Expo es gratuita y no tiene nada que ver.

## Por qué EAS Build y no una compilación local

Compilar Android en la máquina necesita Android Studio, el SDK y el JDK —varios GB— y deja
las carpetas `android/` generadas en el repo. **EAS Build compila en la nube** y devuelve el
APK para bajar, sin instalar nada más que la CLI.

La alternativa local está [al final](#alternativa-compilar-en-la-máquina), por si algún día
conviene.

## Lo que quedó configurado

| Qué                                               | Valor                                      |
| ------------------------------------------------- | ------------------------------------------ |
| `android.package` en `app/app.json`               | `com.franiiel.simuladormide`               |
| `extra.eas.projectId` / `owner` en `app/app.json` | Los escribe `eas init`, no se tocan a mano |
| `app/eas.json`                                    | Un solo perfil, `preview`, que genera APK  |

El `package` es la identidad de la app en Android: sin él el build falla, y una vez elegido **no
se cambia más** —cambiarlo equivale a publicar una app distinta.

`eas.json` tiene solo `preview` a propósito. `production` (el AAB de Play Store) se agrega si
alguna vez hace falta; hoy sería configuración sin uso.

## Pasos

```bash
npm install -g eas-cli
cd app
eas login                # cuenta de Expo, gratuita
eas init                 # crea el proyecto en expo.dev y lo linkea
eas build --platform android --profile preview
```

EAS empaqueta desde git: **lo que no está commiteado no viaja al build.**

El build tarda unos minutos en la cola. Al terminar, la CLI imprime una URL de descarga y un
QR.

## ⚠️ El error clásico: APK vs AAB

**El perfil `production` genera un AAB, y un AAB no se puede instalar en un celular.** Es el
formato que pide Play Store, nada más.

Para sideload va el perfil `preview`, que usa `distribution: internal`. Está explícito en
`app/eas.json` para no depender del default:

```json
{
  "cli": { "version": ">= 17.0.0", "appVersionSource": "remote" },
  "build": {
    "preview": {
      "distribution": "internal",
      "autoIncrement": true,
      "android": { "buildType": "apk" }
    }
  }
}
```

Si el archivo que baja termina en `.aab`, el perfil está mal.

## Cómo llega al celular

- **Con el QR** que imprime EAS al terminar: se escanea desde el celular, se baja y se
  instala. Android va a pedir habilitar _"instalar apps de origen desconocido"_ para el
  navegador — es normal y se puede revertir después.
- **A mano**: se baja el `.apk` a la PC y se pasa por cable, Drive o Telegram.

> [!WARNING]
> **WhatsApp bloquea el envío de archivos `.apk`.** No es un problema del build.

## Cuidados

### El keystore es irrecuperable

EAS genera una firma digital y la guarda. Todas las actualizaciones futuras de la app tienen
que estar firmadas con **la misma**.

```bash
eas credentials     # permite descargar y respaldar el keystore
```

Si algún día se publica en Play Store, hace falta ese keystore. Perderlo significa no poder
actualizar nunca más esa app: hay que publicar una nueva con otro `package`, y los usuarios
instalados quedan huérfanos. Conviene bajarlo y guardarlo fuera del repo — **nunca commitearlo**.

### El `versionCode` tiene que subir

Android se niega a instalar encima de una versión con `versionCode` igual o menor. Si no
sube, hay que desinstalar la app antes de instalar la nueva, y **eso borra el AsyncStorage**:
se pierde el cache de cuadros tarifarios (se vuelve a bajar solo, pero es una desinstalación
innecesaria).

Ya está resuelto con `autoIncrement: true` en el perfil, más `appVersionSource: "remote"` en
`cli`: el `versionCode` lo lleva EAS en el servidor y sube en cada build. La `version` de
`app.json` (`1.0.0`) es otra cosa —el número que ve el usuario— y no cambia por build.

### El APK es de depuración o de release según el perfil

`preview` genera un build de release (optimizado, sin el menú de desarrollo). No confundir con
el _development build_, que necesita Metro corriendo para funcionar.

## Actualizaciones: qué se actualiza solo y qué no

Esta es la parte que importa entender para este proyecto en particular.

**Las tarifas se actualizan solas.** La app baja `cuadrosEnre.json` de `raw.githubusercontent`
al arrancar, lo valida, lo cachea y cae al embebido si falla. Un APK sideloadeado en marzo
sigue calculando con los precios de agosto sin reinstalar nada. Ver
[`actualizacion-remota.md`](actualizacion-remota.md). Como las tarifas son lo único que cambia
todos los meses, esto ya resuelve el 90 % del problema.

**El código no.** Un cambio de UI, un arreglo del motor o una feature nueva requieren generar
un APK nuevo y volver a pasarlo al celular.

> [!NOTE]
> Existe **EAS Update**, que empuja cambios de JavaScript a las apps ya instaladas sin
> reinstalar. Implicaría sumar `expo-updates`, y la regla del repo es no agregar dependencias
> hasta que una necesidad concreta las pida (ver `AGENTS.md`). Con un solo usuario, pasar el
> APK a mano es más simple. Si algún día hay varios usuarios, ahí sí vale la pena.

## Alternativa: compilar en la máquina

Gratis e ilimitado, pero con setup pesado:

```bash
cd app
npx expo prebuild --platform android
cd android && ./gradlew assembleRelease
```

El APK queda en `android/app/build/outputs/apk/release/`.

Requiere Android Studio, el SDK y el JDK instalados —hoy esta máquina no los tiene: no hay
`adb`, `ANDROID_HOME` está vacío y no hay AVDs. Además `prebuild` genera las carpetas
`android/` e `ios/`, que conviene dejar fuera del control de versiones para no perder la
ventaja del flujo manejado de Expo.

## Checklist antes de compilar

- [x] `android.package` definido en `app/app.json`
- [x] Perfil `preview` con `buildType: "apk"` en `eas.json`
- [ ] `npx tsc --noEmit` limpio
- [ ] `npx tsx domain/casos.ts` pasa
- [ ] Probado en Expo Go antes de gastar un build de la cola
- [ ] Cambios commiteados (EAS sube el árbol de git, no el disco)
- [ ] Keystore respaldado (después del primer build)
