import type {RecordData} from './domain';
/** Keep deliberate unsaved contact edits while accepting server-owned metadata. */
export function refreshRecordDraft(draft:RecordData,before:RecordData,after:RecordData):RecordData{
 const next={...after};for(const key of ['status','interest','availability','notes'] as const)if(draft[key]!==before[key])next[key]=draft[key];return next;
}
