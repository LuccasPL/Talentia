import Workspace from './workspace';
import {redirect} from 'next/navigation';
import {configured,supabase} from '@/lib/supabase/server';
export const dynamic='force-dynamic';
export default async function Home(){if(!configured())redirect('/login');const {data:{user},error}=await (await supabase()).auth.getUser();if(error||!user)redirect('/login');return <Workspace/>}
