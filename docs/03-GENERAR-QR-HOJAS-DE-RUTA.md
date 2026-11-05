# QR, pistolas y uso diario

## Qué tiene cada QR

| QR | Contenido | Dónde va |
|---|---|---|
| Operación | `OP-CORTE`, `OP-ARMADO`, `OP-ALMUERZO`, `OP-FIN`… | Cartel fijo en cada puesto (escuadradora, pegadora, múltiple, bancos, zona de carga…) y los de Descanso / Almuerzo / Pausa / Fin de jornada en un lugar común, por ejemplo junto al reloj o la salida. |
| Proyecto | `PRY-104` | Hoja de ruta o carpeta que viaja con el trabajo. |

Solo letras, números y un guion: así se leen bien aunque la pistola y la
PC tengan distinto idioma de teclado.

## Imprimir (Maxi)

Abrí `generador-qr.html`:

1. **QR de operaciones** — se hace una sola vez.
   - *Carteles grandes:* uno por hoja A4, para pegar en cada máquina.
   - *Etiquetas:* 6 por hoja, si preferís algo más chico.
2. **QR de proyectos** — cada vez que entra un trabajo: tildalo en la lista
   (sale de la pestaña Proyectos) o escribí el ID → **Generar** → Imprimir.

Recomendaciones: imprimir en blanco y negro, plastificar o cubrir con cinta
transparente los carteles de máquinas con polvo, y no achicar los QR por
debajo de 3 × 3 cm.

## Configurar el prefijo de cada pistola

Las 3 pistolas escriben en la misma PC. Para saber quién leyó, cada pistola
tiene que agregar un **prefijo** antes de lo que lee:

| Operario | Prefijo | La pistola manda |
|---|---|---|
| Mariano | `M1` | `M1OP-CORTE` |
| Emiliano | `E2` | `E2OP-CORTE` |
| Gonzalo | `G3` | `G3OP-CORTE` |

Cómo se configura depende del modelo. En casi todas las pistolas es así:

1. En el manual, buscá la sección **"Prefix" / "Prefijo" / "Add prefix"**
   ("Data editing" o "Edición de datos").
2. Escaneá el código **"Agregar prefijo" / "Set prefix"**.
3. Escaneá los caracteres del prefijo usando la **tabla ASCII** del manual
   (para `M1`: la "M" y el "1").
4. Escaneá **"Guardar" / "Save" / "End"**.
5. Verificá que la pistola mande **Enter** al final (suele venir activado:
   "Add Enter / CR suffix").
6. Probá: con `estacion.html` abierta, leé un QR de operación con esa
   pistola. Tiene que aparecer en la tarjeta del operario que corresponde.

Si un modelo no permite prefijo, se puede usar otro prefijo que sí admita
(por ejemplo, un solo carácter) y cambiarlo en la pestaña **Operarios** de
la planilla. Los prefijos no pueden empezar con `OP` ni con `PRY`.

**Etiquetá cada pistola con el nombre del operario.**

## Uso diario (para explicarle a los operarios)

1. **Empezar una tarea:** QR del **proyecto** → QR de la **operación**. Pitido doble.
2. **Terminar:** QR de la **misma operación**. Si arranca otra tarea, no
   hace falta terminar la anterior: se cierra sola.
3. **Tareas generales** (descarga, acomodamiento o limpieza que no son de un
   trabajo): solo el QR de la operación.
4. **Descanso, almuerzo o pausa:** QR de la pausa. Al volver, proyecto + operación.
5. **Al irse:** QR **Fin de jornada**.
6. **Tres pitidos:** falta el proyecto. Se registró igual, pero conviene
   escanear el proyecto y la operación de nuevo, o avisar a Maxi.
7. **Pitido largo y grave:** la lectura no se entendió. Repetir.
