import type {Job} from './domain';
import type {ShortlistItem} from './candidate-shortlist';

export function comparisonItems(job: Job, items: ShortlistItem[], ids: string[]) {
  if (ids.length < 2 || ids.length > 3 || new Set(ids).size !== ids.length) {
    throw Error('Escolha de dois a três perfis diferentes.');
  }
  const eligible = new Map(items.filter(i => i.record.jobId === job.id && i.record.candidateId === i.candidate.id && i.record.shortlisted && !i.candidate.mergedInto).map(i => [i.candidate.id, i]));
  return ids.map(id => {
    const item = eligible.get(id);
    if (!item) throw Error('Um perfil não está mais na lista desta vaga. Revise a seleção.');
    return item;
  });
}

export function criterionComparison(item: ShortlistItem, criterion: Job['criteria'][number]) {
  const evidence = item.analysis?.candidateId === item.candidate.id ? item.analysis.evidence.find(e => e.criterionId === criterion.id) : undefined;
  // Conditions and interpersonal traits always need human confirmation.
  const found = criterion.kind === 'experiencia' && evidence?.status === 'encontrada' && Boolean(evidence.quote.trim());
  return {
    label: found ? 'Trecho encontrado' : !item.analysis ? 'Ainda não comparado' : 'A confirmar',
    found,
    quote: evidence?.quote || '',
    explanation: evidence?.explanation || '',
    question: evidence?.question || '',
  };
}
