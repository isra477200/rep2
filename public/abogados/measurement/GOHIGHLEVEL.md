# RedVitalia · Recepción en GoHighLevel

## Destino y conexión

El usuario ha elegido GoHighLevel para recibir nombre, empresa y teléfono de ambas opciones del widget. El endpoint propio es `POST /api/legal-contact`. El secreto `REDVITALIA_GHL_WEBHOOK_URL` se configura en el entorno del servidor Hostinger. **Nunca** en HTML, GitHub público, archivos descargables, parámetros de URL ni Google Tag Manager.

El servidor solo admite un webhook HTTPS del dominio oficial `services.leadconnectorhq.com`, con ruta `/hooks/…`. Devuelve `accepted: true` solo cuando el servicio confirma una respuesta HTTP correcta. Esa respuesta confirma entrada al flujo; la creación del contacto debe comprobarse en GoHighLevel.

## Flujo propuesto en la subcuenta de RedVitalia

1. Crear un workflow con disparador **Inbound Webhook**, nombre «RedVitalia · Solicitudes de abogados». Mantenerlo sin envío de mensajes automáticos.
2. Enviar una muestra controlada sin datos de terceros y mapear los campos. Si el disparador es de pago en el plan contratado, revisar el coste antes de activarlo.
3. Crear o actualizar el contacto por teléfono, en formato internacional. Nombre → `name`; empresa → `companyName`; teléfono → `phone`.
4. Añadir etiquetas `redvitalia-abogados` y `canal-whatsapp` o `canal-phone`. Guardar `source_page`, `campaign`, `contact_channel`, `consent_at`, `consent_version` y `request_id` en campos personalizados o una nota interna.
5. Usar `request_id` para evitar que un reintento cree oportunidades duplicadas; deduplicar contactos por teléfono. El endpoint tiene protección temporal de reintentos, pero no sustituye la deduplicación del CRM entre reinicios.
6. Asignar responsable de atención y crear una tarea interna. Pipeline sugerido: Nueva solicitud → Contacto atendido → Encaje confirmado → Cita prevista → Cita asistida → Propuesta → Cliente / No encaja.
7. Verificar cada rama, activar el flujo y guardar la URL secreta en Hostinger. El despliegue conserva el valor del entorno; la plantilla Docker referencia la variable y no contiene su valor.
8. Probar la web y confirmar la ficha en esa subcuenta antes de considerar la recepción operativa. Una llamada abierta no acredita conversación; actualizar su estado después de atenderla.

## Ejemplo de carga para mapeo (ficticio, no enviar a un destinatario real)

```json
{
  "name": "Prueba de integración",
  "companyName": "RedVitalia · Prueba técnica",
  "phone": "+34919935237",
  "contact_channel": "phone",
  "source": "RedVitalia · Abogados",
  "source_page": "redvitalia",
  "campaign": "e1_feed",
  "tags": ["redvitalia-abogados", "canal-phone"],
  "contact_permission": "Solicitud expresa de atención comercial; no suscripción a campañas",
  "consent_version": "rv-contact-v2",
  "consent_at": "2026-09-13T12:00:00.000Z",
  "request_id": "00000000-0000-4000-8000-000000000001"
}
```

Usar únicamente una prueba identificada y sin automatizaciones de SMS, email o WhatsApp. Esta guía no da autorización para lanzar mensajes a personas ni para activar cargos.

## Si falta conexión o hay un fallo

La web mantiene el formulario y explica que los datos no se han registrado. Ofrece continuar con el contacto directo. En WhatsApp los datos viajan en el mensaje al abrirlo; el visitante decide enviarlo. La llamada solo abre el número de RedVitalia. No se guardan los campos personales en localStorage ni se fabrican confirmaciones de recepción.

El HTML descargado requiere desplegar el endpoint en el mismo origen para guardar en GoHighLevel. Servir solo los archivos estáticos no crea el backend. La versión publicada del portal incorpora el endpoint, pendiente únicamente de un webhook real si todavía no se ha configurado.

## Fuente

[HighLevel: Inbound Webhook](https://help.gohighlevel.com/support/solutions/articles/155000003147-workflow-trigger-inbound-webhook)
