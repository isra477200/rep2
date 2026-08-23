#!/usr/bin/env node
/**
 * Genera public/data/recursos.json → materiales LISTOS PARA USAR por RedVitalia
 * (Isra, Nidia, Paula): guiones, cláusulas, protocolos, plantillas y CSVs.
 * Los textos destilan las tácticas verificadas de la base (fichas citadas);
 * los CSVs se generan desde companies-index.json.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname);
const companies = JSON.parse(readFileSync(resolve(root, "public/data/companies-index.json"), "utf8"));
const mystery = JSON.parse(readFileSync(resolve(root, "public/data/mystery.json"), "utf8"));

const csvCell = (v) => {
  const s = String(v ?? "").replaceAll('"', '""').replaceAll(/\s+/g, " ").trim();
  return `"${s}"`;
};

/* ---------- CSV 1: competidores españoles con precio ---------- */
const spain = companies
  .filter((c) => c.primaryCountry === "España")
  .sort((a, b) => b.score - a.score);
const csvSpain = [
  ["Empresa", "Tipo", "Score", "Amenaza", "Precio publicado", "≈EUR", "Garantía", "Contrato", "Web"].join(";"),
  ...spain.map((c) =>
    [c.name, c.agencyType, c.score, c.threat, c.priceLocal || "No publicado", c.price?.eur ?? "", (c.guarantee || "").slice(0, 180), (c.contract || "").slice(0, 120), c.website]
      .map(csvCell)
      .join(";"),
  ),
].join("\n");

/* ---------- CSV 2: registro mystery shopping (Nidia) ---------- */
const csvMystery = [
  ["Orden", "Empresa", "Web", "Identidad usada", "Fecha contacto", "Canal", "Respondieron (h)", "Quién atendió", "Precio dicho", "Garantía dicha", "Permanencia", "Presión de venta 1-5", "Qué prometieron", "Material que enviaron", "Nota clave"].join(";"),
  ...(mystery.targets || []).map((t) =>
    [t.order, t.name, t.website, t.identity, "", "", "", "", "", "", "", "", "", "", t.focus].map(csvCell).join(";"),
  ),
].join("\n");

