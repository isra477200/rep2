import { receiveLegalContact } from '../../legal-contact-server';
export async function POST(request:Request){return receiveLegalContact(request);}
export async function GET(){return Response.json({service:'RedVitalia contact',configured:true,mode:'native_form',forms:{phone:'cxXcdVJAXp9MBbRpm29d',whatsapp:'XMLHrXNBUMUlHOsFUvJH'},workflow:'6db2318d-76e6-4b9a-9444-5a20f3779ead',note:'La recepción se realiza directamente en los formularios publicados de GoHighLevel. Este endpoint informa de la configuración, no del estado en tiempo real del proveedor.'},{headers:{'Cache-Control':'no-store'}});}
