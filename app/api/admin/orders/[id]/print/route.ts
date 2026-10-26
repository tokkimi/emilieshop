import { NextResponse } from 'next/server';
import { getChatGPTUser } from '../../../../../chatgpt-auth';
import { isAdmin } from '../../../../../../lib/admin-auth';
export const dynamic = 'force-dynamic';
async function retired() {
  const user = await getChatGPTUser();
  if (!(await isAdmin(user))) return NextResponse.json({error:'Accès refusé'},{status:403});
  return NextResponse.json({error:'Cette connexion d’impression a été retirée. Utilisez les ateliers Mpix et Prodigi.',code:'PRINT_PROVIDER_RETIRED'},{status:410});
}
export const GET = retired;
export const POST = retired;
