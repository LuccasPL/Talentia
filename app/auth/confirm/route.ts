import {requestOrigin} from '@/lib/server';
import {configured,supabase} from '@/lib/supabase/server';
import {NextResponse} from 'next/server';
export async function GET(request:Request){if(!configured())return NextResponse.redirect(new URL('/login',requestOrigin(request)));const url=new URL(request.url),token=url.searchParams.get('token_hash'),type=url.searchParams.get('type');if(token&&(type==='email'||type==='recovery')){const {error}=await (await supabase()).auth.verifyOtp({token_hash:token,type});if(!error)return NextResponse.redirect(new URL(type==='recovery'?'/reset-password':'/',requestOrigin(request)))}return NextResponse.redirect(new URL('/login?error=confirmation',requestOrigin(request)))}
