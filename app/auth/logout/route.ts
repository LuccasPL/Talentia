import {supabase} from '@/lib/supabase/server';
import {checkOrigin,apiError,requestOrigin} from '@/lib/server';
import {NextResponse} from 'next/server';
export async function POST(request:Request){try{checkOrigin(request);await (await supabase()).auth.signOut();return NextResponse.redirect(new URL('/login',requestOrigin(request)),303)}catch(e){return apiError(e)}}
