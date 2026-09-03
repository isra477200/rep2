# Plan de rollback · Ampliación RedVitalia

## Situación actual

La ampliación está en la rama `codex/ampliacion-redvitalia-20260903` y en la PR https://github.com/isra477200/rep2/pull/7. **No se ha desplegado producción.** El rollback actual consiste simplemente en cerrar la PR o eliminar la rama remota cuando ya no se necesite.

## Si la PR se fusiona

1. Detener cualquier despliegue pendiente.
2. Crear una rama desde la producción vigente.
3. Revertir `72e4b2f` (centro de entregables, paquetes descargables y revisión visual), después `9125604` (fichas A–S, campañas profundas, trazabilidad y QA), `4365da2`, `863f358` y finalmente `db9f14f`, siempre mediante commits de reversión.
4. Verificar que desaparecen las nueve rutas de ejecución y que el mercado original sigue operativo.
5. Ejecutar build, lint, comprobación de tipos y pruebas.
6. Revisar `/`, `/nichos`, fichas, galerías, Growth Lab y editor de landings.
7. Desplegar solo después de aprobación humana.

## Datos locales del navegador

La capa nueva guarda borradores, filtros, vistas, métricas, versiones, colas, experimentos, decisiones y notas en almacenamiento local del navegador con el prefijo `rv-execution-v2-`. Revertir código no los elimina automáticamente. No contienen datos enviados a Google Ads, Meta Ads ni otras plataformas porque esta ampliación no realiza escrituras externas. Si se decide limpiar esos datos, debe hacerse como una acción separada y confirmada.

## Activos

Los activos publicados viven bajo `public/assets/ejecucion/`; los PNG fuente trazables están en `source-assets/ejecucion/base/`. Los commits de reversión restauran su ubicación anterior o los retiran según el commit. No tocar los activos históricos del mercado ni las carpetas de capturas de investigación.

## Criterio de éxito

- Producción vuelve al comportamiento anterior.
- Mercado, fichas, galerías y herramientas históricas responden.
- No quedan enlaces a rutas retiradas.
- La compilación y todas las pruebas pasan.
- El cambio queda trazado en Git; no se usa `reset --hard` ni se reescribe historial.
