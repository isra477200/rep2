export type LegalProfile = { id: string; name: string; priority: string; target: string; problem: string; angle: string; qualification: string[]; consumerTitle: string; consumerIntro: string; keywords: string[]; exclusions: string[] };
export const profiles: LegalProfile[] = [
  { id: 'segunda-oportunidad', name: 'Segunda Oportunidad', priority: 'Entrada recomendada', target: 'Despachos con práctica acreditada en insolvencia de particulares y autónomos, atención comercial y capacidad para abrir nuevos expedientes.', problem: 'Pagan por consultas que no encajan o no llegan a atender; cuesta saber qué captación termina en expediente.', angle: 'Filtro inicial, respuesta y trazabilidad hasta expediente aceptado.', qualification: ['Provincia y modalidad de atención.', 'Particular o autónomo y motivo general de la consulta.', 'Situación general, urgencia y si existe asesoramiento previo, solo en conversación privada.', 'Encaje jurídico y documentación: los valora un abogado, no un formulario automático.'], consumerTitle: 'Valora tus opciones de Segunda Oportunidad con un abogado', consumerIntro: 'Explica de forma general qué necesitas. El despacho revisará si puede atender tu consulta y te indicará el siguiente paso. La viabilidad depende del caso y de su valoración jurídica.', keywords: ['abogado segunda oportunidad [zona]', 'despacho segunda oportunidad [zona]', 'consulta abogado insolvencia particular'], exclusions: ['No usar cancelación total, resultado garantizado o plazos judiciales cerrados.', 'No pedir extractos bancarios, DNI ni documentos de deudas en la landing.', 'No decidir elegibilidad a partir de una cifra de deuda.'] },
  { id: 'herencias', name: 'Herencias', priority: 'Segunda línea', target: 'Despachos de sucesiones que concretan territorio, asuntos que aceptan y capacidad de atender a herederos.', problem: 'Se mezclan dudas informativas, trámites puntuales y asuntos complejos; se presupuestan sin saber qué servicio necesita la persona.', angle: 'Clasificar la necesidad y preparar una consulta útil desde el principio.', qualification: ['Provincia relacionada con el asunto y servicio solicitado.', 'Aceptación, partición, orientación general u otra necesidad.', 'Existencia de un plazo conocido, sin interpretar su cómputo desde marketing.', 'Situación con otros herederos solo de forma general; detalles y documentos por canal del despacho.'], consumerTitle: 'Consulta los siguientes pasos de tu herencia', consumerIntro: 'Un abogado del despacho puede ayudarte a entender qué gestiones requiere tu situación. Indica el motivo general y cómo prefieres que te contacten para valorar el servicio.', keywords: ['abogado herencias [zona]', 'abogado sucesiones [zona]', 'asesoramiento herencia [zona]'], exclusions: ['No utilizar urgencia por fallecimiento para presionar.', 'No prometer ahorro fiscal ni reparto favorable.', 'No tratar los plazos como iguales para todas las situaciones.'] },
  { id: 'divorcios', name: 'Divorcios', priority: 'Después de estabilizar la entrada', target: 'Despachos de familia con atención reservada, criterios claros y capacidad de explicar modalidades y honorarios.', problem: 'Llegan consultas muy distintas con expectativas de precio y servicio que no se aclaran antes de la cita.', angle: 'Primera conversación discreta, encaje por servicio y claridad sobre el siguiente paso.', qualification: ['Provincia y modalidad de consulta.', 'Necesidad general: información, acuerdo o procedimiento en curso.', 'Disponibilidad y canal seguro para contactar, sin detallar conflictos personales.', 'Las circunstancias familiares y la estrategia se tratan directamente con el abogado.'], consumerTitle: 'Asesoramiento para dar el siguiente paso en tu divorcio', consumerIntro: 'Habla con el despacho sobre las opciones de tu situación. La primera toma de contacto sirve para conocer tu necesidad y explicar cómo puede ayudarte el equipo.', keywords: ['abogado divorcio [zona]', 'abogado familia [zona]', 'abogado divorcio mutuo acuerdo [zona]'], exclusions: ['No prometer custodias, acuerdos o sentencias favorables.', 'No usar mensajes que incentiven el conflicto.', 'No solicitar relatos íntimos ni información de menores en publicidad.'] },
];

