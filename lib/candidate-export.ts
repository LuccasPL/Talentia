import {brazilDate} from './pt-br.ts';
export type ExportCandidate={id:string;name:string;role:string;city:string;phone?:string|null;email?:string|null;source?:string|null;updated?:string|null;verification?:Partial<Record<'phone'|'email'|'city',{at:string;method:string}>>|null;archived?:string|null};
export function csvCell(value:unknown){
 let text=typeof value==='string'?value:'';
 text=text.replace(/\u0000/g,'');
 // Quoting alone does not prevent spreadsheet formula execution.
 if(/^[\s]*[=+\-@]/u.test(text))text="'"+text;
 return '"'+text.replace(/"/g,'""')+'"';
}
const date=(value:unknown)=>typeof value==='string'&&value&&!Number.isNaN(Date.parse(value))?brazilDate(value,true):'';
export function candidateCsv(candidates:ExportCandidate[]){
 const headers=['Identificador','Nome','Cargo','Cidade informada','Telefone','E-mail','Origem do currículo','Importado em (Brasília)','Telefone confirmado em (Brasília)','E-mail confirmado em (Brasília)','Localização confirmada em (Brasília)'];
 const rows=candidates.filter(c=>!c.archived).map(c=>[c.id,c.name,c.role,c.city,c.phone,c.email,c.source,date(c.updated),date(c.verification?.phone?.at),date(c.verification?.email?.at),date(c.verification?.city?.at)]);
 return '\uFEFF'+[headers,...rows].map(row=>row.map(csvCell).join(';')).join('\r\n')+'\r\n';
}
