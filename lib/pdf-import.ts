export const MAX_PDF_BYTES=2*1024*1024;
export type ImportRow={id:string;source:string;status:'sending'|'processing'|'completed'|'failed';error:string;created_at:string;checked_at?:string|null;candidate_id:string};
export const importLabels={sending:'Enviando para leitura',processing:'Em processamento',completed:'Importado',failed:'Precisa de atenção'};
export function pdfProblem(file:{name:string;size:number}){if(!/\.pdf$/i.test(file.name))return 'Selecione um arquivo PDF.';if(file.size===0)return 'O arquivo está vazio.';if(file.size>MAX_PDF_BYTES)return 'O PDF ultrapassa o limite de 2 MB.';return '';}
export type BatchLine={custom_id:string;result:{type:string;message?:{stop_reason:string;content:{type:string;text?:string}[]}}};
export function batchExtraction(lines:string,expectedId:string):unknown{
 const line=lines.trim().split('\n').map(s=>JSON.parse(s) as BatchLine).find(r=>r.custom_id===expectedId);
 if(!line||line.result.type!=='succeeded')throw Error('A leitura não foi concluída. Você pode tentar novamente.');
 const message=line.result.message;
 if(!message||message.stop_reason!=='end_turn')throw Error('A leitura ficou incompleta. Tente um PDF mais simples.');
 return JSON.parse(message.content.filter(c=>c.type==='text').map(c=>c.text||'').join(''));
}
