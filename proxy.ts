import {createServerClient} from '@supabase/ssr';
import {NextResponse,type NextRequest} from 'next/server';
import {contentSecurityPolicy} from './lib/http-security';
export async function proxy(request:NextRequest){
 const nonce=Buffer.from(crypto.randomUUID()).toString('base64');
 const csp=contentSecurityPolicy(nonce,process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NODE_ENV==='development');
 const headers=new Headers(request.headers);headers.set('x-nonce',nonce);headers.set('Content-Security-Policy',csp);
 let response=NextResponse.next({request:{headers}});
 if(process.env.NEXT_PUBLIC_SUPABASE_URL&&process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY){
  const client=createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,{cookies:{
   getAll:()=>request.cookies.getAll(),
   setAll:values=>{values.forEach(({name,value})=>request.cookies.set(name,value));headers.set('cookie',request.cookies.toString());response=NextResponse.next({request:{headers}});values.forEach(({name,value,options})=>response.cookies.set(name,value,{...options,secure:process.env.NODE_ENV==='production',sameSite:'lax'}));}
  }});await client.auth.getClaims();
 }
 response.headers.set('Cache-Control','private, no-store');response.headers.set('Content-Security-Policy',csp);return response;
}
export const config={matcher:['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)']};
