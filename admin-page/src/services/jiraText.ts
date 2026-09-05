import type { Case, Project, Ticket } from '../types';
import { FINDING_TYPE_META, SEVERITY_META } from '../domain/ticket';

/**
 * 生成可直接粘贴进 JIRA 的描述：中台不复制 JIRA 详情页（§9.4），
 * 但要把证据一次性带过去，省掉人工整理。
 */
export function buildJiraDescription(ticket: Ticket, kase: Case, project?: Project): string {
  const finding = kase.findings[0];
  const line = (label: string, value: string) => `*${label}*：${value}`;
  return [
    ticket.title,
    '',
    kase.description,
    '',
    '---- 以下为 AI Sherlock 中台自动附带证据 ----',
    line('Case Key', ticket.caseKey),
    line('Finding Key', ticket.findingKey),
    line('项目 / 服务', `${project?.name ?? '—'} · ${ticket.service}`),
    line('页面', kase.pageUrl),
    line('Build Version', kase.buildVersion),
    line('环境 / 严重程度', `${ticket.environment} / ${SEVERITY_META[ticket.severity].label}`),
    line('类型', FINDING_TYPE_META[ticket.findingType].label),
    '',
    '【Network 证据】',
    ...ticketRows(kase.network.map((e) => `${e.label} — ${e.detail}`)),
    '',
    '【Console 证据】',
    ...ticketRows(kase.consoleLogs.map((e) => `${e.label} — ${e.detail}`)),
    '',
    '【异常堆栈】',
    ...ticketRows(kase.stacks.map((e) => `${e.label} — ${e.detail}`)),
    '',
    '【AI 诊断结论】',
    finding ? line('Root Cause', finding.rootCause) : '',
    finding ? line('置信度', `AI ${finding.aiConfidence} / System ${finding.systemConfidence}`) : '',
    finding ? line('建议修复', finding.recommendedFix) : '',
    finding ? line('涉及文件', finding.locations.map((l) => `${l.file}:${l.line}`).join('、')) : '',
    '',
    `【证据回溯】${kase.evidenceChain.map((n) => n.node).join(' → ')}`,
  ]
    .filter((l) => l !== undefined)
    .join('\n');
}

function ticketRows(rows: string[]) {
  return rows.length ? rows.map((r) => `- ${r}`) : ['- （无）'];
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // 非安全上下文回退：document.execCommand 仍可用
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  }
}
