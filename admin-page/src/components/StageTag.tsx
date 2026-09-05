import type { Stage, Ticket } from '../types';
import { MAIN_STAGES, STAGE_META, stageIndex, stageOf } from '../domain/ticket';

export function StageTag({ stage }: { stage: Stage }) {
  const meta = STAGE_META[stage];
  return (
    <span className="ac-stage" style={{ color: meta.color, background: meta.bg }}>
      <i style={{ background: meta.color }} />
      {meta.label}
    </span>
  );
}

export function TicketStageTag({ ticket }: { ticket: Ticket }) {
  return <StageTag stage={stageOf(ticket)} />;
}

/** 详情用横向进度：拒绝态标出被拒的那一步 */
export function StageSteps({ ticket }: { ticket: Ticket }) {
  const stage = stageOf(ticket);
  const idx = stageIndex(ticket);
  return (
    <div className="ac-steps">
      {MAIN_STAGES.map((s, i) => {
        const done = i < idx;
        const current = i === idx;
        const rejected = stage === 'REJECTED' && current;
        const meta = STAGE_META[s];
        return (
          <div
            key={s}
            className={`ac-steps__item${done ? ' is-done' : ''}${current ? ' is-current' : ''}${rejected ? ' is-rejected' : ''}`}
          >
            <span className="ac-steps__dot">
              {done ? '✓' : rejected ? '×' : i + 1}
            </span>
            <span className="ac-steps__label" style={current ? { color: meta.color } : undefined}>
              {meta.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function StageLegend() {
  return (
    <div className="ac-legend">
      {(['ANALYZING', 'DEVELOPING', 'VERIFYING', 'DEPLOYING', 'DONE', 'REJECTED'] as Stage[]).map((s) => (
        <span key={s} className="ac-legend__item" title={STAGE_META[s].desc}>
          <StageTag stage={s} />
          <em>{STAGE_META[s].desc}</em>
        </span>
      ))}
    </div>
  );
}
