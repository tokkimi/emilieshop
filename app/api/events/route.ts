import { NextResponse } from 'next/server';
import { getDb } from '../../../db';
import { analyticsEvents } from '../../../db/schema';
export async function POST(request:Request){const input=await request.json() as {visitorId?:string;event?:string;path?:string;metadata?:unknown};if(!input.visitorId||!input.event||!input.path)return NextResponse.json({error:'Événement incomplet'},{status:400});await getDb().insert(analyticsEvents).values({id:crypto.randomUUID(),visitorId:String(input.visitorId).slice(0,100),eventName:String(input.event).slice(0,80),path:String(input.path).slice(0,300),metadataJson:JSON.stringify(input.metadata||{}).slice(0,4000),createdAt:new Date()});return NextResponse.json({ok:true},{status:201})}
