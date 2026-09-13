import { receiveLegalContact, legalContactWebhook } from '../../legal-contact-server';
export async function POST(request:Request){return receiveLegalContact(request);}
export async function GET(){return Response.json({service:'RedVitalia contact',configured:!!legalContactWebhook(process.env.REDVITALIA_GHL_WEBHOOK_URL)},{headers:{'Cache-Control':'no-store'}});}
