# Estructura de la planilla (Google Sheets)

Planilla: **Control de Produccion Taller**. La función `setupHojas()` de
`apps-script/Code.gs` crea todas las pestañas con sus encabezados. Si una
pestaña ya existe con datos, no la pisa.

Todo lo que está en las pestañas **Operarios, Operaciones, Proyectos y
Config** se puede editar directo en la planilla: las pantallas lo leen solas
(la PC del taller recarga la configuración cada 5 minutos).

---

## `Registro_Tiempos` — un renglón por cada tramo de trabajo

| Col | Campo | Descripción |
|---|---|---|
| A | ID | Identificador interno del registro |
| B | Fecha | Día en que empezó |
| C | Operario | Mariano / Emiliano / Gonzalo |
| D | Proyecto | ID del proyecto, `GENERAL` (tarea general) o vacío (pausas) |
| E | Cliente | Se completa solo desde `Proyectos` |
| F | Cod_Operacion | Código (CORTE, ARMADO, ALMUERZO…) |
| G | Operacion | Nombre de la operación |
| H | Tipo | `Productiva` (de un proyecto), `General` o `Pausa` |
| I | Inicio | Fecha y hora de inicio |
| J | Fin | Fecha y hora de fin (vacío mientras está abierta) |
| K | Minutos | Duración en minutos |
| L | Horas | Duración en horas decimales (1,5 = 1 h 30 min) |
| M | Estado | `Abierta`, `Cerrada`, `Cierre automático` o `Corregida` |
| N | Observacion | Marcas a revisar: "Sin proyecto – revisar", "Quedó abierta – revisar hora de fin", "Proyecto no cargado en la lista – revisar" |
| O | Origen | `PC`, `Celular` o `Corrección` |
| P | Editado_por | Quién corrigió y cuándo |

Se puede editar a mano, pero es mejor corregir desde el dashboard
(pestaña **Registros y correcciones**): recalcula minutos y horas y deja
registrado quién corrigió.

## `Proyectos`

| Columna | Descripción |
|---|---|
| ID_Proyecto | Solo letras, números y guiones (ej. `104`, `B-104`). Va en el QR. |
| Cliente | Nombre del cliente |
| Descripcion | Opcional (ej. "Placard dormitorio") |
| Estado | Si dice `Terminado`, deja de aparecer en el generador de QR. Sus horas siguen en los reportes. |
| Fecha_Inicio / Fecha_Entrega | Opcionales |

## `Operarios`

| Columna | Descripción |
|---|---|
| Nombre | Como aparece en pantallas y reportes |
| Prefijo_Pistola | Lo que la pistola de esa persona agrega antes de cada lectura (por defecto `M1`, `E2`, `G3`). Ver docs/03. |
| Activo | `SI` / `NO` |

## `Operaciones`

| Columna | Descripción |
|---|---|
| Codigo | Va en el QR como `OP-<Codigo>`. Si se cambia, hay que reimprimir ese cartel. |
| Nombre | Texto que se ve en pantallas y reportes |
| Tipo | `PROYECTO` (requiere proyecto), `OPCIONAL` (proyecto o GENERAL), `PAUSA`, `FIN` |
| Orden | Orden de las columnas en los reportes |
| Activa | `SI` / `NO` |

## `Config`

| Clave | Por defecto | Descripción |
|---|---|---|
| ADMIN_PIN | 1234 | PIN de correcciones. **Cambiarlo.** |
| HORA_CIERRE | 19 | Hora del cierre automático. Si se cambia, volver a ejecutar `setupHojas()` para reprogramarlo. |
| VENTANA_PROYECTO_MIN | 15 | Minutos que vale el QR de proyecto antes de escanear la operación. |

## `Reporte`

Se cambian las fechas amarillas (B1 desde, B2 hasta) y se recalculan tres
tablas en horas: operario × operación, proyecto × operación y día ×
operario. El dashboard tiene los mismos datos con porcentajes y descarga a
Excel.
