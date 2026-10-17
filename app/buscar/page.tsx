import {redirect} from 'next/navigation';
import {configured,supabase} from '@/lib/supabase/server';
import SearchPage from './search-page';

export const dynamic='force-dynamic';

export default async function CandidateSearchPage(){
  if(!configured())redirect('/login?next=/buscar');
  const {data:{user},error}=await(await supabase()).auth.getUser();
  if(error||!user)redirect('/login?next=/buscar');
  return <SearchPage/>;
}
