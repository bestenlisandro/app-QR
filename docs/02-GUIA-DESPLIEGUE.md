# Guía de instalación

Tiempo: 20–30 minutos. Sin costos: Google Sheets + Apps Script + GitHub Pages.

## FASE 1 — Backend en la planilla

1. Abrí la planilla **Control de Produccion Taller** en Google Drive.
2. Menú **Extensiones → Apps Script**.
3. Si ya hay código en `Code.gs`, borralo entero. Pegá el contenido completo
   de [`apps-script/Code.gs`](../apps-script/Code.gs). Guardá (`Ctrl+S`).
4. Arriba, en la lista de funciones, elegí **`setupHojas`** y tocá
   **Ejecutar**. La primera vez Google pide permisos: *Revisar permisos →
   tu cuenta → Avanzado → Ir a (nombre del proyecto) → Permitir*.
5. Volvé a la planilla y recargala. Tienen que aparecer las pestañas
   `Operaciones`, `Operarios`, `Proyectos`, `Config`, `Registro_Tiempos` y
   `Reporte`, y un menú **Control de Producción**.
6. En la pestaña **Config**, cambiá el **ADMIN_PIN** (el `1234` de fábrica).
7. En **Proyectos**, cargá los trabajos en curso (podés borrar la fila de ejemplo).

## FASE 2 — Publicar el backend

En el editor de Apps Script:

- **Si ya había una implementación** (Implementar → Administrar
  implementaciones muestra una): tocá el lápiz ✏️, en *Versión* elegí
  **Nueva versión** e Implementar. La URL no cambia y `webapp/config.js` ya
  la tiene.
- **Si no había ninguna:** Implementar → **Nueva implementación** → tipo
  **Aplicación web** → *Ejecutar como:* **Yo** · *Quién tiene acceso:*
  **Cualquier usuario** → Implementar. Copiá la URL que termina en `/exec`
  y pegala en `webapp/config.js` (`APPS_SCRIPT_URL`).

> Cada vez que se cambie `Code.gs`, hay que hacer **Nueva versión** en la
> implementación; si no, sigue corriendo la versión anterior.
>
> "Cualquier usuario" significa que quien tenga la URL puede fichar o ver
> los datos. Para uso interno del taller está bien; no la publiques afuera.
> Las correcciones igual piden PIN.

## FASE 3 — Publicar las pantallas (GitHub Pages)

1. En GitHub, repositorio `app-QR` → **Settings → Pages**.
2. *Source:* **Deploy from a branch** · rama **main** · carpeta **/ (root)** → Save.
3. En 1–2 minutos quedan en:
   - PC del taller: `https://bestenlisandro.github.io/app-QR/webapp/estacion.html`
   - Celular del operario: `https://bestenlisandro.github.io/app-QR/webapp/index.html`
   - Dashboard: `https://bestenlisandro.github.io/app-QR/webapp/dashboard.html`
   - Generador de QR: `https://bestenlisandro.github.io/app-QR/webapp/generador-qr.html`

Para que en los celulares quede como app: Chrome → menú ⋮ → **Agregar a
pantalla de inicio**.

## FASE 4 — PC compartida con las 3 pistolas

1. Conectá las 3 bases/receptores de las pistolas a la PC.
2. **Configurá el prefijo de cada pistola** (ver
   [`03-GENERAR-QR-HOJAS-DE-RUTA.md`](./03-GENERAR-QR-HOJAS-DE-RUTA.md)).
3. Abrí `estacion.html` en Chrome y poné pantalla completa (`F11`).
4. Dejá la ventana **siempre al frente y activa**: si alguien hace clic en
   otro programa, las pistolas escriben ahí. La pantalla lo avisa con una
   franja roja "La pantalla no está recibiendo las lecturas".
5. En Windows: Configuración → Sistema → Energía → que la pantalla y la PC
   **no se suspendan nunca** en horario de trabajo.
6. Recomendado: que Chrome abra `estacion.html` al iniciar (Configuración
   de Chrome → Al iniciar → Abrir una página específica).

## FASE 5 — Imprimir QR

Ver [`03-GENERAR-QR-HOJAS-DE-RUTA.md`](./03-GENERAR-QR-HOJAS-DE-RUTA.md).

## FASE 6 — Prueba completa (10 minutos)

1. En la PC, con la estación abierta, la pistola de Mariano lee el QR de
   un proyecto → su tarjeta muestra "Proyecto escaneado … falta la operación".
2. Lee **Corte** → tarjeta verde "Corte · proyecto", el cronómetro corre.
3. Lee **Corte** de nuevo → "terminó Corte (x min)".
4. Lee **Armado** sin escanear proyecto → alerta (tres pitidos) "SIN PROYECTO".
5. Lee **Almuerzo** → se cierra Armado y queda en pausa (tarjeta amarilla).
6. En el dashboard, pestaña **Ahora**: aparecen las tres tarjetas y lo que
   hizo cada uno hoy.
7. Pestaña **Registros y correcciones** → elegí quién sos, poné el PIN →
   tildá "Solo abiertos / a revisar" → **Editar** el Armado y cargale el
   proyecto → Guardar. La marca de revisar desaparece.
8. En la planilla, `Registro_Tiempos` tiene una fila por cada tramo.
9. Repetí con las pistolas de Emiliano y Gonzalo.

## Problemas comunes

| Síntoma | Solución |
|---|---|
| "No reconozco la pistola (prefijo)" | La pistola no tiene prefijo, o el de la pestaña Operarios no coincide. Usá "Probar sin pistola" en la estación para ver qué llega. |
| La lectura sale con letras cambiadas o símbolos raros | Distribución de teclado de la pistola distinta a la de Windows. Guiones y símbolos se ignoran solos; si cambian letras, configurá la pistola en el idioma de teclado de la PC (código del manual: "Keyboard language"). |
| No pasa nada al escanear | La ventana de la estación no está activa (franja roja). Hacé clic en ella. |
| "Acción desconocida: config" | La implementación sigue con el código viejo: hacé **Nueva versión** (Fase 2). |
| "N lecturas sin enviar" | No hay internet en la PC; se mandan solas cuando vuelve. No cerrar el navegador mientras tanto. |
| La cámara del celular no abre | Abrir desde la URL de GitHub Pages (https) y dar permiso de cámara a Chrome. |
| Horas corridas | En Apps Script: ⚙️ Configuración del proyecto → Zona horaria **(GMT-03:00) Buenos Aires**. |
