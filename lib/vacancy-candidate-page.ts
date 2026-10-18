import type {Candidate} from './domain';

export type VacancyCandidatePage={
 total:number;
 candidateIds:string[];
 candidates:Candidate[];
 page:number;
 pageSize:24;
};
