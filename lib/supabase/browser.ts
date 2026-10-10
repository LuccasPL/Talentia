'use client';
import {createBrowserClient} from '@supabase/ssr';
export function browserClient(){return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,{cookieOptions:{secure:process.env.NODE_ENV==='production',sameSite:'lax'}})}
