import {Check} from 'lucide-react';

const steps = [
  {title: 'Descreva a vaga', hint: 'Conte o que o cliente precisa. Você pode escrever livremente e salvar um rascunho.'},
  {title: 'Revise os critérios', hint: 'Ajuste os pontos importantes e filtre a base antes de comparar os perfis.'},
  {title: 'Explore os candidatos', hint: 'Confira as evidências e abra os perfis para registrar contato, entrevista e parecer.'},
];

export default function JobFlow({stage}: {stage: number}) {
  const current = Math.max(0, Math.min(stage, steps.length - 1));
  return <section className="job-flow" aria-label="Etapas da vaga">
    <ol>{steps.map((step, index) => <li key={step.title} aria-current={current === index ? 'step' : undefined} className={index < current ? 'completed' : ''}>
      <span className="job-flow-number" aria-hidden="true">{index < current ? <Check size={16}/> : index + 1}</span>
      <span>{step.title}</span>
    </li>)}</ol>
    <p><strong>Etapa {current + 1} de 3.</strong> {steps[current].hint}</p>
  </section>;
}
