import 'server-only';
import {createHash} from 'node:crypto';
import type {Data,RecordData} from './domain';
import {reportSources,reportReviewNeeded,reconcileReportReviews,type ReportApproval} from './report-review';

function sourceHashes(data:Data){
 const source=reportSources(data);
 return (record:RecordData)=>{const text=source(record);return text===null?null:createHash('sha256').update(text).digest('hex');};
}
/** Recheck on every read, including private print pages and client presentations. */
export function checkReportReviews(data:Data):Data {
 const hash=sourceHashes(data);
 return {...data,records:data.records.map(r=>({...r,reportNeedsReview:reportReviewNeeded(r,r.report.trim()?hash(r):null)}))};
}
export function saveReportReviews(current:Data,next:Data,approval?:ReportApproval){
 return reconcileReportReviews(current,next,sourceHashes(next),approval,new Date().toISOString());
}
