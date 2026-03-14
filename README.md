# Curo (app)

Aplicación Electron + TypeScript + React + Tailwind para gestión de pacientes y consultas.

## Desarrollo

```bash
npm install
npm run dev
```

Abre la ventana de Electron con la UI en modo desarrollo (Vite en `http://localhost:5173`).

## Build

```bash
npm run build
npm start
```

## Estructura

- `src/main/` — proceso principal de Electron (Node).
- `src/preload/` — script preload (puente seguro al main).
- `src/renderer/` — UI en React (Vite + Tailwind).
- `src/schema/` — definición de campos del paciente (fuente única de verdad).

## Versión y release

La versión que muestra la app (Configuración, al final) y la del instalador `.exe` sale de **`package.json`** (`"version"`). Actualmente es `0.1.0`; si quieres que el primer release público sea 1.0.0, cambia ese valor en `package.json` antes de crear el tag.

### Generar instalador en GitHub Actions (producción)

1. **Credenciales**: En el repo de GitHub, en Settings → Secrets and variables → Actions, debe existir el secreto **`BUILD_SECRETS`** con el contenido del archivo `src/main/license/buildSecrets.ts` de producción (no el de desarrollo).
2. **Versión**: Si quieres release 1.0.0, en `package.json` pon `"version": "1.0.0"`. Haz commit y push.
3. **Tag**: Crea un tag que coincida con la versión, por ejemplo `v1.0.0` (o `v0.1.0` si mantienes esa versión):
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```
4. El workflow **Build Windows** se ejecuta al hacer push del tag. Usa `BUILD_SECRETS` para generar el instalador con licencias de producción y adjunta el `.exe` al GitHub Release.
5. Opcional: también puedes ejecutar el workflow a mano en la pestaña Actions → Build Windows → Run workflow (en ese caso no se crea Release; el artefacto queda en la ejecución).
