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

Próximo paso (Fase 1): SQLite, tablas `patients`/`consultations`/`activity_log`, e IPC para CRUD.
