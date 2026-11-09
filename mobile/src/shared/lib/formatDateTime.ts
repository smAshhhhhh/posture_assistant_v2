export function formatDateTime(isoDate: string | null): string {
  if (isoDate === null) {
    return '暂无采集';
  }

  const date = new Date(isoDate);

  if (Number.isNaN(date.getTime())) {
    return '时间未知';
  }

  return new Intl.DateTimeFormat('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}
