import AuthForm from '../login/auth-form';
import {configured} from '@/lib/supabase/server';
export const dynamic='force-dynamic';
export default function Reset(){return <AuthForm configured={configured()} reset/>}
