import type {Candidate} from './domain';
import type {SearchMatch} from './assisted-search';

export type VacancyCandidatePage={
 total:number;
 candidateIds:string[];
 candidates:Candidate[];
 matches?:SearchMatch[];
 page:number;
 pageSize:24;
};
