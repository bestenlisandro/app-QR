# Estructura de la Base de Datos (Google Sheets)

La planilla de Google Sheets actúa como base de datos del sistema. Debe tener
**3 pestañas** con estos nombres exactos (respetar mayúsculas y guion bajo):

```
Proyectos
Registro_Tiempos
Dashboard_Resumen
```

No hace falta crearlas a mano: el script `apps-script/Code.gs` incluye la
función `setupHojas()` que las crea (o repara) automáticamente con los
encabezados correctos. Ver `docs/02-GUIA-DESPLIEGUE.md`.

---

## 1. Pestaña `Proyectos`

Uno de los administradores (Daniel) carga acá cada proyecto/orden antes de
que Producción (Maximiliano) genere los QR de la hoja de ruta.

| Columna                 | Tipo   | Descripción                                                        |
|--------------------------|--------|---------------------------------------------------------------------|
| `ID_Proyecto`            | Texto  | Identificador único, ej. `PRJ-104`. Va codificado en los QR.        |
| `Cliente`                | Texto  | Nombre del cliente.                                                  |
| `Tipo_Servicio`          | Texto  | `Interno` (corte y canteado propio) o `Servicio Externo`.           |
| `Estado`                 | Texto  | `Activo`, `Pausado`, `Finalizado` o `Cerrado`.                       |
| `Fecha_Inicio`           | Fecha  | Fecha de alta del proyecto.                                         |
| `Fecha_Entrega_Estimada` | Fecha  | Opcional.                                                            |
| `Observaciones`          | Texto  | Notas libres.                                                       |

Solo los proyectos con `Estado` distinto de `Finalizado`/`Cerrado` aparecen
como "activos" en el generador de QR y en los combos de la app.

---

## 2. Pestaña `Registro_Tiempos`

Es el corazón del sistema: **una fila por cada operación fichada** (inicio →
fin) de cada operario. La escribe exclusivamente el backend (Apps Script),
nunca a mano, para no romper la concurrencia.

| Columna                    | Tipo    | Descripción                                                                 |
|------------------------------|---------|-------------------------------------------------------------------------------|
| `ID_Registro`                | Texto   | UUID único generado al iniciar la tarea.                                     |
| `ID_Proyecto`                | Texto   | FK a `Proyectos.ID_Proyecto`.                                                |
| `Operario`                   | Texto   | `Mariano`, `Emiliano` o `Gonzalo`.                                            |
| `Operacion_ID`               | Texto   | `OP-01` … `OP-07` (ver tabla de operaciones abajo).                          |
| `Operacion`                  | Texto   | Nombre legible de la operación.                                              |
| `Fecha`                      | Texto   | `yyyy-MM-dd`, fecha de inicio.                                              |
| `Hora_Inicio`                | Fecha/Hora | Timestamp exacto de INICIAR.                                              |
| `Hora_Fin`                   | Fecha/Hora | Timestamp exacto de FINALIZAR (vacío mientras está en curso).             |
| `Duracion_Minutos`           | Número  | Minutos netos de trabajo (excluye pausas). Se calcula al finalizar.          |
| `Horas_Hombre`               | Número  | `Duracion_Minutos / 60`.                                                     |
| `Tiempo_Pausado_Minutos`     | Número  | Minutos acumulados en pausa.                                                 |
| `Pausa_Inicio`                | Fecha/Hora | Timestamp del último PAUSAR (vacío si no está pausado).                   |
| `Estado`                     | Texto   | `En Curso`, `Pausado` o `Finalizado`.                                        |
| `Ultima_Actualizacion`       | Fecha/Hora | Timestamp de la última acción sobre la fila.                             |

### Las 7 operaciones (fijas en el sistema)

| ID     | Operación                                   | Recurso típico              |
|--------|-----------------------------------------------|------------------------------|
| OP-01  | Descarga de materiales                        | —                            |
| OP-02  | Orden / Clasificación                         | —                            |
| OP-03  | Corte (Escuadradora)                          | Escuadradora con incisor     |
| OP-04  | Pegado de cantos (Pegadora de PVC)            | Pegadora de cantos           |
| OP-05  | Procesado / Perforado (Perforadora múltiple)  | Perforadora múltiple         |
| OP-06  | Armado (Bancos de armado)                     | Banco de armado 1 / 2        |
| OP-07  | Carga (Logística / Despacho)                  | —                            |

### Control de concurrencia

Antes de crear una fila nueva, el backend verifica que el operario **no**
tenga ya una fila con `Estado = En Curso` o `Pausado`. Si la tiene, rechaza
el inicio y devuelve la tarea activa para que la app la muestre. Así se
garantiza en el servidor (no solo en el frontend) que un operario nunca
tenga dos tareas simultáneas.

---

## 3. Pestaña `Dashboard_Resumen`

Se genera y recalcula automáticamente (menú **Control de Producción → Recalcular
Dashboard**, o al correr `setupHojas()`) con fórmulas `QUERY` sobre
`Registro_Tiempos`. Sirve como respaldo consultable directamente en la
planilla, además del dashboard web en tiempo real (`webapp/dashboard.html`).

Secciones (todas se recalculan solas, no editar a mano):

- **A1: Horas-Hombre por Proyecto**
  ```
  =QUERY(Registro_Tiempos!A2:N,"select B, sum(J) where B <> '' group by B label sum(J) 'Horas Hombre'",0)
  ```
- **D1: Horas-Hombre por Operación** (las 7 operaciones)
  ```
  =QUERY(Registro_Tiempos!A2:N,"select E, sum(J) where E <> '' group by E label sum(J) 'Horas Hombre'",0)
  ```
- **G1: Horas-Hombre por Operario** (Mariano / Emiliano / Gonzalo)
  ```
  =QUERY(Registro_Tiempos!A2:N,"select C, sum(J) where C <> '' group by C label sum(J) 'Horas Hombre'",0)
  ```
- **J1: Desglose Operario × Operación (tabla pivote)**
  ```
  =QUERY(Registro_Tiempos!A2:N,"select C, sum(J) where C <> '' group by C pivot E",0)
  ```

> Estas fórmulas solo suman **tareas finalizadas** (tienen `Horas_Hombre`
> cargado). El dashboard web, en cambio, además muestra en vivo las tareas
> `En Curso` / `Pausado` con su cronómetro corriendo, porque consulta el
> backend cada pocos segundos en lugar de depender del recálculo de fórmulas.

---

## Diagrama de flujo de datos

```
[Operario en tablet]
   → escanea QR (proyecto + operación)
   → INICIAR / PAUSAR / REANUDAR / FINALIZAR
        │  (HTTP GET/POST, JSON)
        ▼
[Google Apps Script - Code.gs (Web App)]
        │  (SpreadsheetApp + LockService)
        ▼
[Google Sheets]
   ├─ Proyectos            (maestro, lo carga Daniel)
   ├─ Registro_Tiempos     (fichadas, escribe el backend)
   └─ Dashboard_Resumen    (fórmulas QUERY, se recalculan solas)
        │
        ▼
[dashboard.html] → poll cada 5-8s → gráficos y tarjetas en tiempo real
```
