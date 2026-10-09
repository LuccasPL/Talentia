import {requestOrigin} from '@/lib/server';
import {configured,supabase} from '@/lib/supabase/server';
import {NextResponse} from 'next/server';
export async function GET(request:Request){if(!configured())return NextResponse.redirect(new URL('/login',requestOrigin(request)));const url=new URL(request.url),code=url.searchParams.get('code');if(code){const {error}=await (await supabase()).auth.exchangeCodeForSession(code);if(!error)return NextResponse.redirect(new URL(url.searchParams.get('next')==='/reset-password'?'/reset-password':'/',requestOrigin(request)))}return NextResponse.redirect(new URL('/login?error=confirmation',requestOrigin(request)))}
