import type {Metadata} from 'next';
import CandidateUpdateForm from './update-form';
export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Atualize seus dados | Talentia',robots:{index:false,follow:false}};
export default function UpdatePage(){return <main className="candidate-public-shell"><CandidateUpdateForm/></main>}
