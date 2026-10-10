// Import results must never replace profiles edited while a check was running.
export function mergeImportedProfiles<T extends {id:string}>(current:T[],incoming:T[]):T[]{
 const known=new Set(current.map(profile=>profile.id));
 return [...current,...incoming.filter(profile=>{
  if(known.has(profile.id))return false;
  known.add(profile.id);return true;
 })];
}

// One shared monitor owns automatic and manual checks, including dialog updates.
export function singleImportCheck<T>(check:()=>Promise<T>){
 let pending:Promise<T>|undefined;
 return ()=>{
  if(pending)return pending;
  const result=Promise.resolve().then(check);
  pending=result;
  void result.then(()=>{pending=undefined},()=>{pending=undefined});
  return result;
 };
}
