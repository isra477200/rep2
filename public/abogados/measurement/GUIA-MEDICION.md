# RedVitalia · Google Tag Manager y Analytics 4

Contacto: 919 935 237. Edición: 13 septiembre 2026.

## Qué está preparado

La colección HTML incorpora eventos y consentimiento básico: no carga GTM antes de aceptar analítica. `configuration.js` tiene el ID vacío intencionadamente hasta conectar el contenedor real. No hay ID inventado ni una propiedad de Analytics creada por esta entrega.

`RedVitalia-GTM.json` incluye 11 etiquetas, 11 activadores y 2 variables. Las etiquetas HTML usan el snippet oficial gtag de Google. El conjunto está dedicado a esta colección y requiere `measurement.js`; no instalarlo sin ese archivo ni duplicar un Google tag ya instalado.

## Importación

1. En `medicion.html`, escribe el ID GTM real y el ID de medición GA4. Descarga el JSON personalizado. También puedes editar la variable constante **RV · GA4 ID** en GTM después de importar la plantilla.
2. GTM → Administrar → Importar contenedor → Seleccionar JSON → Nuevo espacio de trabajo → **Combinar**. Revisa el resumen antes de confirmar. No sobrescribas el contenedor existente.
3. Descarga `configuration.js` con el botón independiente de la página de medición. Sustituye únicamente `/abogados/configuration.js` en la web y vuelve a publicar. No escribas credenciales de GoHighLevel en ese archivo.
4. En el flujo web de GA4, desactiva la **medición mejorada automática** para esta implementación. Los eventos se envían explícitamente y la vista de página se controla para evitar duplicados. Revisa también que no haya otra instalación de GA4 o GTM en la página.
5. Abre **Vista previa** de GTM con la página comercial y realiza la secuencia de abajo. Comprueba los eventos en Tag Assistant y DebugView. Después publica el contenedor. La importación real y la publicación en tu cuenta necesitan tus identificadores y acceso a esa cuenta; no se han hecho automáticamente.
6. Marca `generate_lead` como evento clave cuando la conexión con GoHighLevel esté comprobada. No marques clic de llamada o WhatsApp como si fuera un cliente contratado.

## Eventos

| dataLayer | GA4 | Qué significa |
| --- | --- | --- |
| rv_page_view | page_view | Una visita con consentimiento |
| rv_contact_widget_open | contact_widget_open | Se abre el widget |
| rv_contact_channel_select | contact_channel_select | Se elige el canal |
| rv_contact_form_start | contact_form_start | Se empieza el formulario |
| rv_generate_lead | generate_lead | GoHighLevel ha aceptado la entrega al webhook; el flujo debe crear o actualizar el contacto |
| rv_contact_whatsapp_click | contact_whatsapp_click | Se abre WhatsApp, no confirma mensaje enviado |
| rv_contact_phone_click | contact_phone_click | Se abre el marcador, no confirma llamada atendida |
| rv_contact_submit_error | contact_submit_error | No hay confirmación de entrega; no suma lead |
| rv_asset_download | asset_download | Se pulsa una descarga, no garantiza archivo descargado |
| rv_diagnostic_complete | diagnostic_complete | Se consulta la orientación inicial |

Parámetros de baja cardinalidad: `page_id`, `page_kind` (commercial/demo/resource), `campaign` (direct/e1_feed/…/e5_story), `contact_channel` (phone/whatsapp/none) y `asset_id`. Si quieres utilizarlos en informes, registra las dimensiones personalizadas de ámbito evento necesarias en GA4.

No se envían nombre, empresa, teléfono, contenido del mensaje, identificador del contacto ni URL completa de WhatsApp. La ubicación de página se construye sin parámetros ni fragmentos; la referencia de página se deja vacía. Las campañas del kit se identifican por una lista acotada de códigos, no se reenvían valores arbitrarios de la URL. El consentimiento publicitario permanece denegado: este contenedor no incluye Meta Pixel ni conversiones de Google Ads.

## Comprobación antes de publicar

- Sesión nueva: antes de aceptar no debe cargarse GTM ni GA4. El widget sí funciona.
- Rechazar: no debe haber medición. Cambiar a aceptar desde el pie: una visita y los eventos siguientes.
- Revocar: los eventos posteriores no se envían. Al recargar debe mantenerse el rechazo.
- Formulario vacío o teléfono inválido: no se hace entrega al CRM ni `generate_lead`.
- Formulario válido y webhook configurado: confirmar contacto en la subcuenta correcta; un evento `generate_lead` por solicitud aceptada en esa página.
- Simular fallo de recepción: mostrar alternativa de contacto, emitir error; nunca mensaje de recepción falsa.
- WhatsApp y llamada: el clic final debe tener el canal correcto. No equipararlo con conversación o venta.
- Descargas y orientación: comprobar su evento y los parámetros permitidos.
- Visitar modelo jurídico: `page_kind=demo`; separarlo de la landing comercial en informes.

## Lectura de resultados

Embudo web: visita → widget → formulario iniciado → solicitud entregada → canal abierto. Embudo comercial en GoHighLevel: solicitud → contacto atendido → consulta válida → cita asistida → cliente contratado. El segundo depende del equipo y no se infiere desde la web.

El consentimiento de analítica dura 183 días en el navegador. No habilita campañas de email o WhatsApp. La empresa debe completar su identidad y política de tratamiento aplicable al CRM antes de captar con publicidad.

## Fuentes oficiales consultadas

- [Importar y exportar contenedores](https://support.google.com/tagmanager/answer/6106997?hl=es)
- [Configuración del consentimiento](https://developers.google.com/tag-platform/security/guides/consent)
- [Evitar información personal en Analytics](https://support.google.com/analytics/answer/6366371?hl=es)
- [Estructura de una versión de contenedor](https://developers.google.com/tag-platform/tag-manager/api/reference/rest/v2/accounts.containers.versions)
