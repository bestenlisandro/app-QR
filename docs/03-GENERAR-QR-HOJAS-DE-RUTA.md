# Generación e Impresión de Códigos QR para la Hoja de Ruta

Herramienta: `webapp/generador-qr.html`. La usa Maximiliano cuando termina de
diseñar/planificar un proyecto y necesita emitir la hoja de ruta física.

## Qué codifica cada QR

Cada proyecto genera **7 QR, uno por operación**, con este contenido (texto
plano JSON dentro del QR):

```json
{"proyecto_id":"PRJ-104","operacion_id":"OP-03","operacion_nombre":"Corte (Escuadradora)"}
```

El escáner de la app del operario (`webapp/index.html`) lee ese JSON, arma la
pantalla de confirmación y, al tocar "Iniciar Operación", crea el registro en
`Registro_Tiempos`.

## Paso a paso para Maximiliano

1. Asegurate de que el proyecto ya esté cargado por Daniel en la pestaña
   `Proyectos` de la planilla (`Estado = Activo`).
2. Abrí `webapp/generador-qr.html` desde la tablet/PC de Producción.
3. Elegí el proyecto en el combo (o cargá el ID manualmente si todavía no
   está en la planilla).
4. Tocá **"Generar los 7 códigos QR"**. Vas a ver una grilla con las 7
   tarjetas, una por operación, cada una con:
   - El código QR.
   - El nombre de la operación (ej. "OP-03 · Corte (Escuadradora)").
   - El ID de proyecto y cliente.
5. Tocá **"Imprimir / Guardar PDF"**. Se abre el diálogo de impresión del
   navegador.

## Formato físico recomendado

- **Tamaño mínimo del QR impreso: 2,5 × 2,5 cm.** Con el tamaño por defecto
  de la herramienta (200×200 px) alcanza para imprimir en tamaño carta sin
  perder legibilidad a la distancia de una mano.
- **Papel:** usar hoja A4/carta común está bien para pegar en la hoja de
  ruta de cartón/carpeta. Si el ambiente de la escuadradora o la pegadora es
  polvoriento o húmedo, se recomienda:
  - Plastificar cada recorte, o
  - Usar papel adhesivo (etiquetas autoadhesivas) y cubrir con cinta
    transparente ancha.
- **Contraste:** imprimir siempre en blanco y negro puro (no escala de
  grises tenue) para que la cámara de la tablet lo lea rápido con luz de
  planta.
- **Distribución en la hoja de ruta física:** una opción simple que funciona
  bien en taller es recortar las 7 tarjetas y pegar cada una en la sección
  correspondiente de la hoja de ruta de cartón/carpeta viajera del proyecto,
  en el mismo orden del flujo:

  ```
  [1. Descarga] → [2. Orden/Clasif.] → [3. Corte] → [4. Cantos]
       → [5. Perforado] → [6. Armado] → [7. Carga]
  ```

  Así, cada operario que recibe la carpeta escanea únicamente el QR de la
  etapa que le corresponde a él en ese momento.

- **Duplicados:** si dos estaciones pueden trabajar la misma operación en
  paralelo (por ejemplo, corte y pegado de cantos, que puede hacer
  cualquiera de los 3 operarios), no hace falta un QR por estación: el QR
  identifica la *operación*, no la máquina ni el operario — eso se define
  al elegir el operario al principio de la app.

## Proyectos con servicio externo (Opción A)

Para proyectos donde el corte y pegado de cantos se hacen afuera, simplemente
no se imprimen ni se escanean los QR de **OP-03 (Corte)** y **OP-04 (Pegado
de cantos)** — el flujo interno arranca directo en **OP-05 (Procesado /
Perforado)** o donde corresponda. El campo `Tipo_Servicio` de la pestaña
`Proyectos` queda como referencia administrativa.

## Reimpresión / corrección

Si se necesita reimprimir el QR de una sola operación (se rompió, se manchó),
no hace falta regenerar los 7: volvé a generar el proyecto en la herramienta
y recortá solo la tarjeta que falta.
