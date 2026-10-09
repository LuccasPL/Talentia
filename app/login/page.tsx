import AuthForm from './auth-form';
import {configured} from '@/lib/supabase/server';
export const dynamic='force-dynamic';
export default function Login(){return <AuthForm configured={configured()}/>}
