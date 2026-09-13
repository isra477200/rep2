# Medición instalada · Sistema RedVitalia

Destino GA4: G-QRQEMYM8NH, verificado en la etiqueta pública de RedVitalia. La prueba de navegador confirmó carga de gtag y recepción HTTP 204 de page_view en Google Analytics. No se ha accedido a los informes privados de la propiedad.

La web carga GA4 solo después de aceptar analítica. Rechazarla permite enviar formularios a GoHighLevel. La información personal del contacto no se añade a los eventos. Las URL enviadas explícitamente conservan únicamente las atribuciones conocidas de las campañas.

El contenedor RedVitalia-GTM.json contiene 11 etiquetas y 11 activadores, con el ID real de GA4 incorporado. Está preparado para importar. No hay un GTM publicado por esta entrega: la web funciona con GA4 directo mientras gtmId está vacío. Si se configura GTM, la carga directa se desactiva para evitar duplicados.

La conversión generate_lead se emite únicamente tras la confirmación del iframe de GoHighLevel identificado por su origen y ventana. La página de gracias no genera leads al abrirse ni al recargarse. Los clics de llamada y WhatsApp miden intención; las citas y las contrataciones se registran en el CRM.

No se ha instalado un píxel Meta ni una conversión publicitaria de Google Ads sin verificar sus identificadores. La campaña Meta permanece pausada y su optimización inicial es a clics, no a formularios confirmados.
