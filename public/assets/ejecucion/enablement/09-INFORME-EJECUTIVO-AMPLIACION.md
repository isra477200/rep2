# Informe ejecutivo · ampliación operativa de RedVitalia

Fecha: 3 de septiembre de 2026  
Estado: listo para revisión interna; producción no desplegada

## Resultado

RedVitalia dispone ahora de una capa operativa nativa para captar empresas que contraten sus servicios de publicidad y generación de demanda. La ampliación separa de forma visible esta venta B2B de la posterior captación B2C que RedVitalia gestionará para cada cliente.

Se conservó el producto existente, su navegación, el sistema de campañas, las 12 unidades de captación, los 10 sistemas, las landings, la biblioteca creativa, la economía canónica y la exigencia de aprobación humana. La ampliación es aditiva: no se sustituyó la aplicación ni se creó un micrositio paralelo.

## Problema corregido

La entrega anterior aportaba materiales de venta, pero no un circuito diario completo. Faltaban una superficie de trabajo para el equipo, un pipeline utilizable, objetivos y actividad, cadencia multicanal, herramientas de handoff, evaluación del caller y del closer, y un paquete de archivos suficientemente amplio para implantar el proceso fuera de la aplicación.

## Nueva operación comercial

Se añadió la ruta nativa `/operacion-comercial`, integrada en la navegación de ejecución. Contiene seis vistas:

- **Hoy:** objetivos editables, actividad diaria y embudo de conversión.
- **Caller:** guion adaptable por vertical, preguntas, señales, evidencia exigible y disposiciones de llamada.
- **Pipeline:** alta, filtro, avance de etapa, eliminación, persistencia local y exportación CSV.
- **Closer:** scorecard de oportunidad con ocho dimensiones y decisión sobre 16 puntos.
- **Cadencia:** nueve contactos distribuidos en 15 días y combinados por canal.
- **Calidad:** evaluación de llamada y coaching, con criterios observables.

Los registros de demostración están marcados `EJEMPLO - BORRAR`; no se presentan como clientes, resultados ni hechos reales. Las cifras comerciales continúan remitiendo a la fuente canónica de la aplicación y ninguna acción publica campañas automáticamente.

## Entregables

El sistema comercial incluye ocho materiales principales:

1. Presentación comercial para prospectos, 12 diapositivas.
2. Playbook del closer por 12 verticales, 20 diapositivas.
3. Manual de prospección y llamada fría, 12 páginas.
4. Manual del closer, 7 páginas.
5. Academia visual del caller, 18 diapositivas.
6. Secuencias multicanal B2B, 11 páginas.
7. Workbook de diagnóstico y propuesta, 11 páginas.
8. CRM editable con 10 hojas operativas.

Total: 91 páginas o diapositivas, más 10 hojas de CRM, sus versiones editables, PDFs, vistas previas, índice visual, inventario con SHA-256 y paquete ZIP.

## Cobertura del CRM

El libro `08-SISTEMA-COMERCIAL-CRM.xlsx` incluye Inicio, Prospectos, Pipeline, Actividad diaria, Cadencia, Dashboard, Scorecard caller, Scorecard closer, Diccionario CRM y Verticales ICP. Incorpora fórmulas, validaciones, formato condicional y gráficos. La revisión automática de fórmulas no detectó errores.

## Calidad verificada

- Academia: 18 diapositivas renderizadas; prueba de desbordes superada.
- Manuales nuevos: 22 páginas renderizadas e inspeccionadas; sin cortes visuales.
- Accesibilidad de Word: 0 hallazgos altos, medios o bajos tras marcar las cabeceras de tabla.
- CRM: 10 hojas renderizadas e inspeccionadas; 0 errores de fórmula detectados.
- Aplicación: build completo, pruebas generales, análisis estático y 14 pruebas específicas de ejecución quedaron en verde.
- Interfaz: revisión visual en escritorio y móvil de la operación comercial y del centro de entregables; sin errores de consola y sin desbordamiento horizontal de página.

## Riesgos y datos pendientes

- La operación real requiere borrar ejemplos y cargar empresas con una fuente legítima.
- La identidad de marca final, casos verificables, testimonios autorizados y pruebas del cliente siguen pendientes si no se han aportado.
- Telefonía, email, calendario y CRM externo no se conectan por defecto; el sistema funciona de forma local y exporta CSV.
- La publicación de campañas, el uso de audiencias y cualquier promesa o condición comercial requieren revisión humana.

## Rollback

La ampliación está aislada en una rama de trabajo. Puede revertirse retirando la ruta `/operacion-comercial`, su entrada de navegación y los nuevos archivos de enablement, sin alterar las rutas históricas ni los datos canónicos de campañas, precios y landings.

## Decisión necesaria

Para pasar de sistema preparado a operación real, RedVitalia debe nombrar responsable comercial, elegir las primeras 1–2 verticales, validar la lista de prospección, aportar activos de marca y aprobar la puesta en producción. Hasta esa autorización, no se despliega ni se activa ninguna campaña.