export type Chapter = { id: string; label: string; title: string; intro: string; actions: string[]; done: string };
export const chapters: Chapter[] = [
  { id: 'estrategia', label: '01 · Elegir y ofrecer', title: 'Una especialidad, una zona, una oferta comprensible', intro: 'El cliente de RedVitalia es el despacho. El primer producto es un piloto medible de captación, con una especialidad por campaña. España es el mercado de partida; elige una ciudad o provincia antes de prospectar.', actions: ['Empieza con Segunda Oportunidad solo si el despacho puede acreditar esa práctica. Cambia a herencias o divorcios cuando el encaje real sea mejor.', 'Piloto recomendado: 30 días de campaña activa, con preparación previa y decisión posterior de continuar. Es una propuesta de alcance, no una condición contractual ya aprobada.', 'Oferta de entrada: Sistema RedVitalia desde 400 €/mes + IVA. Con una base de 400 €, el IVA es 84 € y la factura 484 €. Publicidad aparte. Alcance, módulos, licencias y puesta en marcha se concretan en la propuesta; no se presume que todos los módulos estén incluidos en la cuota de entrada.', 'Resultado que se gestiona: consultas con encaje, atención y seguimiento. Entregables que sí controlamos: campaña, medición acordada, revisión semanal y registro de descartes.', 'Propuesta de valor: ayudar a identificar dónde se pierden las consultas y construir un camino hasta el asunto aceptado. La hipótesis comercial debe validarse con el piloto.'], done: 'Elegida la especialidad y zona; anotados servicio, capacidad, coste y alcance de la oferta.' },
  { id: 'prospectos', label: '02 · Encontrar despachos', title: 'Una lista corta con motivos reales para llamar', intro: 'Construye una primera cohorte de 30 despachos. Es una carga de trabajo propuesta, no una previsión de ventas. Dedica 5–8 minutos a comprobar cada uno y prioriza los 10 con mejor encaje.', actions: ['Busca en Google y Maps: «abogado {{especialidad}} {{zona}}», «despacho {{especialidad}} {{zona}}». Completa con directorios profesionales públicos para comprobar identidad, y con webs de los despachos para teléfono y actividad.', 'Registra URL y fecha, especialidad visible, zona, teléfono profesional, responsable si es público, canal, observación verificable y siguiente acción. No inventes ingresos, presupuesto o tamaño por apariencia de la web.', 'Puntúa 0–2 cada criterio: especialidad acreditable, claridad de servicio, señal de captación activa, oportunidad concreta de mejora y accesibilidad del responsable. 8–10: llamar primero; 5–7: investigar; 0–4: aparcar. Desconocido vale 0 hasta confirmarlo.', 'Señales útiles: anuncios activos observados, landing por especialidad, formulario con demasiados campos, falta de siguiente paso claro o CTA poco visible en móvil. Una web bonita o un anuncio activo no prueban rentabilidad.', 'Antes de llamadas comerciales, documenta base de legitimación, origen profesional y pertinencia del servicio. Comprueba oposición y sistemas de exclusión aplicables. Si no está resuelto, empieza por solicitudes entrantes, referencias autorizadas o contactos que hayan pedido información.', 'Detén el contacto si rechazan, piden baja o no hay encaje. Mantén una lista mínima de exclusión para evitar repetir llamadas. Un email público no autoriza una secuencia comercial.'], done: '30 fichas revisadas, 10 priorizadas y origen/legitimación del contacto documentados.' },
  { id: 'diagnostico', label: '03 · Preparar el diagnóstico', title: 'Lleva una observación, una pregunta y una mejora', intro: 'La oferta de entrada es un diagnóstico breve de captación. Debe existir antes de afirmar que has revisado la web. No envíes un PDF genérico con el nombre cambiado.', actions: ['Abre la landing desde móvil y escritorio. Anota URL, fecha y captura de la pantalla donde se ve el problema. No envíes formularios reales fingiendo ser un posible cliente.', 'Revisa seis elementos: promesa específica, especialidad/zona, credenciales comprobables, llamada a la acción, fricción del formulario y explicación del paso posterior.', 'Prepara tres observaciones como máximo: hecho visible, posible consecuencia a validar y cambio propuesto. «No vi un plazo de respuesta» es verificable; «perdéis el 40 % de los clientes» no lo es.', 'Compara con dos páginas del archivo para explicar mecanismos, sin copiar sus promesas. Enseña una maqueta o recorrido de ejemplo etiquetado como demostración si falta acceso a datos reales.', 'Termina con una sola decisión: dedicar 20 minutos a conocer cómo se atienden hoy las consultas. Separa lo observado de lo que solo el despacho puede confirmar.'], done: 'Mini diagnóstico de una página con pruebas visibles y pregunta específica.' },
  { id: 'llamadas', label: '04 · Llamar y cualificar', title: 'Conseguir una conversación útil con quien decide', intro: 'Objetivo de la primera llamada: confirmar encaje y acordar el siguiente paso. Usa el guion como conversación; escucha y recoge las palabras exactas del despacho.', actions: ['Identifícate, di que es una propuesta comercial y ofrece oposición al inicio. Si hay interés, pide permiso para una pregunta breve.', 'Pregunta por especialidad, capacidad y atención. No intentes cerrar el servicio sin hablar con quien decide y conocer los números.', 'Si responde recepción, pide la función responsable, no datos personales innecesarios. Si no es momento, ofrece una devolución acordada.', 'Para enviar información, confirma dirección, contenido solicitado y si acepta un seguimiento. Registra fecha y alcance; no metas al contacto automáticamente en una newsletter.', 'Rutina propuesta: bloque diario de 60–90 minutos con hasta 10 fichas preparadas, registro inmediato y una próxima acción. Ajusta el volumen a la calidad y las restricciones de contacto.'], done: 'Llamada registrada con encaje, oposición o permiso, responsable y siguiente acción.' },
  { id: 'seguimiento', label: '05 · Correo y seguimiento', title: 'Continuar solo la conversación que han aceptado', intro: 'El correo de interesados resume lo hablado y permite responder con facilidad. Todos los envíos de esta biblioteca son manuales; el apartado no manda mensajes.', actions: ['Día 0: envía lo pedido en la llamada y el diagnóstico si realmente está preparado. Una sola llamada a la acción.', 'Día 2–3: si aceptaron seguimiento y no contestaron, pregunta si tiene sentido revisar el diagnóstico. No añadas más archivos sin necesidad.', 'Día 6–7: aporta una idea concreta ligada a su web. Usa la variante de cierre si no hay interés o no se acordaron más contactos.', 'Día 10: cierra el seguimiento si seguía autorizado y no hay respuesta. Después, archiva. Si fijaron otra fecha, respétala en vez de esta cadencia.', 'WhatsApp solo cuando lo han elegido para esta conversación. Los recordatorios de cita se limitan a la cita solicitada. Ante oposición, cancela toda la secuencia.'], done: 'Información solicitada enviada y próxima fecha acordada, o seguimiento cerrado.' },
  { id: 'reunion', label: '06 · Reunión y objeciones', title: 'Vender a partir de capacidad, proceso y números', intro: 'Reunión de diagnóstico de 20 minutos: 2 para contexto, 8 para entender el proceso, 5 para la propuesta y 5 para una decisión. Los números desconocidos se apuntan como pendientes.', actions: ['Invita al socio o responsable con capacidad de decisión; suma a quien atiende llamadas si su intervención es necesaria.', 'Recorre el último mes: consultas, válidas, contactadas, citas, asistencias, asuntos aceptados y honorarios efectivamente cobrados. Trabaja con agregados, sin expedientes ni nombres de clientes.', 'Pregunta cuánto trabajo nuevo pueden asumir y qué plazo real de respuesta pueden sostener. Marca un objetivo operativo de respuesta en horario atendido; fuera de horario, confirmación con expectativa realista.', 'Muestra un único cuello de botella. Si falta medición, el primer entregable es medir; si no hay capacidad de atención, no tiene sentido aumentar inversión todavía.', 'Cierra con una de tres salidas: propuesta con fecha de decisión, tarea concreta para resolver una duda, o no encaja. Evita reuniones sin dueño ni fecha.'], done: 'Decisor, capacidad, cuello de botella y próximo acuerdo identificados.' },
  { id: 'propuesta', label: '07 · Proponer y cerrar', title: 'Un piloto con límites y responsabilidades por escrito', intro: 'La propuesta debe permitir decidir cuánto se invierte, qué se entrega y cómo se revisa. Usa la calculadora para ensayar escenarios del despacho; no son predicciones.', actions: ['Presenta el Sistema RedVitalia desde 400 € netos al mes y su IVA, inversión en medios aparte y presupuesto separado para alta/landing/CRM. Si ya tienen infraestructura válida, documenta qué se aprovecha.', 'Define consulta válida por especialidad, zona, contacto utilizable y solicitud real; deduplica dentro del periodo acordado. Una consulta válida puede no acabar en cliente.', 'Distingue consulta válida, cita agendada, cita asistida y asunto aceptado con encargo confirmado. El despacho decide el encaje jurídico y conserva su independencia.', 'Incluye alcance, revisiones, calendario tras accesos, propiedad de cuentas, salida, entrega de activos y costes de terceros. No cierres permanencia, gratuidad o exclusividad si no están expresamente pactadas.', 'La exclusividad de un contacto captado para el despacho no equivale a exclusividad territorial. Esta última requiere territorio, especialidad, duración y capacidad acordados.', 'Antes de cobrar o activar inversión, obtén aceptación del alcance y presupuesto final por quien tiene facultad. El resumen comercial sirve de base; no sustituye al contrato de servicios.'], done: 'Alcance, honorarios, medios, condiciones y aceptación registrados.' },
  { id: 'landing', label: '08 · Landing de RedVitalia', title: 'La página que convence al socio del despacho', intro: 'Esta landing vende RedVitalia a despachos. El formulario pide datos profesionales mínimos y una conversación de diagnóstico. Los bloques siguientes son el texto íntegro para construirla.', actions: ['Orden recomendado: propuesta clara → problema reconocible → recorrido de trabajo → entregables → a quién encaja → método y prueba → precio → preguntas → formulario.', 'Usa un solo CTA: «Solicitar diagnóstico de captación». En móvil, mantenlo accesible sin tapar contenido. Confirma recepción y el siguiente paso después del envío.', 'Prueba que puedes enseñar hoy: muestra de diagnóstico, recorrido de demo, criterios de consulta válida y ejemplo de informe marcado como ejemplo. Añade casos reales solo con datos comprobables y permiso.', 'Evita logotipos de clientes no autorizados, contadores de plazas sin capacidad real, testimonios inventados y promesas de facturación.', 'La colección HTML ya incluye la landing de RedVitalia con WhatsApp y tres modelos de especialidad. Abre «Explorar las landings». Completa la identidad legal y la medición antes de campañas; los modelos de despachos mantienen la captación desactivada hasta asignar cliente.'], done: 'Texto de la landing adaptado, pruebas reales y recorrido del formulario definidos.' },
  { id: 'creativos', label: '09 · Anuncios y contenido', title: 'Dos ángulos para probar sin dispersar presupuesto', intro: 'Creativos B2B originales generados para RedVitalia: seguimiento de consultas y medición hasta asunto aceptado. Las imágenes son ilustrativas, no fotografías del equipo ni de clientes.', actions: ['Primero valida la oferta en conversaciones. Después plantea una prueba pagada con un presupuesto propio de captación de RedVitalia, separado del dinero que los despachos invierten para captar sus clientes.', 'Prueba A: continuidad de atención. Prueba B: visibilidad del proceso. Usa la misma oferta y landing para saber qué cambia; evita modificar creatividad, precio y público a la vez.', 'Mide formulario profesional válido, reunión asistida y despacho contratado. El CTR solo ayuda a diagnosticar el anuncio.', 'Para Google B2B, usa intención de contratar marketing para abogados; excluye búsquedas de abogados para particulares. Para campañas del despacho, usa las búsquedas de su especialidad y una cuenta separada.', 'Antes de anunciar, revisa las políticas vigentes de la plataforma para audiencia, datos y anuncios jurídicos. Los públicos, presupuesto, destino y seguimiento están por configurar; no hay campañas activadas desde este módulo.'], done: 'Ángulo, audiencia profesional, landing, presupuesto propio y medición elegidos.' },
  { id: 'entrega', label: '10 · Arranque del servicio', title: 'Lo que pasa después del sí', intro: 'La buena venta prepara la entrega. Pide accesos por invitación, reúne las aprobaciones del despacho y ensaya el recorrido de una consulta antes de invertir.', actions: ['Día de aceptación: contrato y alcance, persona responsable, facturación, agenda y permisos. Invita a cuentas de Google Ads, analítica y web con roles mínimos; nunca pidas contraseñas en correo.', 'Preparación: landing por especialidad, campañas separadas, CRM y agenda acordados, horarios, mensajes, política de datos y responsable de revisión jurídica.', 'Define quién atiende, quién sustituye, cuándo se escala una consulta y qué se registra. El formulario de marketing recoge mínimos; el despacho recibe documentación jurídica por sus canales.', 'Prueba con datos ficticios identificados: formulario → recepción → aviso → responsable → cita → recordatorio → estado final. Excluye estas pruebas de métricas y conversiones.', 'Antes de publicar, el abogado revisa texto, identidad profesional y afirmaciones jurídicas; verifica medición y consentimiento aplicable. Ningún evento publicitario debe contener relato del asunto o datos sensibles.', 'Primera semana activa: revisión de búsquedas y calidad. Semana 2: llamada de seguimiento y citas. Semana 3: asuntos aceptados y razones de descarte. Semana 4: decisión según costes, calidad y capacidad, no solo número de contactos.'], done: 'Accesos, revisiones, atención y prueba del recorrido completados.' },
  { id: 'cliente-final', label: '11 · Embudo del despacho', title: 'Los textos para atender a sus futuros clientes', intro: 'Este bloque es para el cliente del despacho, no para vender RedVitalia. Cambia con la especialidad seleccionada. El equipo jurídico valida y completa identidad, condiciones y privacidad antes de usarlo.', actions: ['Anuncio de intención → landing del servicio → solicitud mínima → llamada de encaje → consulta reservada → asistencia → asunto aceptado o motivo de descarte.', 'Formulario mínimo: nombre, teléfono o correo, provincia, motivo general y preferencia de contacto. Explica responsable, finalidad y acceso a información de privacidad en la implementación.', 'Reserva la documentación y el detalle del caso para un canal seguro del despacho. No los uses en píxeles, herramientas de anuncios, diagnósticos públicos o este panel.', 'Aclarar si la primera toma de contacto y la consulta jurídica tienen coste, duración y condiciones antes de reservar. No llamar gratuita a una consulta si no está acordado.', 'La persona de atención organiza; el abogado asesora y decide viabilidad. Evita respuestas automáticas que prometan un resultado jurídico.'], done: 'Textos del despacho revisados, condiciones de consulta definidas y circuito de atención probado.' },
  { id: 'control', label: '12 · Plan, CRM y métricas', title: 'Saber qué hacer mañana y qué corregir después', intro: 'El plan de 30 días es una agenda de ejecución, no una garantía de contratación. El control B2B de RedVitalia y el embudo B2C del despacho tienen métricas diferentes.', actions: ['Días 1–2: elige zona/especialidad, concreta oferta y prepara tres mini diagnósticos. Días 3–5: termina 30 fichas y prioriza 10.', 'Días 6–10: contactos pertinentes, registro de respuestas y envío solicitado. Revisa qué frase abre conversación y cuál confunde; cambia una variable cada vez.', 'Días 11–15: reuniones con decisores y propuestas con fecha. Si no hay reuniones, corrige selección y mensaje antes de comprar más tráfico.', 'Días 16–20: seguimiento acordado, resolución de dudas y aceptación de alcances. Si hay interés pero no firma, revisa riesgo percibido, presupuesto y persona que decide.', 'Días 21–30: arranca los pilotos aceptados. Si todavía no hay ventas, revisa datos y conversaciones; no presentes el calendario como resultado cumplido.', 'CRM de RedVitalia: investigado → contacto permitido → conversación → interesado → diagnóstico reservado → asistió → propuesta → ganado/perdido. Cada fila tiene responsable, siguiente acción y fecha; oposición es un bloqueo.', 'Cada viernes: revisa tasas con sus denominadores, esfuerzo comercial total y margen de la gestión. Mantén un único cuello de botella prioritario por semana.'], done: 'Agenda de la semana y tablero con próximos pasos actualizados.' },
];

