const zone='America/Sao_Paulo';
export function brazilDate(value:string,withTime=false){
 const date=new Date(value);
 if(!value||Number.isNaN(date.getTime()))return 'Data não informada';
 return new Intl.DateTimeFormat('pt-BR',{timeZone:zone,day:'2-digit',month:'2-digit',year:'numeric',...(withTime?{hour:'2-digit',minute:'2-digit'} as const:{})}).format(date);
}
