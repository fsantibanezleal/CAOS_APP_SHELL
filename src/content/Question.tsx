import type { ReactNode } from 'react';

export interface QuestionProps {
  /** The business question the executive would ask. */
  question: ReactNode;
  /** The plain answer, with the evidence and the honest limits. */
  answer: ReactNode;
}

/**
 * One question and its answer (ADR-0017 section 2.1, executive view, area `credibility`), rendered as `data-qa` with
 * `data-question` and `data-answer` so the gate can count the pairs that hold both.
 */
export function Question({ question, answer }: QuestionProps) {
  return (
    <div className="caos-qa" data-qa="">
      <p className="caos-qa-question" data-question="">
        {question}
      </p>
      <div className="caos-qa-answer" data-answer="">
        {answer}
      </div>
    </div>
  );
}
