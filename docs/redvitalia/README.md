# Archivo de trabajo RedVitalia

Este directorio conserva los entregables históricos que se generaron durante la ampliación y que no formaban parte del repositorio. La aplicación y sus datos bajo `app/` y `public/` siguen siendo la fuente vigente.

## Fuente vigente dentro de la aplicación

- `/entregables`: centro de materiales, paquetes, documentos y mapa de 40 rutas.
- `/operacion-comercial`: caller, closer, pipeline, cadencia, calidad y herramientas B2B.
- `/sistemas#/routes`: diez sistemas vistos como 40 rutas, cuatro embudos, matriz de encaje y sprints de 30 días.
- `public/assets/ejecucion/enablement`: documentos comerciales y exportables editables.
- `public/assets/ejecucion/packages`: 24 paquetes de campaña B2B/B2C. No se duplican en este archivo.

## Material histórico preservado

- `auditoria-historica/`: informe, rollback y 32 capturas de las revisiones anteriores. Representa el estado observado en esas revisiones, no necesariamente la interfaz actual.
- `entrega-campanas/`: índice autónomo, mapa visual, inventarios y 24 vistas previas del primer lote de paquetes.

## Regla de actualización

Los nuevos datos operativos deben actualizarse primero en la aplicación y regenerarse mediante los scripts del repositorio. Este archivo sirve como trazabilidad y no como segunda fuente editable.