export type Script = { id: string; chapter: string; title: string; kind: string; when: string; text: string };
const s = (id: string, chapter: string, title: string, kind: string, when: string, text: string): Script => ({ id, chapter, title, kind, when, text });
export const scripts: Script[] = [
 s('oferta-breve','estrategia','La oferta en 30 segundos','Presentación','Para explicar qué comprará el despacho.',`En RedVitalia ayudamos a los despachos a organizar su captación por especialidad. Para {{despacho}} proponemos empezar por {{especialidad}} en {{zona}}: atraer consultas, acordar un filtro inicial y seguir el recorrido hasta la cita y el asunto aceptado.

Empezamos con un diagnóstico y, si hay encaje, definimos un piloto medible. El Sistema RedVitalia parte de 400 € netos al mes más IVA. La publicidad se paga aparte a las plataformas. Concretamos módulos, preparación y herramientas en la propuesta según lo que ya tenga el despacho.

El primer paso es revisar juntos qué ocurre hoy con las consultas y qué capacidad tenéis para atender nuevas.`),
 s('microdiagnostico','diagnostico','Mini diagnóstico que entregar','Documento','Completa solo con observaciones que hayas comprobado.',`DIAGNÓSTICO DE CAPTACIÓN · {{despacho}}
Especialidad: {{especialidad}} · Zona: {{zona}}
Preparado por {{asesor}}, RedVitalia · Fecha: [fecha de revisión]
Web revisada: [URL exacta]

1. Lo que vemos
{{observacion}}
Evidencia: [captura y ubicación en la página].

2. Lo que necesitamos confirmar
¿Quién recibe una consulta nueva, cuánto tarda en responder y cómo sabéis si termina en un asunto aceptado?

3. Primera mejora propuesta
Conectar la solicitud de {{especialidad}} con un responsable, un filtro acordado y un siguiente paso visible. Antes de cambiar campañas, revisaríamos la recepción y el registro del estado de cada consulta.

4. Cómo lo comprobaríamos
Medir consultas válidas, contacto efectivo, citas, asistencia y asuntos aceptados, con sus costes. No podemos estimar el impacto sin conocer los datos del despacho.

5. Decisión siguiente
Una conversación de 20 minutos para confirmar capacidad, objetivo y alcance. Si vemos que el problema está en otro punto, lo diremos en esa reunión.`),
 s('video-diagnostico','diagnostico','Guion de vídeo de 90 segundos','Vídeo','Graba la pantalla real revisada. No muestres datos de clientes.',`Hola, {{nombre}}. Soy {{asesor}}, de RedVitalia. Te enseño una observación de la página de {{despacho}} para {{especialidad}}.

[0–20 s · Mostrar la URL y el bloque exacto]
Aquí se ve lo siguiente: {{observacion}}

[20–50 s · Mostrar un recorrido de ejemplo]
La pregunta que esto me plantea es qué ocurre después de que una persona solicita información. Prepararía un paso siguiente claro y un registro que permita ver si se ha contactado, reservado una cita y aceptado el asunto. Este recorrido es una demostración, no son resultados de vuestro despacho.

[50–75 s]
Antes de recomendar inversión, comprobaríamos con vosotros cómo se atienden las consultas, qué asuntos encajan y cuánta capacidad hay.

[75–90 s]
Si quieres, lo revisamos en 20 minutos. Puedes responder al correo y acordamos una hora. Gracias por verlo.`),
 s('llamada-recepcion','llamadas','Recepción o centralita','Llamada','Contacto profesional con legitimación comprobada.',`Buenos días. Soy {{asesor}}, de RedVitalia. Es una llamada comercial sobre la captación del despacho; si preferís no recibir estas llamadas, lo dejo anotado y no insistimos.

¿Quién se encarga de decidir sobre captación y atención de nuevas consultas de {{especialidad}}?

[Si pregunta el motivo]
Queremos proponer una revisión breve del recorrido entre la consulta y la cita: cómo se filtra y quién la atiende. Necesitaría hablar con la persona responsable para ver si tiene sentido.

[Si no está]
¿Hay algún momento adecuado para volver a llamar por este mismo teléfono?

[Si ofrecen un correo]
Gracias. ¿La persona responsable ha solicitado que le enviemos esta información, o es mejor que hablemos primero con ella? Lo registramos y seguimos el canal que nos indique.

[Si dicen que no]
Entendido, gracias. Dejo indicado que no contactemos de nuevo por esta propuesta. Buen día.`),
 s('llamada-decisor','llamadas','Primera llamada al socio · 2 minutos','Llamada','Objetivo: encaje y permiso para el siguiente paso.',`Hola, ¿hablo con {{nombre}}? Soy {{asesor}}, de RedVitalia. Te llamo por una propuesta comercial para la captación de {{despacho}}. Si prefieres que no volvamos a contactar, me lo dices y lo registramos.

¿Te viene bien que te lo explique en medio minuto?

[Si acepta]
Trabajamos el recorrido de las consultas por especialidad: qué entra, cómo se filtra, quién responde y qué termina en asunto aceptado. Para {{especialidad}}, suele ser útil revisar ese recorrido antes de aumentar la inversión.

¿Ahora queréis asumir más asuntos de este tipo, o estáis completos?

[Si tienen capacidad]
¿Quién suele atender una consulta nueva y cómo sabéis si acaba en una cita o en un asunto?

[Escuchar y resumir con sus palabras]
Entonces, lo que os interesa mejorar es [necesidad que acaba de expresar]. ¿Te encajaría una revisión de 20 minutos con la persona que decide esto para ver si un piloto tiene sentido?

[Si prefiere información]
Claro. ¿Me confirmas el correo al que quieres que te envíe el resumen de esta propuesta? ¿Te parece que lo comentemos una vez dentro de unos días, o prefieres responder tú cuando lo revises?`),
 s('apertura-revisada','llamadas','Apertura cuando ya has revisado su web','Llamada','Sustituye el bloque central; no afirmes auditoría si no existe.',`He revisado la página de {{despacho}} y he visto algo concreto: {{observacion}}

No sé todavía cómo afecta a las consultas, porque eso requiere vuestros datos. La pregunta es: cuando alguien pide información sobre {{especialidad}}, ¿qué recorrido sigue hasta hablar con el abogado?

Si te parece útil, te envío una página con lo observado y el primer cambio que probaríamos. ¿Quieres recibirla y acordamos después si merece una reunión?`),
 s('sin-tiempo','llamadas','«No tengo tiempo»','Respuesta','Respeta el momento, ofrece una opción y termina.',`Entiendo. ¿Prefieres que acordemos una llamada breve en otro momento o que dejemos aquí el contacto?

[Si acuerda otro momento]
Perfecto, te llamo el [día] a las [hora] por este número. Gracias.

[Si no quiere continuar]
De acuerdo. Lo dejo registrado. Buen día.`),
 s('cualificacion','llamadas','Las seis preguntas de encaje','Guía','Distribúyelas en la conversación; no lo conviertas en interrogatorio.',`1. ¿Qué asuntos de {{especialidad}} os interesa asumir y cuáles preferís descartar?
2. ¿En qué zona atendéis y ofrecéis consulta a distancia?
3. ¿Cuántos asuntos nuevos podríais incorporar al mes sin comprometer la atención?
4. ¿Quién responde a una consulta y qué plazo podéis sostener en horario de trabajo?
5. ¿Tenéis registrada la relación entre consultas, citas y asuntos aceptados?
6. Si el diagnóstico encaja, ¿quién decide la inversión y qué rango tenéis previsto para gestión, preparación y medios?

Resumen antes de terminar: «He entendido que buscáis [objetivo], podéis atender [capacidad] y el punto a mejorar es [problema]. ¿Es correcto?»

Siguiente paso: diagnóstico si hay encaje; pedir un dato pendiente si falta información; cerrar con respeto si no se necesita el servicio.`),
 s('email-interesado','seguimiento','Correo después de mostrar interés','Correo','Envíalo cuando hayan solicitado esta información.',`Asunto: {{despacho}} · propuesta para la captación de {{especialidad}}

Hola, {{nombre}}:

Gracias por la conversación. Como me has pedido, te resumo la propuesta de RedVitalia para {{despacho}}.

Empezaríamos por {{especialidad}} en {{zona}}, revisando tres puntos: qué consultas encajan, cómo se atienden y cuáles terminan en una cita y un asunto aceptado. Con eso definiríamos un piloto y los datos que necesita el despacho para decidir si continuar.

El Sistema RedVitalia parte de 400 € netos al mes + 84 € de IVA (484 €). La inversión publicitaria se paga aparte a las plataformas y se acuerda según el servicio y la zona. Con una cuota neta de 400 €, la factura es de 484 € con IVA. El alcance de landing, CRM, automatizaciones y cualquier puesta en marcha queda detallado en la propuesta.

¿Te parece que lo revisemos en una conversación de 20 minutos? Dime qué horario te viene bien y lo acordamos.

Un saludo,
{{asesor}} · RedVitalia
{{contacto}}

Te envío la información que has solicitado. Si prefieres que cerremos el seguimiento, responde a este correo y lo dejamos registrado.`),
 s('email-diagnostico','seguimiento','Entrega del diagnóstico preparado','Correo','Adjunta el diagnóstico real o incluye un enlace revisado.',`Asunto: El diagnóstico de {{despacho}} que me pediste

Hola, {{nombre}}:

Te envío el diagnóstico que acordamos: {{enlaceDiagnostico}}

La observación principal es esta: {{observacion}}

Hemos separado lo que se ve en la página de lo que necesitamos confirmar con vosotros. El primer punto que revisaríamos es cómo pasa una solicitud de {{especialidad}} a una conversación atendida y una cita.

Si te encaja, lo vemos en 20 minutos y decidimos si merece preparar un piloto. ¿Qué horario te viene bien?

{{asesor}} · RedVitalia
{{contacto}}

Si prefieres no continuar con esta propuesta, responde a este correo y cerramos el seguimiento.`),
 s('email-seguimiento1','seguimiento','Día 2–3 · una pregunta fácil','Correo','Solo dentro del seguimiento que aceptaron.',`Asunto: ¿Revisamos la captación de {{despacho}}?

Hola, {{nombre}}:

Retomo una vez la información que me pediste sobre {{especialidad}}. Para saber si tiene sentido avanzar, me basta con confirmar algo: ¿tenéis capacidad para atender nuevos asuntos de esta especialidad en este momento?

Si la respuesta es sí, podemos revisar el recorrido de las consultas. Si no es prioridad, lo dejamos aquí.

Gracias,
{{asesor}} · RedVitalia
{{contacto}}

Puedes responder a este correo si no quieres más seguimiento.`),
 s('email-seguimiento2','seguimiento','Día 6–7 · aportar una idea','Correo','Úsalo si existe la observación y sigue permitido el seguimiento.',`Asunto: Una mejora concreta para las consultas de {{especialidad}}

Hola, {{nombre}}:

Hay una idea del diagnóstico que puede ser útil aunque ahora no iniciemos un piloto: que cada consulta tenga un responsable y un siguiente paso registrado desde el primer contacto.

En la página revisada observamos: {{observacion}}

En la reunión comprobaríamos si ese punto también aparece en vuestro proceso real. Así decidiríamos qué merece cambiar antes de aumentar el presupuesto.

¿Quieres que lo comentemos o prefieres que cerremos esta propuesta por ahora?

{{asesor}} · RedVitalia
{{contacto}}

Responde a este correo para cerrar el seguimiento cuando quieras.`),
 s('email-cierre','seguimiento','Día 10 · cerrar sin presionar','Correo','Último mensaje del seguimiento aceptado, si no hubo oposición.',`Asunto: Cierro el seguimiento de {{despacho}}

Hola, {{nombre}}:

Cierro por ahora el seguimiento de la propuesta de captación para {{especialidad}}, para no seguir interrumpiéndote.

Si más adelante queréis revisar cómo pasan las consultas a citas y asuntos aceptados, puedes responder a este correo y lo retomamos desde ahí.

Gracias por tu tiempo,
{{asesor}} · RedVitalia
{{contacto}}`),
 s('whatsapp-interesado','seguimiento','WhatsApp solicitado','WhatsApp','Solo si han elegido WhatsApp para esta conversación.',`Hola, {{nombre}}. Soy {{asesor}}, de RedVitalia. Te escribo por aquí como hemos acordado. La propuesta es revisar la captación de {{especialidad}} de {{despacho}} y definir un piloto si encaja con vuestra capacidad. ¿Qué momento te viene bien para una conversación de 20 minutos? Si prefieres no seguir, dímelo y lo dejamos registrado.`),
 s('confirmacion-reunion','seguimiento','Confirmación de la reunión','Correo','Después de acordar fecha y hora reales.',`Asunto: Confirmado · diagnóstico de {{despacho}} · {{cita}}

Hola, {{nombre}}:

Confirmamos nuestra reunión de 20 minutos para {{cita}}.
Acceso: {{enlaceReunion}}

Revisaremos la captación de {{especialidad}}, la atención de consultas y si encaja un piloto. Si puedes, ten a mano cifras aproximadas del último mes: consultas, citas y asuntos aceptados. No necesitamos datos personales ni documentación de vuestros clientes.

Conviene que participe quien decide la inversión y, si es posible, quien organiza la atención.

Si necesitas cambiarla, responde a este correo.
{{asesor}} · RedVitalia
{{contacto}}`),
 s('recordatorio-reunion','seguimiento','Recordatorio acordado','WhatsApp','Canal elegido, una vez antes de la cita.',`Hola, {{nombre}}. Te recuerdo nuestra revisión de captación de {{despacho}} para {{cita}}. Duración: 20 minutos. Enlace: {{enlaceReunion}}. Si necesitas cambiar la hora, dímelo y buscamos otra. {{asesor}}, RedVitalia.`),
 s('no-show','seguimiento','Si no se presenta','Correo','Una propuesta de reprogramación; no culpar ni perseguir.',`Asunto: ¿Reprogramamos la revisión de {{despacho}}?

Hola, {{nombre}}:

No hemos podido coincidir en la reunión. Si sigue siendo útil revisar la captación de {{especialidad}}, dime qué momento te viene mejor y buscamos otra hora.

Si ha dejado de ser prioridad, no hace falta reprogramar; puedes responder y cierro el seguimiento.

{{asesor}} · RedVitalia
{{contacto}}`),
 s('guion-reunion','reunion','Reunión de diagnóstico · 20 minutos','Reunión','Guion completo para conducir la conversación.',`APERTURA · 2 minutos
Gracias por venir. Me gustaría entender qué asuntos queréis captar, cómo atendéis las consultas y qué números manejáis. Después te enseño qué probaría. Al final decidimos si merece propuesta o si hay algo que resolver antes. ¿Te encaja?

SITUACIÓN · 4 minutos
¿Qué os ha hecho plantearos mejorar la captación ahora? ¿Qué asuntos de {{especialidad}} os interesan? ¿Cuáles descartáis y por qué? ¿Qué parte de vuestra capacidad está disponible?

RECORRIDO · 4 minutos
Pensemos en el último mes: ¿cuántas consultas entraron, cuántas pudisteis contactar, cuántas reservaron, cuántas asistieron y cuántas aceptasteis? ¿Quién registra cada paso? Si no tenemos las cifras, lo apuntamos como dato a construir.

ECONOMÍA Y DECISIÓN · 3 minutos
¿Qué honorarios medios efectivamente cobrados y qué margen de contribución tiene este servicio? ¿Qué presupuesto separado contempláis para gestión y publicidad? ¿Quién más participa en la decisión?

DEVOLUCIÓN · 4 minutos
Lo que entiendo es [resumen con sus palabras]. El primer punto a resolver sería [un cuello de botella]. Propondría [cambio concreto], medir [indicador] y revisar [fecha]. En {{especialidad}}, el criterio de aceptación lo fija vuestro abogado.

SIGUIENTE PASO · 3 minutos
¿Esto responde al problema que queréis resolver? Si sí, preparo el alcance con honorarios, medios y preparación separados. ¿Qué dato necesitaríais para decidir? ¿Cuándo lo revisamos con quien tenga que participar?

Si no hay capacidad o presupuesto: «Veo más útil resolver [condición] antes de activar captación. Dejamos esa tarea definida y retomamos solo si lo acordamos».`),
 s('objecion-agencia','reunion','«Ya trabajamos con una agencia»','Objeción','No desacredites al proveedor actual.',`Tiene sentido. ¿Tenéis visible qué consultas llegan a convertirse en citas y asuntos aceptados?

Si esa parte está resuelta y estáis satisfechos, puede que ahora no necesitéis otro servicio. Si hay un punto sin cubrir, podemos revisar ese tramo y ver si podemos complementarlo con un alcance concreto. ¿Dónde veis vosotros la mayor dificultad?`),
 s('objecion-malos-leads','reunion','«Ya probamos y los contactos eran malos»','Objeción','Pide ejemplos agregados y criterios.',`Entiendo la preocupación. Para distinguir el problema, ¿eran personas fuera de vuestra especialidad o zona, datos que no funcionaban, consultas sin intención o personas a las que no se llegó a contactar?

Lo primero sería dejar por escrito qué consideráis una consulta válida y registrar los descartes. Con eso sabremos si hay que cambiar el anuncio, el filtro o la atención. Sin ese dato no te propondría simplemente comprar más tráfico.`),
 s('objecion-precio','reunion','«Es caro»','Objeción','Aclara de qué coste habla y comprueba economía.',`¿Te refieres a la gestión, a la inversión publicitaria o al coste total del piloto?

El Sistema RedVitalia parte de 400 € netos al mes más IVA. Medios y preparación van separados. Podemos revisar cuánto margen aporta un asunto y cuánto tendría que costar conseguirlo para que tenga sentido. Si los números o la capacidad no encajan, prefiero que ajustemos el alcance antes de comprometer inversión.`),
 s('objecion-garantia','reunion','«¿Cuántos clientes me garantizas?»','Objeción','Distingue trabajo controlable de resultado comercial.',`Podemos comprometernos al alcance, la medición, el seguimiento y las revisiones acordadas. El número de asuntos depende también de la demanda, la competencia, vuestro encaje jurídico y la atención.

Para poner una cifra responsable necesitamos datos propios. El piloto sirve para construirlos y decidir con un coste por asunto aceptado. Si para avanzar necesitas un número de clientes garantizado, esta propuesta todavía no cumple ese requisito.`),
 s('objecion-experiencia','reunion','«¿Tenéis resultados en despachos?»','Objeción','No confundir investigación de competidores con experiencia propia.',`Te enseñaré únicamente los resultados propios que podamos acreditar y compartir. La investigación del sector nos ayuda a preparar el método, pero no la presentamos como casos de éxito de RedVitalia.

Si aún no disponemos de un caso comparable, puedes revisar el diagnóstico, el recorrido de demostración, los entregables y cómo mediremos el piloto. La decisión debe apoyarse en eso y en el riesgo que estéis dispuestos a asumir.`),
 s('objecion-exclusiva','reunion','«¿Seríamos exclusivos?»','Objeción','Aclara contacto propio y territorio.',`Podemos estructurar la captación desde vuestras cuentas y para vuestro despacho, sin revender esas consultas. La exclusividad territorial es otra condición: habría que acordar especialidad, zona, duración y alcance. No te la daría por hecha antes de dejarlo escrito.`),
 s('objecion-socio','reunion','«Tengo que hablarlo con mi socio»','Objeción','Facilita una decisión compartida.',`Claro. ¿Qué necesitará valorar tu socio: presupuesto, carga de atención, condiciones o cómo se mediría?

Te preparo el resumen con ese punto y, si os sirve, lo revisamos juntos en 15 minutos. ¿Qué fecha os encaja para tomar una decisión, aunque sea dejarlo para más adelante?`),
 s('objecion-pensarlo','reunion','«Me lo tengo que pensar»','Objeción','Descubre la duda sin presionar.',`Por supuesto. Para que puedas valorarlo, ¿qué parte queda menos clara: el alcance, los números o el momento?

Si lo resolvemos ahora, perfecto. Si necesitas revisarlo, acordamos una fecha o cierro el seguimiento hasta que quieras retomarlo. ¿Qué prefieres?`),
 s('resumen-reunion','propuesta','Correo después del diagnóstico','Correo','Completa el acuerdo; no atribuyas aceptación donde no la hubo.',`Asunto: Lo acordado para {{despacho}} y siguiente paso

Hola, {{nombre}}:

Gracias por la reunión. Te dejo el resumen para que me corrijas si he entendido algo mal:

• Objetivo: [objetivo concreto del despacho].
• Especialidad y zona: {{especialidad}} en {{zona}}.
• Capacidad de atención: [capacidad confirmada y responsable].
• Punto a mejorar: [cuello de botella identificado].
• Datos pendientes: [datos necesarios o «ninguno»].

Prepararé una propuesta con gestión, inversión en medios y preparación separadas. Mediremos consultas válidas, citas, asistencia y asuntos aceptados; cualquier previsión quedará identificada como escenario.

Próximo paso acordado: [acción, responsable y fecha].

{{asesor}} · RedVitalia
{{contacto}}

Si prefieres cerrar el seguimiento comercial, responde a este correo.`),
 s('propuesta-completa','propuesta','Propuesta comercial completa','Documento','Base para personalizar y aceptar antes de activar el servicio.',`PROPUESTA DE PILOTO · REDVITALIA × {{despacho}}
Especialidad: {{especialidad}} · Mercado: {{zona}}
Fecha: [fecha] · Validez de la propuesta: [plazo acordado]

1. OBJETIVO
Construir y medir el recorrido desde la solicitud hasta el asunto aceptado para detectar qué captación y qué atención permiten crecer con capacidad suficiente. Objetivo particular confirmado: [objetivo].

2. DURACIÓN Y PREPARACIÓN
Propuesta: 30 días de campaña activa, con preparación previa. Inicio previsto: [fecha], condicionado a accesos, materiales, aprobación del despacho y prueba del recorrido. Plazo y coste de preparación: [presupuesto aprobado]. Continuidad, preaviso y salida: [condiciones acordadas].

3. ALCANCE DE GESTIÓN DE GOOGLE ADS
Una especialidad y la zona acordada. Configuración/revisión de campaña según alcance, anuncios aprobados, revisión de búsquedas, seguimiento de presupuesto y revisión semanal de calidad. Entregables y límites concretos: [campañas, reuniones, revisiones y exclusiones acordadas].

4. INFRAESTRUCTURA
Landing, formulario, CRM, agenda, automatizaciones, seguimiento de llamadas y licencias: [qué se aprovecha, qué se contrata y qué se excluye]. Cada elemento adicional tendrá responsable, coste y aprobación. No está incluido por defecto en la tarifa de gestión.

5. INVERSIÓN
Sistema RedVitalia: desde 400 € netos/mes + IVA (cuota de entrada: 400 € + 84 € IVA = 484 €).
Publicidad: [presupuesto aprobado] €/mes, facturada por Google al despacho; tratamiento fiscal según su factura. Rango de exploración del panel: 800–2.000 €/mes, pendiente de estimación por zona.
Preparación y alta: [importe neto e impuestos aplicables].
Herramientas recurrentes: [importe, proveedor e impuestos aplicables].
Forma y calendario de pago: [acuerdo]. No se activa gasto adicional sin aprobación.

6. DEFINICIONES
Consulta válida: solicitud real sobre la especialidad y zona, con contacto utilizable y encaje comercial inicial según criterios adjuntos. Duplicados: [ventana acordada]. No es una valoración jurídica.
Cita asistida: reunión celebrada con la persona interesada.
Asunto aceptado: aceptación del encargo por despacho y cliente documentada según el proceso del despacho. Los honorarios cobrados se registran aparte.

7. RESPONSABILIDADES
RedVitalia ejecuta el alcance, documenta cambios y presenta resultados. El despacho aprueba la publicidad, valora el encaje jurídico, atiende consultas, mantiene su disponibilidad y comunica el estado final y motivos de descarte. Responsable de atención: [nombre/función]. Horario y objetivo de respuesta: [acuerdo].

8. MEDICIÓN Y REVISIÓN
Informe semanal con gasto, consultas únicas, válidas, contacto efectivo, citas, asistencias, asuntos aceptados y coste por etapa. Las previsiones son hipótesis; no se garantizan volumen, facturación ni resultados jurídicos.

9. CUENTAS Y DATOS
Titularidad y entrega de cuentas/activos: [acuerdo detallado]. Acceso por invitación y roles. Datos utilizados solo para el servicio; sin revender consultas. Encargo de tratamiento, proveedores y conservación: [documentos aplicables]. No se incorporan expedientes ni información sensible a plataformas de publicidad.

10. DECISIÓN FINAL
Al terminar, revisar calidad, capacidad y economía; acordar continuar, ajustar o parar. Si el seguimiento está incompleto, no se declara rentabilidad. Entrega al finalizar: [activos, registros, accesos y plazo].

ACEPTACIÓN
Responsable autorizado del despacho: [nombre/cargo].
Alcance, importes finales y condiciones aceptados el [fecha] por [medio acordado].
Este resumen se incorpora al contrato de servicios que formalice las condiciones.`),
 s('cierre-llamada','propuesta','Pedir una decisión clara','Llamada','Con alcance y números ya presentados.',`Hemos concretado el servicio, el coste y qué tiene que aportar cada parte. ¿Hay algún punto que impida decidir si empezamos el piloto?

[Si queda una duda]
La resolvemos antes de avanzar. ¿Qué información necesitas exactamente y quién debe validarla?

[Si acepta]
Perfecto. Te envío el alcance final para aceptación y la lista de arranque. En cuanto estén confirmados accesos, responsables y revisiones, fijamos la fecha de inicio.

[Si no encaja]
Gracias por decirlo. Anoto el motivo y cerramos la propuesta. Si más adelante cambia la situación, podremos revisarla de nuevo.`),
 s('landing-b2b','landing','Landing completa · RedVitalia para abogados','Landing','Copia base. Adaptar los datos pendientes antes de construirla.',`ANTETÍTULO
Captación para despachos de abogados

TITULAR
Un recorrido claro desde la consulta hasta el asunto aceptado.

SUBTÍTULO
En RedVitalia conectamos captación, filtro y seguimiento para que tu despacho pueda saber qué consultas de {{especialidad}} avanzan y dónde se detienen.

BOTÓN PRINCIPAL
Solicitar diagnóstico de captación

MICROTEXTO
Primero revisamos tu especialidad, zona y capacidad de atención. Después valoramos si tiene sentido un piloto.

BLOQUE 1 · ¿Qué ocurre con cada consulta que entra?
Una persona rellena el formulario. Otra llama cuando nadie puede atender. Una tercera reserva y no llega a la cita. Sin un registro común, es difícil saber si falta demanda, filtro o seguimiento.
El diagnóstico recorre estos pasos contigo y localiza el primer punto que merece mejorar.

BLOQUE 2 · Una especialidad. Un recorrido medible.
1. Definir. Qué asuntos interesan, en qué zona y cuántos podéis atender.
2. Atraer. Campañas y página alineadas con esa necesidad.
3. Filtrar. Criterios acordados antes de ocupar la agenda.
4. Atender. Responsable, siguiente paso y recordatorio cuando corresponde.
5. Aprender. Consultas válidas, citas, asistencia y asuntos aceptados.

BLOQUE 3 · Qué revisaríamos en tu despacho
El mensaje de tu página y la facilidad para solicitar contacto; la calidad de las consultas; el tiempo de respuesta; el paso de contacto a cita; y el registro del resultado final. Cada recomendación separa lo observado de lo que necesitamos confirmar con tus datos.

BLOQUE 4 · Para quién tiene sentido
Para despachos con práctica en {{especialidad}}, capacidad para nuevos asuntos y una persona responsable de atender y registrar las consultas. Antes de invertir, comprobamos que la propuesta encaja con vuestro servicio y economía.

BLOQUE 5 · Puedes ver cómo trabajaríamos
En el diagnóstico mostramos una revisión concreta, un recorrido de demostración y el formato del informe. Las demostraciones se identifican como ejemplos. Los resultados propios solo se presentan cuando existen datos verificables y autorización para compartirlos.

BLOQUE 6 · Inversión clara desde el principio
Sistema RedVitalia: desde 400 € netos al mes + 84 € de IVA (484 €). La inversión publicitaria se paga aparte a las plataformas. La preparación de landing, medición y herramientas se presupuesta según el alcance y lo que ya tenga el despacho.
Antes de empezar recibirás una propuesta con todos los importes, responsabilidades y condiciones.

PREGUNTAS FRECUENTES
¿Garantizáis nuevos clientes?
La propuesta define trabajo y medición. El número de asuntos depende de demanda, competencia, encaje y atención; se evalúa con datos del piloto.
¿Podemos empezar si tenemos agencia o web?
Sí, primero revisamos qué funciona y qué falta. El alcance puede aprovechar infraestructura existente si es adecuada.
¿De quién son las cuentas?
La propuesta debe dejar por escrito titularidad, accesos y entrega de activos. Planteamos la captación desde cuentas del despacho con acceso de gestión.
¿Trabajáis todas las especialidades a la vez?
Proponemos empezar con una para aprender con claridad. Cada nueva especialidad necesita su propio mensaje, filtro y medición.
¿Qué ocurre después de solicitar el diagnóstico?
Contactamos por el canal indicado para confirmar objetivo, zona y disponibilidad y acordar la revisión.

CIERRE
Revisemos el siguiente paso de tus consultas.
Completa tus datos profesionales y cuéntanos qué servicio quieres impulsar.

FORMULARIO
Nombre · Empresa o despacho · Teléfono · Canal preferido (WhatsApp o llamada) · Consentimiento para atender la solicitud.
Botón: Solicitar diagnóstico de captación
Texto de finalidad: Usaremos estos datos para atender tu solicitud de diagnóstico y acordar el siguiente paso. Consulta la información de privacidad de RedVitalia.
[Insertar identificación real del responsable y enlace a política vigente. Cualquier suscripción comercial adicional será opcional y separada.]

PÁGINA DE GRACIAS
Solo mostrar este mensaje después de confirmar recepción en el CRM: «Hemos recibido tu solicitud. Revisaremos los datos y te contactaremos por el canal que has elegido para acordar el diagnóstico. Si quieres añadir algo, escribe a {{contacto}}. No envíes documentación de tus clientes». Si falla la entrega, informar y ofrecer contacto directo sin registrar un lead recibido.`),
 s('anuncio-a','creativos','E1 · Boca a boca','Anuncio','Versión recomendada de la campaña Meta; todas las variantes están en el estudio de anuncios.',`TEXTO PRINCIPAL
Abogados: las recomendaciones son valiosas. ¿Y si vuestro despacho también tuviera una forma de darse a conocer a quienes todavía no os conocen? Sistema RedVitalia desde 400 €/mes + IVA. Inversión publicitaria aparte. Hablemos de tu despacho y del alcance de la propuesta.

TITULAR
Abogados, más allá del boca a boca

DESCRIPCIÓN
Desde 400 €/mes + IVA

BOTÓN
Más información

DESTINO
/abogados/redvitalia.html · Copia el enlace identificado de la pieza en /abogados/anuncios.html.`),
 s('anuncio-b','creativos','E3 · Especialidad','Anuncio','Versión recomendada de la campaña Meta; todas las variantes están en el estudio de anuncios.',`TEXTO PRINCIPAL
Abogados: herencias, familia e insolvencia no empiezan con la misma pregunta. La captación debe explicar el servicio que vuestro despacho quiere impulsar. Sistema RedVitalia desde 400 €/mes + IVA. Inversión publicitaria aparte. Hablemos de tu despacho y del alcance de la propuesta.

TITULAR
Abogados: vuestra especialidad

DESCRIPCIÓN
Desde 400 €/mes + IVA

BOTÓN
Más información

DESTINO
/abogados/redvitalia.html · Copia el enlace identificado de la pieza en /abogados/anuncios.html.`),
 s('google-b2b','creativos','Performance Max · Sistema para abogados','Anuncio','Una campaña y un grupo de recursos. Usar los textos y el plan del estudio de anuncios.',`15 TITULARES
Para abogados
Abogados: desde 400 €/mes
Sistema RedVitalia: abogados
Captación para abogados
Abogados, más visibilidad
Abogados: más que referidos
Abogados: cada consulta cuenta
Abogados: ordena la captación
Marketing para abogados
Abogados: consultas y citas
Un sistema para abogados
Abogados: siguiente paso
Abogados: foco en el despacho
Abogados: citas y seguimiento
Abogados: un plan comercial

5 TITULARES LARGOS
Abogados, más allá del boca a boca: Sistema RedVitalia desde 400 €/mes + IVA.
Abogados: captación y seguimiento con el Sistema RedVitalia desde 400 €/mes + IVA.
Abogados: da visibilidad a tu especialidad. Sistema RedVitalia desde 400 €/mes + IVA.
Abogados: revisemos el camino a la cita. Sistema RedVitalia desde 400 €/mes + IVA.
Abogados: conoce el Sistema RedVitalia desde 400 €/mes + IVA. Publicidad aparte.

5 DESCRIPCIONES
Abogados: Sistema RedVitalia desde 400 €/mes + IVA. Publicidad aparte. Hablemos.
Abogados: Sistema RedVitalia desde 400 €/mes + IVA. Definimos el alcance. Medios aparte.
Abogados: Sistema RedVitalia desde 400 €/mes + IVA. Especialidad y zona. Medios aparte.
Abogados: Sistema RedVitalia desde 400 €/mes + IVA. Revisemos tu proceso. Medios aparte.
Abogados: Sistema RedVitalia desde 400 €/mes + IVA. Solicita una propuesta. Medios aparte.

DESTINO
/abogados/redvitalia.html · Desactivar expansión de URL final para evitar el panel y las demos jurídicas. Las señales de audiencia orientan, pero no restringen PMax solo a abogados. Configuración completa en /abogados/anuncios.html.`),
 s('post-linkedin','creativos','Publicación de autoridad · LinkedIn','Publicación','Útil para perfil o página de RedVitalia, sin fingir resultados.',`Una consulta jurídica no es todavía un cliente.

Entre ambos hay varias decisiones: responder, confirmar que el asunto encaja, reservar una cita, asistir y aceptar el encargo.

Si el despacho solo recibe un informe de clics y formularios, queda una parte importante del recorrido sin explicar.

En RedVitalia proponemos empezar con cinco datos:
• Consultas válidas de la especialidad.
• Contactos atendidos.
• Citas reservadas.
• Citas asistidas.
• Asuntos aceptados.

La pregunta útil es dónde se detiene la siguiente oportunidad y qué se puede mejorar ahí.

Si diriges un despacho y quieres revisar este proceso, puedes pedirnos un diagnóstico de captación.`),
 s('video-anuncio','creativos','Vídeos de campaña · 20 segundos','Vídeo','Tres montajes descargables: vertical, cuadrado y horizontal. Sin locución.',`0–4 s · Abogados, más allá del boca a boca.
4–8 s · Abogados: que cada consulta tenga seguimiento.
8–12 s · Abogados: vuestra especialidad merece más visibilidad.
12–16 s · Abogados: de las consultas a las citas.
16–20 s · Abogados: crecer también necesita un sistema.

EN CADA ESCENA
Sistema RedVitalia
Desde 400 €/mes
+ IVA · Publicidad aparte

IMÁGENES
Teléfono amarillo, expediente granate, abogada ilustrativa, calendario naranja y despacho. Cada escena identifica explícitamente al abogado y conserva el precio visible.

DESCARGA
/abogados/anuncios.html#videos
Los vídeos son montajes de las composiciones generadas, sin testimonios ni resultados atribuidos. Para PMax, subir los MP4 a YouTube y elegirlos como recursos de la campaña.`),
 s('referencia','creativos','Pedir una presentación a un contacto','Mensaje','Solo a una relación existente y cuando sea pertinente.',`Hola, {{nombre}}. Estoy preparando diagnósticos de captación para despachos que quieran trabajar {{especialidad}}. Revisamos cómo pasan las consultas a citas y asuntos aceptados.

Si conoces un despacho al que le pueda interesar, puedes comentárselo y, si quiere, presentarnos o pasarle mi contacto: {{contacto}}. Prefiero que sea el despacho quien confirme interés antes de escribirle.

Gracias, {{asesor}} · RedVitalia.`),
 s('bienvenida','entrega','Correo de bienvenida tras aceptar','Correo','Solo cuando el alcance esté aceptado.',`Asunto: Arranque del piloto de {{despacho}} · próximos pasos

Hola, {{nombre}}:

Gracias por confirmar el alcance. Empezamos la preparación del piloto de {{especialidad}} en {{zona}}.

Para fijar el inicio necesitamos:
1. Persona que aprueba contenidos y persona que atiende consultas, con horario y sustitución.
2. Invitaciones de acceso a las cuentas y herramientas incluidas en el alcance. Te indicaremos usuario y rol; no envíes contraseñas.
3. Identidad profesional, servicios aceptados, zona, condiciones de consulta y material que podáis utilizar.
4. Criterios de consulta válida y cómo comunicaréis el estado de citas y asuntos.

Revisaremos juntos el recorrido con una prueba identificada antes de activar publicidad. Confirmaremos la fecha cuando estén completos los accesos, la revisión jurídica y la medición.

Reunión de arranque: [fecha acordada].
Responsable RedVitalia: {{asesor}}.

{{contacto}}`),
 s('arranque-agenda','entrega','Reunión de arranque · 45 minutos','Guía','Con comercial, atención y responsable jurídico.',`0–10 min · Confirmar servicio
Especialidad, zona, consultas que se aceptan y descartan, capacidad de nuevos asuntos y condiciones de la primera consulta.

10–20 min · Atención
Responsable y sustituto; horario; objetivo de primera respuesta; agenda disponible; escalado al abogado; canal de reprogramación y cierre.

20–30 min · Activos y datos
Accesos por invitación, materiales autorizados, landing, avisos de privacidad, herramientas y permisos. Qué datos mínimos recibe RedVitalia y cuáles quedan solo en el despacho.

30–40 min · Medición
Estados, definiciones, deduplicación, pruebas, eventos sin datos del caso, informe semanal y costes. La aceptación del encargo y los cobros se registran como hechos distintos.

40–45 min · Acuerdos
Lista de pendientes con responsable y fecha. Día previsto de prueba, aprobación de contenidos y lanzamiento. No publicar hasta cerrar los pendientes imprescindibles.`),
 s('informe-semanal','entrega','Informe semanal al despacho','Correo','Usa datos reales; «sin dato» nunca se convierte en cero.',`Asunto: {{despacho}} · revisión semanal de {{especialidad}} · [periodo]

Hola, {{nombre}}:

Esta semana el punto principal ha sido [hallazgo apoyado en datos].

RECORRIDO
Inversión publicitaria: [importe] €.
Consultas únicas: [número o sin dato]. Válidas: [número o sin dato].
Contactadas: [número o sin dato]. Citas: [número o sin dato].
Asistencias: [número o sin dato]. Asuntos aceptados: [número o sin dato].
Coste total de captación imputado al periodo: [importe y conceptos].
Coste por asunto aceptado: [coste/número; si hay cero asuntos, no calculable].

QUÉ EXPLICA LOS DATOS
Motivos de descarte: [motivos y cantidades].
Atención: [tiempo de respuesta y datos pendientes].
Los asuntos pueden cerrar en semanas posteriores; revisaremos también la cohorte por fecha de consulta.

SIGUIENTE CAMBIO
[Un cambio, motivo y cómo se evaluará].

NECESITAMOS DEL DESPACHO
[Acción, responsable y fecha].

Próxima revisión: [fecha].
{{asesor}} · RedVitalia`),
 s('revision-piloto','entrega','Revisión del piloto · continuar, ajustar o parar','Reunión','Tras el periodo acordado, considerando el retraso de cierre.',`1. Qué se ejecutó frente al alcance y qué quedó pendiente.
2. Qué datos están completos y cuáles impiden concluir.
3. Cuántas consultas se aceptaron, cuántas se atendieron y qué ocurrió con las citas.
4. Qué asuntos se aceptaron y qué honorarios se cobraron; separar cierres posteriores de la misma cohorte.
5. Coste de medios + gestión + preparación imputada + herramientas + atención comercial; comparar con contribución y capacidad.
6. Decisión:
• Continuar: calidad, capacidad y economía sostienen el siguiente tramo.
• Ajustar: un cuello de botella concreto, una intervención y otra fecha de revisión.
• Parar: falta capacidad, encaje o datos mínimos, o la economía no justifica más inversión.
7. Dejar por escrito presupuesto siguiente, responsabilidad y fecha. No ampliar a otra especialidad por inercia.`),
 s('landing-b2c','cliente-final','Landing del despacho · especialidad elegida','Landing del despacho','Revisión del abogado y condiciones completas antes de publicarla.',`{{despacho}} · {{especialidad}} en {{zona}}

{{tituloCliente}}

{{introCliente}}

BOTÓN
Solicitar contacto del despacho

QUÉ OCURRE DESPUÉS
1. Indicas el motivo general y cómo podemos contactar contigo.
2. El equipo confirma si el despacho puede atender la solicitud.
3. Si encaja, te explica la consulta, sus condiciones y cómo reservarla.

CÓMO PODEMOS AYUDARTE
Te escuchamos, identificamos el servicio que necesitas y te explicamos el siguiente paso. La valoración y el asesoramiento corresponden al abogado que revise tu situación.

QUIÉN TE ATIENDE
[Nombre real del profesional, colegio y número de colegiación verificados, práctica acreditable y datos reales del despacho].

CONDICIONES DE LA CONSULTA
[Modalidad, duración, precio e impuestos o gratuidad real confirmada, y condiciones de reserva/cancelación].

PREGUNTAS
¿Recibiré una respuesta jurídica al enviar el formulario?
El formulario solicita contacto. El asesoramiento requiere que el abogado conozca y valore tu situación.
¿Tengo que enviar documentos ahora?
No. Primero confirmamos qué necesitas. Si hace falta documentación, el despacho te indicará un canal adecuado.
¿El contacto me obliga a contratar?
Solicitar información no formaliza un encargo. Antes de contratar, el despacho explicará el servicio y sus condiciones.

FORMULARIO
Nombre · Email o teléfono · Provincia · Motivo general · Canal y horario preferidos.
No incluyas documentación, información financiera detallada ni datos de otras personas.
Botón: Solicitar contacto
[Añadir información de privacidad del despacho, responsable real, finalidad, base aplicable y enlace; separar comunicaciones comerciales opcionales].

GRACIAS
Hemos recibido tu solicitud. El equipo de {{despacho}} contactará por el canal indicado dentro de [plazo que pueda cumplir]. Si necesitas corregir un dato, utiliza [canal oficial del despacho]. Este formulario no presta atención urgente ni sustituye asesoramiento jurídico.`),
 s('atencion-b2c','cliente-final','Llamada a quien pide información al despacho','Llamada del despacho','La persona ha solicitado contacto. No dar asesoramiento desde marketing.',`Hola, ¿hablo con [nombre de la persona]? Soy [persona de atención], de {{despacho}}. Nos has pedido información sobre {{especialidad}}. ¿Es un buen momento y un canal adecuado para hablar?

Para dirigir la consulta, ¿en qué provincia necesitas atención y cuál es el motivo general? No hace falta entrar ahora en detalles ni enviar documentos.

[Usar las preguntas de encaje de esta especialidad sin emitir valoración jurídica]

Gracias. El siguiente paso, si el despacho puede atenderlo, es una consulta con el abogado. Sus condiciones son [duración, modalidad, precio e impuestos o gratuidad confirmada]. El abogado valorará la situación y explicará las opciones.

¿Te encaja [fecha y hora reales]? ¿Por qué canal prefieres recibir la confirmación?

[Si no encaja]
Con la información inicial, este servicio no corresponde al ámbito que estamos atendiendo. No voy a darte una valoración jurídica desde esta llamada. Gracias por contactar.

[Si pide no ser contactado]
De acuerdo, dejo registrada tu solicitud y detenemos este contacto.`),
 s('confirmacion-b2c','cliente-final','Confirmación de consulta jurídica','Mensaje del despacho','Canal elegido por la persona interesada.',`Hola, [nombre]. Confirmamos tu consulta con {{despacho}} para [día, hora y zona horaria].

Modalidad y acceso: [dirección o enlace real].
Duración y condiciones: [condiciones comunicadas y aceptadas].

Si necesitas cambiarla, responde por este canal o utiliza [canal del despacho]. No envíes documentación por aquí; el equipo te indicará cómo compartirla si es necesaria.

Gracias, [persona de atención] · {{despacho}}.`),
 s('no-contacto-b2c','cliente-final','Solicitud recibida, sin contacto todavía','Mensaje del despacho','Solo para responder a la solicitud por canal apropiado.',`Hola, [nombre]. Soy [persona de atención], de {{despacho}}. Hemos recibido tu solicitud de contacto y no hemos podido hablar contigo. ¿Qué horario y canal te vienen bien? Si ya no necesitas que contactemos, dínoslo y cerramos la solicitud. Gracias.`),
 s('presupuesto-b2c','cliente-final','Correo después de la consulta del abogado','Correo del despacho','El abogado completa servicio y condiciones reales.',`Asunto: Propuesta de servicios de {{despacho}}

Hola, [nombre]:

Tras nuestra consulta, te enviamos la propuesta del servicio que hemos comentado por el canal acordado.

Servicio y actuaciones incluidas: [alcance aprobado por el abogado].
Honorarios e impuestos: [importe y desglose].
Gastos de terceros y actuaciones no incluidas: [detalle].
Forma de pago y condiciones: [acuerdo].
Siguiente paso si quieres contratar: [proceso de aceptación y encargo].

Si necesitas aclarar el alcance, responde o contacta por [canal oficial]. La propuesta no garantiza un resultado y cualquier actuación se ajustará a lo formalizado en el encargo.

[Profesional responsable] · {{despacho}}`),
 s('crm-definiciones','control','Estados y campos del CRM comercial','Operativa','Para configurar el tablero de RedVitalia.',`UN REGISTRO POR DESPACHO
ID interno; despacho; especialidad; zona; URL fuente y fecha; teléfono/email profesional; contacto y cargo si conocidos; base/permiso y alcance; oposición; puntuación y motivo; responsable; etapa; último contacto; próximo paso y fecha; importe propuesto; costes previstos; resultado y motivo.

ETAPAS CON CRITERIO DE SALIDA
Investigado: identidad y actividad comprobadas.
Contacto permitido: origen y legitimación revisados, sin oposición.
Conversación: contacto real con persona relevante.
Interesado: pidió información o diagnóstico; registrar qué autorizó.
Diagnóstico reservado: día, hora y responsable confirmados.
Asistió: reunión celebrada.
Propuesta: alcance enviado y fecha de decisión acordada.
Ganado: alcance aceptado por persona autorizada. Cobrado se registra aparte.
Perdido: motivo concreto, sin próxima acción salvo petición futura.

MOTIVOS DE PÉRDIDA
Sin capacidad; fuera de especialidad/zona; sin presupuesto; prioridad aplazada; proveedor actual resuelve; no decide; condiciones incompatibles; sin respuesta tras seguimiento permitido; oposición.

OPOSICIÓN
Bloquea llamadas, emails y WhatsApp comerciales. No vuelve a la cola por un cambio de etapa o nueva importación.

REGLA DE TRABAJO
Ninguna oportunidad abierta sin próximo paso, responsable y fecha. No guardar expedientes de clientes del despacho en este tablero.`),
 s('metricas-b2b','control','Cómo medir la venta de RedVitalia','Operativa','Cifras de adquisición de despachos, separadas de las de sus clientes.',`Conversación: conversaciones con persona relevante / intentos de contacto válidos.
Interés: despachos que solicitan el siguiente paso / conversaciones.
Reserva: diagnósticos reservados / interesados.
Asistencia: diagnósticos celebrados / reservados.
Propuesta: propuestas / diagnósticos celebrados.
Cierre: despachos con alcance aceptado / propuestas de la misma cohorte.

CAC DE REDVITALIA
(Gasto propio de anuncios + herramientas comerciales + horas de investigación/venta a coste interno + otros costes de adquisición) / despachos nuevos contratados.
Si no hay contratos, no es 0 €: el CAC no es calculable todavía.

RECUPERACIÓN
CAC / contribución mensual de un despacho, calculada con honorarios netos menos coste real de prestar el servicio. No usar los 400 € como margen íntegro. Si no hay margen positivo, no hay recuperación calculable.

No contar como ingresos de RedVitalia el dinero que el despacho paga directamente a Google. No mezclar esta tabla con coste por asunto del cliente.

REVISIÓN DEL VIERNES
¿Dónde cae más el recorrido? ¿Qué dicen las objeciones reales? ¿Qué tarea cambiaremos la semana siguiente? Mantener las cohortes por fecha para no enfrentar contratos antiguos a contactos nuevos.`),
 s('prueba-ejemplo','control','Ejemplo numérico del despacho','Ejemplo','Datos ficticios para entender el cálculo; no son resultados de RedVitalia.',`EJEMPLO DIDÁCTICO · NO ES UNA PREVISIÓN
Medios: 1.200 € · Cuota de entrada del sistema: 400 € · Preparación imputada: 300 € · Herramientas y atención: 100 €.
Coste total neto imputado: 2.000 €.
Honorario medio efectivamente cobrado por asunto: 2.500 €.
Margen de contribución antes de captación: 40 % = 1.000 € por asunto.
Punto de equilibrio de este coste: 2 asuntos. Para dejar contribución adicional, hacen falta más de 2.

Si el 20 % de las consultas válidas termina en asunto aceptado, el coste total máximo de equilibrio por consulta válida sería 200 €. No es el CPC ni solo el precio del formulario.

Para no trabajar al límite, un tope operativo propuesto del 50 % dejaría 100 € por consulta válida. Es un criterio de prudencia editable, no una media del sector.

Los impuestos no recuperables y el coste de atención deben incorporarse. Los cobros fraccionados y cierres posteriores afectan a caja: revisar la cohorte antes de concluir rentabilidad.`),
];

