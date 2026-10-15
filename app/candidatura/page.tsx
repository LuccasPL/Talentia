import type {Metadata} from 'next';
import ApplicationForm from './application-form';
export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Envie sua candidatura | Talentia',robots:{index:false,follow:false}};
export default function ApplicationPage(){return <main className="candidate-public-shell"><ApplicationForm/></main>}
