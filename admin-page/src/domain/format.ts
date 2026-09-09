const pad = (n: number) => String(n).padStart(2, '0');

export function fmtDateTime(v?: string): string {
  if (!v) return '—';
  const d = new Date(v);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fmtShort(v?: string): string {
  if (!v) return '—';
  const d = new Date(v);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function timeAgo(v?: string): string {
  if (!v) return '从未';
  const diff = Date.now() - new Date(v).getTime();
  if (diff < 0) return '刚刚';
  const min = Math.floor(diff / 60000);
  if (min < 1) return '刚刚';
  if (min < 60) return `${min} 分钟前`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour} 小时前`;
  const day = Math.floor(hour / 24);
  if (day < 30) return `${day} 天前`;
  return fmtDateTime(v).slice(0, 10);
}

/** 只保留日期，用于表格里紧凑展示 */
export function fmtDay(v?: string): string {
  return fmtDateTime(v).slice(5, 10);
}