/* ---------- Textos listos para usar ---------- */
const items = [
  {
    id: "clausula-zona-protegida",
    categoria: "Contrato y web",
    para: "Isra",
    titulo: "Cláusula «Garantía de Zona Protegida»",
    descripcion: "La exclusividad territorial empaquetada como garantía formal con nombre propio (modelo 0711-Netz). Versión contrato + versión web.",
    filename: "garantia-zona-protegida.txt",
    contenido: `GARANTÍA DE ZONA PROTEGIDA — RedVitalia

VERSIÓN PARA CONTRATO
─────────────────────
Cláusula de Exclusividad Territorial («Garantía de Zona Protegida»).
Durante la vigencia de este contrato, RedVitalia se compromete a NO prestar servicios de captación de clientes a ningún otro negocio del sector «[NICHO]» cuya zona de actuación coincida total o parcialmente con la zona asignada al CLIENTE: «[ZONA: municipio/s o código/s postal/es]».
La plaza queda registrada a nombre del CLIENTE en el registro interno de zonas de RedVitalia en la fecha de la firma. Si RedVitalia incumpliera esta exclusividad, el CLIENTE quedará liberado de toda permanencia y no abonará la mensualidad en curso.
La exclusividad se mantiene mientras el contrato esté activo y decae automáticamente a los 15 días de su finalización, quedando la plaza libre para lista de espera.

VERSIÓN PARA LA WEB / PROPUESTA
───────────────────────────────
🛡️ Garantía de Zona Protegida
Un solo cliente por sector y zona. Cuando firmas, tu plaza queda registrada y bloqueada: no trabajaremos con tu competencia directa mientras estés con nosotros. Está en el contrato, no en la letra pequeña.
[BOTÓN] Comprueba si tu zona está libre →

GUION DE 10 SEGUNDOS PARA EL SETTER
───────────────────────────────────
«Trabajamos con un solo [nicho] por zona. Ahora mismo tu plaza en [zona] está libre; si la firma otro antes, no podríamos trabajar contigo aunque quisieras.»

Origen de la táctica: 0711-Netz (Alemania) — «Gewerk-Gebietsschutz-Garantie»; Horizzon Media y ReforLeads (España) — comprobador de zona como CTA.`,
  },
  {
    id: "definicion-cita-valida",
    categoria: "Contrato y web",
    para: "Isra",
    titulo: "Definición de «cita válida» + reglas de reposición",
    descripcion: "Los criterios objetivos que se firman antes de vender y las reglas de reposición con pruebas. La vacuna contra disputas (Prospectify, MegaLeads, Compra Leads).",
    filename: "cita-valida-y-reposicion.txt",
    contenido: `DEFINICIÓN CONTRACTUAL DE «CITA VÁLIDA» — RedVitalia

Una cita se considera VÁLIDA y por tanto computa en el volumen pactado cuando cumple TODAS estas condiciones:
1. El contacto pertenece a la zona asignada al cliente (Zona Protegida) o declara necesidad dentro de ella.
2. La persona que asiste es el decisor o participa en la decisión de compra (titular, gerente o responsable declarado).
3. Ha confirmado interés real en «[SERVICIO DEL CLIENTE]» durante la llamada de cualificación.
4. La cita queda agendada en el calendario del cliente con fecha, hora y teléfono verificado (verificación por doble llamada o WhatsApp respondido).
5. Se entrega con briefing: nombre, teléfono, necesidad declarada, urgencia y resumen de la conversación.

NO computan (y se REPONEN sin coste):
- Teléfono inexistente o que nunca responde tras 3 intentos documentados en 48 h.
- Contacto duplicado (mismo teléfono en los últimos 90 días).
- Contacto fuera de la zona asignada.
- Persona que niega haber pedido información (grabación o registro disponible).

SÍ computan (no se reponen):
- No-show del NEGOCIO: la cita que el cliente no atiende tras los dos recordatorios cuenta como entregada (regla EverConnect: educa a responder).
- Cita celebrada que no acaba en venta: vendemos la reunión cualificada, no el cierre.

PROCEDIMIENTO DE REPOSICIÓN
- El cliente comunica la incidencia en un máximo de 5 días con el dato concreto.
- RedVitalia verifica contra su registro (llamadas, WhatsApp, grabación) y repone en el ciclo en curso.
- La reposición es SIEMPRE en especie (otra cita), nunca devolución en metálico. Si al final del ciclo falta volumen, se prolonga el servicio gratis hasta cumplirlo (modelo Abstrakt/Clozer: se paga con tiempo, no con caja).

Origen: Prospectify (criterios firmados antes de facturar), MegaLeads (re-créditos con prueba en 24 h), LGDigital (regla objetiva de los 30 segundos), Compra Leads OÜ (redacción «el riesgo lo asumimos nosotros»).`,
  },
  {
    id: "guion-setter-frio",
    categoria: "Guiones",
    para: "Nidia",
    titulo: "Guion de llamada en frío del setter (v. patrones ganadores)",
    descripcion: "Apertura, gancho de zona, cualificación exprés y cierre de cita — montado con las tácticas de los 80+ de la base.",
    filename: "guion-setter-frio.txt",
    contenido: `GUION SETTER — LLAMADA EN FRÍO (negocio local)
Objetivo: cita de 20 min en el calendario. No vender el servicio: vender la reunión.

0. PREPARACIÓN (30 seg antes de marcar)
- Nombre del negocio, zona, nicho, y si su plaza está libre en el registro de zonas.
- Un dato local real («he visto que en [zona] hay X buscando [servicio] al mes»).

1. APERTURA (10 seg — permiso + honestidad)
«Hola, ¿[NOMBRE]? Soy [SETTER], de RedVitalia. Te llamo en frío y te robo 30 segundos: ¿te pillo bien o corto ya?»
(Si corta: «Perfecto, ¿mañana a esta hora?» — y colgar. Nunca rogar.)

2. GANCHO DE ZONA (15 seg — escasez verificable)
«Rápido: trabajamos captación para [NICHO] con una regla — un solo negocio por zona. La plaza de [ZONA] para [NICHO] ahora mismo está libre, y antes de ofrecérsela a nadie más quería hablar contigo.»

3. PITCH DE LA REUNIÓN (15 seg — vender la cita, no el servicio)
«No te voy a vender nada por teléfono. Lo que hacemos es agendar citas ya filtradas con gente de tu zona que busca [SERVICIO]; tú solo atiendes la reunión. Te propongo 20 minutos con [CLOSER/ISRA] para enseñarte cómo, con números de [NICHO], y decides.»

4. CUALIFICACIÓN EXPRÉS (filtro de estatus — 3 preguntas máx.)
- «¿Sigues aceptando clientes nuevos o estáis a tope?» (capacidad — regla Edge Connection)
- «¿Quién decide esto contigo?» (decisor)
- «Si te llegan 10-15 citas al mes, ¿tienes equipo para atenderlas?» (filtro LosLeads)
Si NO cualifica: «Te soy honesto: ahora mismo no encajáis, y no te haría perder el tiempo. Si [condición] cambia, llámame y te reservo la zona.» (el rechazo eleva el estatus)

5. CIERRE DE CITA (alternativa, nunca pregunta abierta)
«¿Te viene mejor mañana a las 10 o el jueves a las 16?»
Confirmación inmediata por WhatsApp con: fecha, hora, nombre del closer y UNA línea de valor («te llevaremos los números de [nicho] en [zona]»).

6. BLINDAJE ANTI NO-SHOW (antes de colgar)
«Te llegará un WhatsApp ahora y un recordatorio el día antes. Si te surge algo, respóndelo y lo movemos — la plaza de tu zona la mantengo bloqueada hasta esa reunión.»

REGLAS DE ORO
- Ratio hablar/escuchar: 40/60 desde la pregunta 4.
- Máximo 2 intentos de cierre por llamada.
- Todo queda registrado: hora, resultado, objeción principal (alimenta el argumentario).`,
  },
  {
    id: "protocolo-no-show",
    categoria: "Operativa",
    para: "Nidia",
    titulo: "Protocolo anti no-show (recordatorios + rescate)",
    descripcion: "Mensajes exactos de WhatsApp a 24 h y 1 h, rescate del caído y la regla de cobro que educa al cliente (Belkins + EverConnect).",
    filename: "protocolo-no-show.txt",
    contenido: `PROTOCOLO ANTI NO-SHOW — RedVitalia

A) RECORDATORIO 24 HORAS ANTES (WhatsApp al prospecto)
«Hola [NOMBRE] 👋 Te recuerdo la reunión de mañana a las [HORA] con [CLOSER] de RedVitalia sobre cómo llenarte la agenda de [SERVICIO] en [ZONA]. Será por [teléfono/vídeo] y dura 20 min. ¿Confirmamos? Un "OK" me vale.»
→ Si no responde en 4 h: llamada corta de confirmación.

B) RECORDATORIO 1 HORA ANTES
«[NOMBRE], en una hora te llama [CLOSER] al [TELÉFONO]. Tiene preparados los números de [NICHO] en tu zona. ¡Hasta ahora!»

C) SI NO SE PRESENTA (rescate en caliente, mismo día)
Llamada a los 10 minutos: «[NOMBRE], teníamos la reunión ahora — seguro que te ha pillado liado. ¿La movemos a hoy a las [X] o mañana a las [Y]? Te guardo la plaza de zona hasta entonces.»
→ Sin respuesta: WhatsApp con las dos alternativas + «si no me dices nada, mañana libero la plaza de [ZONA]». (escasez real, no amenaza vacía)

D) SEGUNDA CAÍDA
Se marca el contacto como no fiable. Un único mensaje final a los 3 días:
«[NOMBRE], cierro tu expediente por ahora. Si más adelante quieres retomar, escríbeme — pero la exclusividad de [ZONA] quedará para el primero que la firme.»

E) REGLA DE COBRO (para el CLIENTE de RedVitalia — en contrato)
La cita que el NEGOCIO no atiende tras recibir los dos recordatorios computa como entregada (regla EverConnect: «si no lo coges, cuenta»). La cita que se cae por el PROSPECTO se repone sin coste. Esta asimetría es deliberada: nosotros respondemos por nuestra parte del embudo, el cliente por la suya.

MÉTRICA SEMANAL (rellenar cada viernes)
- Citas agendadas / celebradas / caídas por prospecto / caídas por cliente
- Show-rate objetivo: ≥70%. Si baja de 60% dos semanas: revisar franja horaria y guion de confirmación.

Origen: Belkins (no-show recovery como línea de producto), EverConnect (regla de cobro), Lucid Leads (SLA de contacto <10 min).`,
  },
  {
    id: "plantillas-seguimiento",
    categoria: "Guiones",
    para: "Nidia",
    titulo: "5 plantillas de seguimiento (lead que no contesta)",
    descripcion: "Secuencia WhatsApp de 5 toques en 7 días, con el cierre por escasez de zona en el último.",
    filename: "plantillas-seguimiento.txt",
    contenido: `SECUENCIA DE SEGUIMIENTO — LEAD QUE NO RESPONDE (WhatsApp)

TOQUE 1 · Día 0, 2 h después del intento de llamada
«Hola [NOMBRE], soy [SETTER] de RedVitalia. Te he llamado por lo de la captación de clientes para [NEGOCIO] en [ZONA] — nada urgente. ¿Cuándo te viene bien que te llame, mañana por la mañana o por la tarde?»

TOQUE 2 · Día 1 (valor, no presión)
«Te dejo un dato mientras tanto: en [ZONA] hay una media de [X] búsquedas al mes de gente pidiendo [SERVICIO]. Ahora mismo casi todas acaban en [competidor/portal]. Es justo lo que nosotros redirigimos hacia un solo negocio por zona.»

TOQUE 3 · Día 3 (prueba social cruda)
«Para que veas de qué va: con [nicho parecido] estamos entregando [X] citas/mes ya filtradas — el negocio solo atiende la reunión. Si te encaja verlo con números, son 20 minutos.»

TOQUE 4 · Día 5 (pregunta cerrada mínima)
«[NOMBRE], ¿esto te interesa y estás liado, o simplemente no es para ti? Con un "sí, más adelante" o un "no" me vale y no te doy más la lata 🙂»

TOQUE 5 · Día 7 (cierre por escasez — último)
«Cierro tu ficha por ahora. Solo una cosa: trabajamos con UN [nicho] por zona y la plaza de [ZONA] sigue libre. Si la firma otro, no podré ofrecértela más adelante. Si quieres que te la reserve mientras hablamos, dímelo hoy.»

REGLAS
- Nunca dos toques el mismo día. Nunca audios en frío. Máximo 1 emoji.
- Cada toque aporta algo nuevo (dato, prueba, salida fácil, escasez) — jamás «¿lo has visto?».
- Responder a cualquier señal en <10 minutos en horario laboral (SLA Lucid Leads).`,
  },
  {
    id: "argumentario-objeciones",
    categoria: "Guiones",
    para: "Nidia",
    titulo: "Argumentario: 10 objeciones con respuesta",
    descripcion: "Incluye la munición documentada contra «ya estoy con otra agencia» usando la letra pequeña real de qdq y Doctoralia.",
    filename: "argumentario-objeciones.txt",
    contenido: `ARGUMENTARIO DE OBJECIONES — SETTER / CLOSER RedVitalia

1) «No me interesa»
«Perfecto, y no te insisto. Solo dime una cosa para no molestarte más: ¿es que no necesitas clientes nuevos, o que no te fías de los que vendemos captación?» (la segunda abre la puerta a la garantía)

2) «Ya estoy con otra agencia / con qdq / con Doctoralia»
«Genial, eso me dice que ya inviertes. Pregunta concreta: ¿te garantizan por contrato un volumen, y qué pasa si no llega? Te lo digo porque el contrato de qdq lleva permanencia anual con renovación automática y ventana de baja de 15 días; y Doctoralia responde por escrito que "no se compromete a aportar pacientes" — cobran visibilidad. Nosotros entregamos citas agendadas, con reposición escrita de la cita mala y sin permanencia oculta. ¿20 minutos y comparas los dos contratos encima de la mesa?»

3) «Es caro»
«¿Comparado con qué? Un comercial en plantilla que te llame a puerta fría son 1.600–1.900 €/mes con Seguridad Social. Nosotros hacemos esa función por menos de la mitad, y si un mes no hay volumen, seguimos gratis hasta cumplirlo.» (marco SalesArte)

4) «Ya lo intenté con leads y era basura»
«Normal: leads compartidos que llegan quemados a 5 negocios. Lo nuestro es lo contrario: cita en TU calendario, en exclusiva, cualificada por teléfono por una persona, y la que venga mal — duplicada, fuera de zona, falsa — se repone por escrito. La diferencia está en el contrato, no en la promesa.»

5) «No tengo tiempo para reuniones»
«Por eso existe esto: tú solo atiendes la cita ya montada. Y la primera reunión conmigo son 20 minutos con los números de tu zona. Si no ves valor a los 10, la cortas.»

6) «Mándame info por email»
«Te mando algo mejor: los números de [NICHO] en [ZONA] y cómo quedaría tu agenda. Pero eso se explica en 20 minutos, no en un PDF. ¿Mañana a las 10 o el jueves a las 16?»

7) «¿Y si no funciona?»
«Está previsto en el contrato: si no llegamos al volumen pactado, seguimos trabajando gratis hasta cumplirlo. No devolvemos dinero: cumplimos. El riesgo del arranque lo asumimos nosotros.»

8) «Tengo que consultarlo con mi socio/a»
«Lógico. Mejor aún: que esté en la reunión, así lo decidís con los mismos números delante. ¿Qué día os cuadra a los dos?»

9) «¿Vosotros también trabajáis con mi competencia?»
«No, y esa es la clave: un solo [nicho] por zona, por contrato. De hecho tu plaza está libre ahora mismo; si la firma otro, no podríamos trabajar contigo.»

10) «Llámame más adelante»
«Te llamo, sin problema. Solo avísame de esto: la plaza de [ZONA] no la puedo reservar sin fecha. Si en [MES] sigue libre, te llamo el día 1. Si me la piden antes, ¿quieres que te avise para decidir?»

REGLA GENERAL: cada respuesta acaba SIEMPRE en pregunta. El que pregunta, dirige.
Fuentes de la munición: fichas qdq, Doctoralia (grupo Docplanner), MásNegocio, SalesArte, Compra Leads OÜ, Abstrakt Marketing Group.`,
  },
  {
    id: "onboarding-semana-0",
    categoria: "Operativa",
    para: "Isra",
    titulo: "Checklist de onboarding — Semana 0",
    descripcion: "Lo que ocurre entre la firma y la primera factura: presentación del setter, guion aprobado y criterios firmados (modelo SalesHive).",
    filename: "onboarding-semana-0.txt",
    contenido: `ONBOARDING SEMANA 0 — ANTES DE LA PRIMERA FACTURA

DÍA 1 · Firma
☐ Contrato firmado con: Garantía de Zona Protegida + definición de cita válida + reglas de reposición.
☐ Alta de la zona en el registro interno (nicho + zona + fecha).
☐ WhatsApp de bienvenida con calendario de la semana 0.

DÍA 2 · Reunión de arranque (30 min, con el setter presente)
☐ Presentar a [SETTER]: nombre, cara y voz — es quien llamará en nombre del cliente.
☐ Recoger: propuesta de valor del negocio, 3 preguntas de cualificación específicas, franjas de agenda, zonas exactas.
☐ Definir al cliente ideal Y al cliente NO deseado (tan importante como el primero).

DÍA 3-4 · Guion y criterios
☐ Redactar el guion personalizado y ENVIARLO AL CLIENTE PARA APROBACIÓN por escrito (modelo SalesHive: nada se lanza sin su OK).
☐ Firmar el anexo de criterios de cita válida rellenado con su nicho y zona.
☐ Configurar el calendario compartido + recordatorios automáticos (24 h / 1 h).

DÍA 5 · Test y lanzamiento
☐ Llamada de prueba interna (setter → closer) con el guion aprobado.
☐ Primer bloque de prospección lanzado.
☐ Mensaje al cliente: «Arrancamos. Primera revisión de números el día [X]. Calendario de expectativas: semanas 1-2 rodaje, semanas 3-4 ritmo objetivo.» (expectativas por fases, modelo Acelera tu CRM)

REGLA: la primera factura se emite SOLO cuando los 4 bloques están completos. El cliente que aprueba el guion y conoce al setter no se da de baja en el mes 2.`,
  },
  {
    id: "oferta-entrada-exito",
    categoria: "Pricing",
    para: "Isra",
    titulo: "One-pager: oferta de entrada a éxito (pago por cita válida)",
    descripcion: "La puerta de entrada sin riesgo del primer mes, blindada al estilo japonés (SCALE Lead / dotramo), con números editables.",
    filename: "oferta-entrada-exito.txt",
    contenido: `OFERTA DE ENTRADA A ÉXITO — «El primer mes lo pagas por cita, no por promesa»

QUÉ ES
Primer ciclo (4 semanas) sin mensualidad: el cliente paga [90–120] € + IVA por cada CITA VÁLIDA entregada (según definición contractual). A partir del segundo mes, tarifa estándar: [MENSUALIDAD] €/mes con [N] citas incluidas.

POR QUÉ FUNCIONA (y por qué no nos arruina)
- Elimina la objeción nº1 del cliente quemado: «¿y si pago y no llega nada?»
- El precio por cita del mes 1 es MÁS ALTO que el coste implícito en la mensualidad → la conversión al plan mensual es el ahorro natural.
- Blindajes (copiar el trío SCALE Lead):
  ☐ Filtro de capacidad: solo negocios que puedan atender [10]+ citas/mes (regla Edge Connection).
  ☐ Compromiso de actividad por nuestra parte: [300]+ llamadas/mes documentadas — la garantía es de trabajo medible, no de humo.
  ☐ Tope del piloto: máximo [12] citas facturables en el mes 1 (protege nuestra caja de un éxito descontrolado).

CÓMO SE VENDE (frase del setter)
«El primer mes no me pagas mensualidad: pagas solo cada cita válida que aterrice en tu calendario, a [X] €. Si no entrego, no cobras nada tú ni cobro nada yo. A partir del segundo mes, si te compensa —y te va a compensar—, pasas al plan normal y cada cita te sale más barata.»

LETRA CLARA (en el contrato del piloto)
- Duración del piloto: 4 semanas desde la primera llamada, improrrogable.
- Cita válida: según anexo firmado (misma definición que el plan estándar).
- El paso al plan mensual es opcional para ambas partes.
- Un solo piloto por negocio y zona.

CUÁNDO NO OFRECERLO: cliente que ya viene convencido (directo a mensualidad) o nicho ya validado con 3+ clientes en cartera (ahí la escasez de zona vende sola).
Origen: SCALE Lead (Japón), dotramo (España), LeadsNow AI (Australia).`,
  },
  {
    id: "argumento-calculadora",
    categoria: "Ventas",
    para: "Nidia",
    titulo: "Cálculo «setter en plantilla vs RedVitalia»",
    descripcion: "El marco de SalesArte con números de España listos para soltar en llamada o poner en la landing.",
    filename: "calculo-setter-vs-plantilla.txt",
    contenido: `EL CÁLCULO QUE ENMARCA EL PRECIO — «No nos compares con agencias: compáranos con contratar»

CONTRATAR UN COMERCIAL/SETTER EN PLANTILLA (España, 2026)
- Salario bruto medio puesto junior-medio: ~1.500–1.700 €/mes
- Coste empresa (SS ~30%): ~1.950–2.200 €/mes
- + Vacaciones, bajas, formación, rotación (el puesto rota cada 8-14 meses)
- + Herramientas: telefonía, CRM, datos (~100-150 €/mes)
- + 2-3 meses hasta que produce en serio
→ COSTE REAL: 2.100–2.400 €/mes, con riesgo laboral y sin garantía de volumen.

REDVITALIA
- [MENSUALIDAD] €/mes, sin Seguridad Social, sin rotación, sin herramientas.
- Equipo ya entrenado en [NICHO] que produce desde la semana 1.
- Volumen garantizado por contrato: si no llega, seguimos gratis.
- Exclusividad de zona incluida.
→ AHORRO: [50–60]% frente al puesto en plantilla, con el riesgo invertido.

FRASE PARA LA LLAMADA
«Un setter en nómina te cuesta unos 2.200 € al mes con Seguridad Social, y si no funciona, el problema es tuyo. Nosotros hacemos ese trabajo por [X] €, con volumen garantizado por contrato, y si no llega… el problema es nuestro, no tuyo.»

PARA LA LANDING (bloque comparador)
[Columna A] Comercial en plantilla: 2.200 €/mes · 3 meses de rodaje · riesgo laboral · sin garantía
[Columna B] RedVitalia: [X] €/mes · produce semana 1 · sin nómina · volumen garantizado o seguimos gratis
Origen: SalesArte (Turquía) — «hasta 60% de ahorro vs equipo interno» como arma central de venta.`,
  },
  {
    id: "csv-precios-espana",
    categoria: "Datos",
    para: "Isra",
    titulo: `CSV: los ${spain.length} competidores españoles con precio y garantía`,
    descripcion: "La base española completa en una tabla: precio publicado, EUR, garantía, contrato y amenaza. Para Excel/Sheets (separador ;).",
    filename: "competidores-espana.csv",
    contenido: csvSpain,
  },
  {
    id: "csv-registro-mystery",
    categoria: "Datos",
    para: "Nidia",
    titulo: `CSV: registro de Mystery Shopping (${(mystery.targets || []).length} objetivos precargados)`,
    descripcion: "La hoja de trabajo del mystery: objetivos en orden, identidad a usar y columnas de captura listas para rellenar. Para Excel/Sheets (separador ;).",
    filename: "registro-mystery-shopping.csv",
    contenido: csvMystery,
  },
  {
    id: "kit-landing-zona",
    categoria: "Landing",
    para: "Isra",
    titulo: "Kit de copy: bloque «Comprueba tu zona» para la landing",
    descripcion: "Hero, comprobador de zona, garantías y CTA — el copy completo del bloque de escasez territorial (Horizzon/ReforLeads/Agency MDI).",
    filename: "kit-landing-zona.txt",
    contenido: `KIT DE COPY — BLOQUE «ZONA PROTEGIDA» PARA LA LANDING

HERO
────
Titular: Citas con clientes de tu zona, en tu calendario. Y tu competencia, fuera.
Subtítulo: Un solo [nicho] por zona. Cualificamos por teléfono, te agendamos la reunión y si el volumen no llega, seguimos gratis hasta cumplirlo.
CTA primario: [Comprueba si tu zona está libre →]
CTA secundario: [Ver cómo funciona · 2 min]

BLOQUE COMPROBADOR DE ZONA
──────────────────────────
Título: ¿Está libre tu zona?
Texto: Trabajamos con un único negocio de cada sector por zona. Introduce tu municipio y tu actividad: te decimos en menos de 24 h si la plaza está libre o si hay lista de espera.
[Municipio ▾] [Actividad ▾] [Comprobar disponibilidad]
Microcopy bajo el botón: Sin compromiso. Si está ocupada, puedes entrar en lista de espera.

BLOQUE 3 GARANTÍAS (iconos)
───────────────────────────
🛡️ Zona Protegida — Un solo cliente por sector y zona. Por contrato.
📅 Citas válidas o repuestas — La cita duplicada, falsa o fuera de zona se repone. Por escrito.
⏱️ Volumen o seguimos gratis — Si un ciclo no llega al volumen pactado, trabajamos sin coste hasta cumplirlo.

BLOQUE EXPECTATIVAS (honestidad que vende)
──────────────────────────────────────────
Semanas 1-2: montamos guion, zona y agenda contigo. Semanas 3-4: ritmo objetivo de citas. Sin magia: teléfono, criterio y constancia.

CIERRE
──────
«Cada zona solo tiene una plaza. La tuya, ahora mismo, está [LIBRE].»
[Reservar mi zona →]

Origen: Horizzon Media («comprueba si tu zona está libre»), ReforLeads (mapa de plazas por provincia), Agency MDI (respuesta <24 h), Buda Marketing (claim seco de exclusividad).`,
  },
];

const out = {
  generatedAt: "23/08/2026",
  note: "Materiales generados desde las tácticas verificadas de la base (fichas citadas en cada uno). Personalizar los campos entre [CORCHETES] antes de usar. Los CSV usan separador ; (Excel España).",
  items,
};
writeFileSync(resolve(root, "public/data/recursos.json"), JSON.stringify(out, null, 1) + "\n");
console.log(`recursos.json: ${items.length} recursos · CSV España ${spain.length} filas · CSV mystery ${(mystery.targets || []).length} objetivos`);
