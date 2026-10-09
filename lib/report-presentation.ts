export type ReportSection={title:string;content:string};
const headings=new Set(['EXPERIÊNCIA DECLARADA','RELAÇÃO COM OS CRITÉRIOS','INFORMAÇÕES A CONFIRMAR','REGISTROS DA RECRUTADORA','PARECER DA RECRUTADORA']);
export function reportSections(text:string):ReportSection[]{
 const lines=text.replace(/\r\n/g,'\n').split('\n');
 // Strip only the known draft banner and identity line; preserve custom text.
 if(lines[0]==='PARECER PARA REVISÃO'){lines.splice(0,2);if(lines.at(0)==='')lines.shift()}
 const sections:ReportSection[]=[];let title='Parecer',content:string[]=[];
 const flush=()=>{if(content.join('\n').trim())sections.push({title,content:content.join('\n').trim()});content=[]};
 for(const line of lines){if(headings.has(line.trim())){flush();title=line.trim()}else content.push(line)}
 flush();return sections;
}