export const evidence = [
 { name: 'Eximia Studio', company: 'eximia-studio', url: 'https://eximiastudio.com/servicios/agencia-marketing-para-abogados/', status: 'Web consultada · 13/09/2026', observed: 'Landing jurídica con diagnóstico, proceso, preguntas y una promesa de exclusividad territorial.', apply: 'Una página específica para despachos, diagnóstico tangible y explicación del recorrido.', limit: 'Sus casos y compromisos pertenecen al anunciante. RedVitalia debe acreditar los propios y pactar cualquier exclusividad.' },
 { name: 'NDE Marketing', company: 'ndemarketing', url: 'https://ndemarketing.com/agencia-marketing-juridico-espana/', status: 'Web consultada · 13/09/2026', observed: 'Adaptación del mensaje por plaza jurídica y servicios; combina captación con web y seguimiento.', apply: 'Personalizar por ciudad y especialidad, y separar la causa observable del resultado por confirmar.', limit: 'Las cifras de facturación y garantías publicadas son afirmaciones del anunciante; no se trasladan a nuestra oferta.' },
 { name: 'Expiey', company: 'expiey', url: 'https://expiey.com/agencia-marketing-abogados/', status: 'Web consultada · 13/09/2026', observed: 'Presenta seguimiento de contactos, revisiones periódicas y una garantía ligada a contactos cualificados.', apply: 'Definir qué es una consulta válida y quién responde; convertir seguimiento y revisión en entregables.', limit: 'La garantía comercial observada no demuestra rendimiento ni obliga a ofrecerla en RedVitalia.' },
 { name: 'Lexiuris Marketing', company: 'lexiuris-marketing', url: 'https://lexiurismarketing.com/', status: 'Archivo del panel · 21/08/2026', observed: 'La ficha recoge landings por especialidad/ciudad y una entrada mediante diagnóstico.', apply: 'Un mensaje y filtro propios para Segunda Oportunidad, herencias y divorcios.', limit: 'La web presentó verificación automática en esta revisión; la evidencia aquí procede del archivo.' },
 { name: 'Nexo Jurídico', company: 'nexo-juridico', url: 'https://vsl.nexo-juridico.com/optin-vsl', status: 'Archivo del panel · 26/08/2026', observed: 'Mensaje específico para despachos de insolvencia empresarial, apoyado en un vídeo y reuniones.', apply: 'Nombrar el tipo de asunto y el interlocutor, y explicar el mecanismo con un vídeo breve.', limit: 'Es un segmento distinto de insolvencia de particulares. Su promesa de reuniones no es un resultado verificado para nuestro piloto.' },
 { name: 'PlusLeads', company: 'plusleads', url: 'https://plusleads.nl/', status: 'Archivo del panel · 21/08/2026', observed: 'El archivo describe un escaneo de potencial de mercado como oferta de entrada.', apply: 'Entregar una revisión concreta antes de pedir una reunión comercial.', limit: 'La revisión debe estar hecha y mostrar evidencia; no basta con llamar diagnóstico a una llamada de venta.' },
 { name: 'SCALE Lead', company: 'scale-lead', url: 'https://scale-group.co.jp/scale-lead', status: 'Archivo del panel · 21/08/2026', observed: 'La ficha distingue concertación de reuniones, calidad y revisión de la actividad comercial.', apply: 'Medir reserva, asistencia y resultado por separado; usar motivos de pérdida para mejorar el guion.', limit: 'No adoptamos tarifas, ratios ni condiciones de otro mercado.' },
];
export const sourceNotes = [
 { title: 'Base del panel: nicho abogados', url: '/data/nichos/legal.json', note: 'Priorización y tarifa de gestión existentes. La tarifa no acredita que toda la infraestructura esté incluida.' },
 { title: 'Precios y patrones de RedVitalia', url: '/data/nichos/index.json', note: 'Importes de referencia del panel: honorarios netos, IVA y medios separados.' },
 { title: 'AEPD · llamadas comerciales', url: 'https://www.aepd.es/preguntas-frecuentes/5-publicidad-no-deseada/FAQ-0503-llamadas-no-solicitadas-con-fines-comerciales-con-intervencion-humana', note: 'Revisar legitimación antes de llamar; identificar propósito comercial y permitir oposición desde el inicio.' },
 { title: 'AEPD · contacto profesional', url: 'https://www.aepd.es/preguntas-frecuentes/5-publicidad-no-deseada/FAQ-0506-recepcion-de-llamadas-publicitarias-si-soy-un-empresario-individual-o-un-profesional-liberal', note: 'La condición profesional exige pertinencia con la actividad; no habilita un uso privado o indiscriminado del contacto.' },
 { title: 'BOE · LSSI, artículo 21', url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2002-13758#a21', note: 'Esta secuencia parte de información solicitada o autorizada, conserva el alcance y permite cerrar el seguimiento. Un email publicado no equivale a autorización.' },
 { title: 'BOE · Estatuto de la Abogacía, artículo 20', url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2021-4568', note: 'Publicidad veraz, secreto profesional y especialización acreditable. Evitar promesas jurídicas fuera del control profesional y referencias a clientes sin autorización.' },
];
