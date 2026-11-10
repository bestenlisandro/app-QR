# Control de Producción por QR — Besten

Mide cuánto tiempo trabaja cada operario en cada operación y en cada proyecto
del taller de amoblamientos de melamina. Cada operario tiene su pistola
lectora (o su celular): escanea el QR del **proyecto**, después el de la
**operación**, y el tiempo empieza a correr. Para terminar escanea de nuevo
la misma operación. Todo queda en Google Sheets y se ve en vivo en un
dashboard desde cualquier celular o PC.

## Qué se mide

- **Operarios:** Mariano, Emiliano, Gonzalo (se editan en la planilla).
- **Operaciones:** Descarga de materiales · Acomodamiento · Corte · Pegado de
  cantos · Procesado con múltiple · Procesado sin múltiple · Ranurado ·
  Armado · Limpieza · Embalaje · Carga.
- **Recursos (capacidad):** Escuadradora (Corte, Ranurado) · Pegadora (Pegado de cantos) · Múltiple (Procesado con múltiple) · Banco 1 y Banco 2 (Armado, Procesado sin múltiple; cada banco con sus carteles QR).
- **Pausas:** Descanso · Almuerzo · Pausa. **Fin de jornada** cierra todo.
- Descarga, Acomodamiento y Limpieza pueden ser de un proyecto o **tareas
  generales** del taller (si no se escaneó proyecto, van a `GENERAL`).

## Pantallas

| Archivo | Para quién | Qué hace |
|---|---|---|
| `webapp/estacion.html` | PC compartida del taller | Recibe las 3 pistolas. Reconoce a cada operario por el **prefijo** de su pistola y muestra qué está haciendo cada uno. Si se corta internet, guarda las lecturas y las manda después. |
| `webapp/index.html` | Celular del operario | Alternativa a la pistola: escanea con la cámara. |
| `webapp/dashboard.html` | Maxi, Daniel, Lisandro | **Ahora** (qué hace cada uno y desde cuándo), **Máquinas** (foto y % de capacidad utilizada de escuadradora, pegadora, múltiple y bancos, cuello de botella, uso día por día y por hora), **Reporte por período** (horas y % por operario, operación, proyecto y día; descarga a Excel) y **Correcciones** con PIN. |
| `webapp/generador-qr.html` | Maxi | Imprime los carteles de operaciones (una vez) y los QR de cada proyecto. |

## Cómo funciona un escaneo

```
Pistola M1 lee "PRY-104"   → Mariano tiene el proyecto 104 "en mano" (vale 15 min)
Pistola M1 lee "OP-CORTE"  → empieza Corte · proyecto 104
Pistola M1 lee "OP-CORTE"  → termina Corte (se guarda la duración)
Pistola M1 lee "OP-ALMUERZO" → si tenía algo abierto, se cierra y empieza Almuerzo
Pistola M1 lee "OP-FIN"    → fin de jornada: cierra lo que esté abierto
```

- Si escanea una operación nueva sin cerrar la anterior, la anterior se
  cierra sola en ese momento.
- Si una operación de proyecto (Corte, Armado, etc.) se escanea sin proyecto,
  **se registra igual** marcada "Sin proyecto – revisar" y la PC hace un
  sonido de alerta. Se completa después desde Correcciones.
- A la hora de cierre (pestaña Config, por defecto 19 h) todo lo que quedó
  abierto se cierra solo y queda marcado para revisar.

## Arquitectura

```
3 pistolas ──USB/base──▶ PC compartida (estacion.html) ─┐
celulares (index.html) ─────────────────────────────────┼─HTTPS─▶ Google Apps Script ─▶ Google Sheets
dashboard (cualquier celular/PC) ◀──────────────────────┘          (apps-script/Code.gs)
```

Sin servidores propios ni costos: el frontend se publica con GitHub Pages y
el backend es un Apps Script vinculado a la planilla.

## Estructura

```
apps-script/Code.gs              backend (lógica de escaneo, reportes, correcciones)
webapp/config.js                 URL del backend (lo único que hay que tocar en código)
webapp/api.js                    conexión, cola sin internet, sonidos, formatos
webapp/estacion.html             PC con las pistolas
webapp/index.html                celular del operario
webapp/dashboard.html            dashboard + reporte + correcciones
webapp/generador-qr.html         impresión de QR
docs/01-ESTRUCTURA-GOOGLE-SHEETS.md
docs/02-GUIA-DESPLIEGUE.md       instalación paso a paso
docs/03-GENERAR-QR-HOJAS-DE-RUTA.md  QR, pistolas y uso diario
```

## Puesta en marcha

Seguir **`docs/02-GUIA-DESPLIEGUE.md`** (20–30 minutos).
