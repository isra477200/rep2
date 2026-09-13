import { chapters, profiles, scripts, evidence, sourceNotes } from './legal-acquisition-content.ts';

export type LegalContext = { profile: string; zona: string; despacho: string; nombre: string; asesor: string; contacto: string; observacion: string; enlaceDiagnostico: string; cita: string; enlaceReunion: string };
export const defaultContext: LegalContext = { profile: 'segunda-oportunidad', zona: '', despacho: '', nombre: '', asesor: '', contacto: 'WhatsApp: +34 919 935 237', observacion: '', enlaceDiagnostico: '', cita: '', enlaceReunion: '' };
export const contextLabels: Record<Exclude<keyof LegalContext, 'profile'>, string> = { zona: 'Ciudad o provincia', despacho: 'Nombre del despacho', nombre: 'Nombre de quien decide', asesor: 'Tu nombre', contacto: 'Tu email o teléfono profesional', observacion: 'Observación real de su web', enlaceDiagnostico: 'Enlace al diagnóstico preparado', cita: 'Fecha, hora y zona horaria de reunión', enlaceReunion: 'Enlace de reunión' };
export function fillText(text: string, context: LegalContext): string {
 const profile = profiles.find(p => p.id === context.profile) ?? profiles[0];
 const values: Record<string, string> = { ...context, especialidad: profile.name, tituloCliente: profile.consumerTitle, introCliente: profile.consumerIntro };
 return text.replace(/\{\{(\w+)\}\}/g, (_, key: string) => values[key]?.trim() || `[${contextLabels[key as keyof typeof contextLabels] ?? key}]`);
}
export function pendingFields(text: string): string[] { return [...new Set(text.match(/\[[^\]\n]+\]/g) ?? [])]; }
export function readSavedContext(value: unknown): LegalContext {
 const result = { ...defaultContext };
 if (!value || typeof value !== 'object') return result;
 for (const key of Object.keys(result) as (keyof LegalContext)[]) {
  const item = (value as Record<string, unknown>)[key];
  if (typeof item === 'string') result[key] = item.slice(0, key === 'observacion' ? 1500 : 350);
 }
 if (!profiles.some(p => p.id === result.profile)) result.profile = defaultContext.profile;
 result.contacto = result.contacto.replace(/637[ \u00a0.-]*371[ \u00a0.-]*993/g, '919 935 237');
 return result;
}
export function readSavedProgress(value: unknown): string[] { return Array.isArray(value) ? [...new Set(value.filter((id): id is string => typeof id === 'string' && chapters.some(c => c.id === id)))] : []; }
export function searchText(value: string): string { return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es'); }
export function matchingScripts(query: string, chapter?: string) { const q = searchText(query.trim()); return scripts.filter(s => (!chapter || s.chapter === chapter) && (!q || searchText(`${s.id} ${s.title} ${s.kind} ${s.when} ${s.text}`).includes(q))); }

export type EconomicsInput = { ticket: number; margin: number; close: number; media: number; setup: number; tools: number; share: number };
export function clientEconomics(input: EconomicsInput) {
 const {ticket, margin, close, media, setup, tools, share} = input;
 if (!Object.values(input).every(Number.isFinite) || ticket <= 0 || margin <= 0 || margin > 100 || close <= 0 || close > 100 || media < 0 || setup < 0 || tools < 0 || share <= 0 || share > 100) return null;
 const contribution = ticket * margin / 100;
 const cost = media + 400 + setup + tools;
 const maxCac = contribution * share / 100;
 return { contribution, cost, breakEvenCases: Math.ceil(cost / contribution), maxCac, maxValidQuery: maxCac * close / 100, feeNet: 400, feeVat: 84, feeGross: 484 };
}
export function buildDossier(context: LegalContext): string {
 const profile = profiles.find(p => p.id === context.profile) ?? profiles[0];
 const lines = ['# RedVitalia · Captar despachos de abogados', 'Edición: 13/09/2026 · España · Manual comercial y de entrega', `Especialidad: ${profile.name} · Zona: ${context.zona || '[Ciudad o provincia por elegir]'}`, 'Este material propone un proceso para validar. No garantiza clientes. Los textos entre corchetes requieren datos reales; las imágenes son ilustrativas. No se han enviado mensajes ni activado campañas desde este apartado.', `## Perfil elegido\n${profile.target}\n\n${profile.problem}\n\nEnfoque: ${profile.angle}`, `## Filtro específico\n${profile.qualification.map(t => '- ' + t).join('\n')}\n\n${profile.exclusions.map(t => '- ' + t).join('\n')}`, `## Búsquedas del despacho\n${profile.keywords.map(t => '- ' + t.replace('[zona]', context.zona || '[zona]')).join('\n')}`];
 for (const chapter of chapters) {
  lines.push(`## ${chapter.label}: ${chapter.title}`, chapter.intro, ...chapter.actions.map((t,i) => `${i+1}. ${fillText(t,context)}`), `Paso terminado cuando: ${chapter.done}`);
  for (const script of scripts.filter(s => s.chapter === chapter.id)) lines.push(`### ${script.title} · ${script.kind}`, `Uso: ${script.when}`, fillText(script.text,context));
 }
 lines.push('## Qué aprovechamos del panel');
 for (const item of evidence) lines.push(`### ${item.name} · ${item.status}`, `Observación: ${item.observed}`, `Aplicación propuesta: ${item.apply}`, `Límite: ${item.limit}`, `Fuente: ${item.url}`);
 lines.push('## Fuentes y criterios de uso');
 for (const source of sourceNotes) lines.push(`[${source.title}](${source.url.startsWith('/') ? 'https://redvitalia.srv1480016.hstgr.cloud' + source.url : source.url}) · ${source.note}`);
 lines.push('## Creativos originales', 'Generados con el modelo de imagen integrado (habilidad imagegen), 13/09/2026. Ilustraciones publicitarias B2B, no instalaciones ni clientes reales. Destino y campañas pendientes de configurar.', 'Creativo A: https://redvitalia.srv1480016.hstgr.cloud/abogados/creativo-seguimiento.png', 'Creativo B: https://redvitalia.srv1480016.hstgr.cloud/abogados/creativo-recorrido.png');
 return lines.join('\n\n');
}
export const prospectCsv = '\uFEFFid;despacho;especialidad;zona;url_fuente;fecha_revision;contacto_profesional;cargo;origen_y_legitimacion;permiso_fecha_y_alcance;oposicion;encaje_0_10;motivo_prioridad;etapa;responsable;ultimo_contacto;proximo_paso;fecha_proximo_paso;importe_neto;coste_comercial;resultado;motivo_perdida\r\n';
