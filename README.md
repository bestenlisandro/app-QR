# Control de Producción por QR — Fábrica de Muebles de Melamina

Aplicación web (mobile/tablet-first) para medir en tiempo real las
Horas-Hombre de cada operario en las 7 operaciones del taller, mediante
escaneo de códigos QR en la hoja de ruta. Sin servidores propios: el backend
es Google Apps Script y la base de datos es Google Sheets.

## Equipo y roles

| Persona | Rol |
|---|---|
| Daniel | Ventas / Administración — crea proyectos y órdenes |
| Lisandro | Compras — insumos y materiales |
| Maximiliano | Producción — planos, hojas de ruta y generación de QR |
| Mariano, Emiliano, Gonzalo | Operarios de planta — fichan tiempos con la app |

## Las 7 operaciones medidas

1. Descarga de materiales
2. Orden / Clasificación
3. Corte (Escuadradora)
4. Pegado de cantos (Pegadora de PVC)
5. Procesado / Perforado (Perforadora múltiple)
6. Armado (Bancos de armado)
7. Carga (Logística / Despacho)

## Arquitectura

```
┌─────────────────────┐     HTTPS (GET/POST JSON)     ┌──────────────────────┐
│  Web App (frontend)  │ ─────────────────────────────▶ │  Google Apps Script  │
│  webapp/*.html        │ ◀───────────────────────────── │  apps-script/Code.gs │
│  (GitHub Pages)       │                                 │  (Web App)           │
└─────────────────────┘                                 └──────────┬───────────┘
     │  html5-qrcode (cámara)                                        │
     │  polling cada 6s (dashboard)                                  ▼
     ▼                                                     ┌──────────────────┐
  Tablets/celulares                                        │   Google Sheets    │
  en planta                                                │  Proyectos          │
                                                             │  Registro_Tiempos  │
                                                             │  Dashboard_Resumen │
                                                             └──────────────────┘
```

## Estructura del repositorio

```
app-QR/
├── README.md                                  ← este archivo
├── docs/
│   ├── 01-ESTRUCTURA-GOOGLE-SHEETS.md          ← esquema de datos y fórmulas
│   ├── 02-GUIA-DESPLIEGUE.md                   ← paso a paso de instalación
│   └── 03-GENERAR-QR-HOJAS-DE-RUTA.md          ← formato de impresión de QR
├── apps-script/
│   └── Code.gs                                 ← backend (Apps Script)
└── webapp/
    ├── config.js                               ← ⚠️ acá va la URL del backend
    ├── api.js                                  ← cliente HTTP compartido
    ├── styles.css                               ← tema industrial alto contraste
    ├── index.html                              ← app del operario (escáner + cronómetro)
    ├── dashboard.html                          ← dashboard del taller en tiempo real
    └── generador-qr.html                       ← generador/impresión de QR (Maximiliano)
```

## Funcionalidades

- **App del operario:** selección táctil (Mariano / Emiliano / Gonzalo),
  escaneo de QR con la cámara, botonera grande INICIAR / PAUSAR / FINALIZAR,
  cronómetro en vivo, y control de concurrencia (no se puede iniciar una
  tarea nueva sin cerrar la anterior — validado en el servidor, no solo en
  el celular).
- **Persistencia de sesión:** si se recarga la página o se cierra la app a
  mitad de una tarea, al volver a elegir el mismo operario se restaura el
  cronómetro exacto (el estado real vive en la planilla).
- **Dashboard en tiempo real** (`dashboard.html`): KPIs generales del
  taller, estado y cronómetro en vivo de cada operario, horas-hombre por
  operación, por operario y por proyecto — todo actualizándose solo cada
  pocos segundos.
- **Generador de QR** (`generador-qr.html`): genera e imprime los 7 QR de
  un proyecto para pegar en la hoja de ruta física.
- **Google Sheets como base de datos:** editable directamente por Daniel
  (proyectos) sin necesitar programación; `Dashboard_Resumen` trae fórmulas
  `QUERY` listas para auditar o exportar.

## Puesta en marcha rápida

1. Leer y seguir **`docs/01-ESTRUCTURA-GOOGLE-SHEETS.md`** para entender el
   modelo de datos.
2. Seguir **`docs/02-GUIA-DESPLIEGUE.md`** paso a paso: crear la planilla,
   publicar el backend, configurar `webapp/config.js` y publicar el
   frontend (GitHub Pages).
3. Usar **`docs/03-GENERAR-QR-HOJAS-DE-RUTA.md`** para imprimir los QR de
   cada proyecto.

## Notas de diseño

- El frontend es HTML/CSS/JS puro (sin build ni frameworks) para que
  cualquiera pueda editarlo directo en GitHub y publicarlo con GitHub Pages,
  sin instalar Node ni nada localmente.
- El "tiempo real" del dashboard es *polling* (consultas periódicas cada 6
  segundos), no WebSockets — es la única opción compatible con Google Apps
  Script como backend, y es más que suficiente para el ritmo de un taller.
- Las 7 operaciones y los 3 operarios están definidos como configuración
  (`webapp/config.js` en el frontend, y constantes al inicio de
  `apps-script/Code.gs` en el backend). Si el equipo de planta cambia, se
  edita en esos dos lugares.
