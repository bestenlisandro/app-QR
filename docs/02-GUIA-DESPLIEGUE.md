# Guía de Despliegue y Pruebas

Tiempo estimado: 20-30 minutos. No requiere tarjeta de crédito ni servicios
pagos: todo corre sobre Google Workspace/Google gratuito + GitHub Pages.

## Requisitos

- Cuenta de Google (Workspace o Gmail normal).
- Un repositorio de GitHub (este mismo) con acceso a **GitHub Pages**.
- Tablets o celulares en planta con cámara y navegador moderno (Chrome/Safari).

---

## FASE 1 — Crear la planilla y el backend (Google Apps Script)

1. Andá a [sheets.google.com](https://sheets.google.com) y creá una planilla
   nueva. Nombrala, por ejemplo, **"Control de Producción — Taller"**.
2. Menú **Extensiones → Apps Script**. Se abre el editor.
3. Borrá el contenido de `Code.gs` que aparece por defecto y pegá el
   contenido completo de [`apps-script/Code.gs`](../apps-script/Code.gs) de
   este repositorio.
4. Guardá el proyecto (ícono de disquete o `Ctrl+S`). Ponele un nombre, ej.
   "Backend Control QR".
5. En la barra de funciones (arriba, al lado del ícono ▶), elegí la función
   `setupHojas` y hacé clic en **Ejecutar**.
   - La primera vez Google va a pedir autorización: **Revisar permisos →
     elegir tu cuenta → Avanzado → Ir a "Backend Control QR" (no seguro) →
     Permitir**. Es tu propio script, es seguro autorizarlo.
6. Volvé a la planilla y refrescá la página. Deberías ver:
   - Un menú nuevo **"Control de Producción"** en la barra de menús.
   - 3 pestañas: `Proyectos`, `Registro_Tiempos`, `Dashboard_Resumen`.
7. Cargá al menos un proyecto real en la pestaña `Proyectos` (columna
   `ID_Proyecto`, `Cliente`, `Tipo_Servicio`, `Estado = Activo`, `Fecha_Inicio`).

### Publicar el backend como Web App

1. En el editor de Apps Script: **Implementar → Nueva implementación**.
2. Tipo: **Aplicación web**.
3. Configuración:
   - **Ejecutar como:** Yo (tu cuenta).
   - **Quién tiene acceso:** *Cualquier usuario* (necesario para que la
     tablet del taller pueda escribir sin iniciar sesión de Google). Si tu
     organización usa Google Workspace y preferís restringirlo, podés elegir
     *Cualquier usuario de \[tu dominio\]* — pero entonces cada tablet deberá
     tener la sesión de Google iniciada.
4. Hacé clic en **Implementar**. Copiá la **URL de la aplicación web**
   (termina en `/exec`).
5. Cada vez que modifiques `Code.gs`, tenés que crear una **nueva versión**
   de la implementación (Implementar → Administrar implementaciones → lápiz
   ✏️ → Nueva versión → Implementar) para que los cambios se reflejen en la
   URL ya publicada.

> 🔒 **Nota de seguridad:** con acceso "Cualquier usuario", cualquiera que
> tenga la URL puede fichar tiempos. Para un taller interno esto suele ser
> aceptable, pero no publiques la URL fuera del equipo. Si necesitás más
> control, se puede agregar una clave simple (`?token=...`) validada en
> `doGet`/`doPost` — pedímelo y lo agrego.

---

## FASE 2 — Configurar el frontend

1. Abrí [`webapp/config.js`](../webapp/config.js) en este repositorio.
2. Reemplazá el valor de `APPS_SCRIPT_URL` por la URL `/exec` que copiaste
   en el paso anterior.
3. Guardá y subí el cambio (commit + push) a la rama del proyecto.

---

## FASE 3 — Publicar el frontend (GitHub Pages)

1. En GitHub, andá a **Settings → Pages** del repositorio.
2. En **Source**, elegí **Deploy from a branch**.
3. Rama: la rama principal del proyecto (o la rama de esta tarea, si todavía
   no se mergeó). Carpeta: **/ (root)**.
4. Guardar. GitHub te va a dar una URL del tipo:
   ```
   https://<tu-usuario>.github.io/<tu-repo>/
   ```
5. La app queda accesible en:
   - App del operario: `.../webapp/index.html`
   - Dashboard en tiempo real: `.../webapp/dashboard.html`
   - Generador de QR: `.../webapp/generador-qr.html`
6. Agregá esas URLs como accesos directos en la pantalla de inicio de las
   tablets/celulares del taller (Chrome → menú ⋮ → "Agregar a pantalla de
   inicio"), así queda como una app.

> GitHub Pages sirve todo por **HTTPS**, requisito indispensable para que el
> navegador permita usar la cámara (`getUserMedia`) en el escáner QR.

---

## FASE 4 — Generar e imprimir los QR (Maximiliano)

1. Abrí `webapp/generador-qr.html`.
2. Elegí el proyecto (se lista automáticamente desde la pestaña `Proyectos`).
3. Hacé clic en **"Generar los 7 códigos QR"**.
4. Imprimí (botón **Imprimir / Guardar PDF**) y pegá cada QR en la sección
   correspondiente de la hoja de ruta física.
5. Ver formato recomendado en
   [`docs/03-GENERAR-QR-HOJAS-DE-RUTA.md`](./03-GENERAR-QR-HOJAS-DE-RUTA.md).

---

## FASE 5 — Prueba end-to-end

1. Abrí `webapp/index.html` en una tablet o celular.
2. Elegí un operario (ej. Mariano).
3. Tocá **"ESCANEAR QR"**, dale permiso de cámara, y escaneá un QR de
   "Corte" del proyecto cargado.
4. Confirmá y tocá **"INICIAR OPERACIÓN"**. El cronómetro debe empezar a
   correr.
5. Probá **PAUSAR** → esperá unos segundos → **REANUDAR** → el cronómetro
   debe seguir sumando desde donde iba (sin contar la pausa).
6. Tocá **FINALIZAR**, confirmá. Debe volver a la pantalla de inicio.
7. Verificá en la planilla, pestaña `Registro_Tiempos`: debe aparecer una
   fila nueva con `Estado = Finalizado`, `Hora_Inicio`, `Hora_Fin`,
   `Duracion_Minutos` y `Horas_Hombre` cargados.
8. Abrí `webapp/dashboard.html` en otra pestaña/pantalla (por ejemplo, un
   monitor en la oficina de Maximiliano) y confirmá que los totales se
   actualizan solos cada pocos segundos, y que al iniciar una tarea nueva
   aparece el cronómetro corriendo en tiempo real en la tarjeta del operario.
9. Probá el control de concurrencia: con el mismo operario, intentá escanear
   e iniciar una segunda tarea sin haber finalizado la primera. La app debe
   avisar "ya tiene una tarea activa" y mostrar directamente el cronómetro
   de la tarea en curso.
10. Recargá la página (`F5`) en medio de una tarea en curso: al reabrir y
    elegir el mismo operario, el cronómetro debe reaparecer solo, tomando el
    tiempo real transcurrido (el estado vive en la planilla, no en el
    celular).

---

## Resolución de problemas comunes

| Síntoma | Causa probable | Solución |
|---|---|---|
| "Falta configurar APPS_SCRIPT_URL" | No se editó `config.js` | Pegar la URL `/exec` real |
| La cámara no abre | Sitio no es HTTPS, o se negó el permiso | Usar la URL de GitHub Pages (HTTPS); revisar permisos del navegador |
| `TypeError: Failed to fetch` | URL de Apps Script mal copiada, o implementación no publicada como "Aplicación web" | Revisar Implementar → Administrar implementaciones |
| El dashboard no actualiza | El backend cambió pero no se creó nueva versión de la implementación | Implementar → Administrar implementaciones → Nueva versión |
| "Ya tiene una tarea activa" inesperado | Un operario quedó con una tarea sin finalizar (ej. se cerró la app) | Buscar la fila en `Registro_Tiempos` con `Estado = En Curso/Pausado` y finalizarla manualmente, o desde la app entrando con ese operario |
| Los tiempos no coinciden con el reloj de pared | Zona horaria del proyecto de Apps Script mal configurada | En el editor de Apps Script: ⚙️ Configuración del proyecto → Zona horaria |
