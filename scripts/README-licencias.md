# Generador de claves de licencia (kit portable)

## ¿Qué necesita el script para vivir?

- **Solo Node.js** (versión 18 o superior). No hace falta `npm install` ni dependencias externas; el script usa únicamente el módulo `crypto` que viene con Node.

## Uso en desarrollo (en el repo)

```bash
node scripts/gen-dev-key.mjs [validity_days] [window_hours]
```

Si no defines `HMAC_SECRET_HEX`, se usa un secreto de prueba. Para que esas claves funcionen en tu build local, tu `buildSecrets.ts` debe usar el mismo secreto de desarrollo (por ejemplo el hex `6465763064657630646576306465763064657630646576306465763064657630`).

## Uso en producción / equipo portable (con el cliente)

En otro equipo (portátil, PC del cliente, etc.) solo necesitas:

1. **Node.js** instalado ([nodejs.org](https://nodejs.org) o `winget install OpenJS.NodeJS` en Windows).
2. **El script** `gen-dev-key.mjs` (copia solo este archivo).
3. **El secreto del cliente** en la variable de entorno `HMAC_SECRET_HEX` (64 caracteres hex). Ese valor te lo da quien configuró el build de ese cliente; no lo subas a git ni lo dejes en archivos compartidos.

### Cómo ejecutar en el equipo portable

**Opción A – Variable en la misma línea (recomendado en portable)**

(Sustituye `SECRETO_HEX_64_CHARS` por el secreto real del cliente.)

```bash
# Windows (CMD)
set HMAC_SECRET_HEX=SECRETO_HEX_64_CHARS
node gen-dev-key.mjs 365 24

# Windows (PowerShell)
$env:HMAC_SECRET_HEX="SECRETO_HEX_64_CHARS"; node gen-dev-key.mjs 365 24

# macOS / Linux
HMAC_SECRET_HEX=SECRETO_HEX_64_CHARS node gen-dev-key.mjs 365 24
```

**Opción B – Archivo local con el secreto (no subir a git)**

Crea un archivo, por ejemplo `secreto-cliente.txt`, con una sola línea: los 64 caracteres hex. Luego:

- **Windows (PowerShell):**  
  `$env:HMAC_SECRET_HEX=(Get-Content secreto-cliente.txt -Raw).Trim(); node gen-dev-key.mjs 365 24`
- **macOS / Linux:**  
  `export HMAC_SECRET_HEX=$(cat secreto-cliente.txt) && node gen-dev-key.mjs 365 24`

### Parámetros

| Argumento         | Por defecto | Descripción |
|-------------------|-------------|-------------|
| `validity_days`   | 365         | Días de validez de la licencia. `0` = permanente. |
| `window_hours`    | 24          | Horas para activar la clave desde su generación (máx. 255). |

Ejemplos:

- `node gen-dev-key.mjs` → 1 año, ventana 24 h  
- `node gen-dev-key.mjs 730 48` → 2 años, activar en 48 h  
- `node gen-dev-key.mjs 0 72` → licencia permanente, ventana 72 h  

La clave se imprime en pantalla; el cliente la ingresa en la app en Configuración → licencia.
