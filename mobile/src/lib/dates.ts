import { isToday, isYesterday, isThisWeek, isThisYear, format, differenceInMinutes } from 'date-fns';

export function formatTimestamp(dateStr: string): string {
  const date = new Date(dateStr);
  if (isToday(date)) return format(date, 'h:mm a');
  if (isYesterday(date)) return 'Yesterday';
  if (isThisWeek(date)) return format(date, 'EEEE');
  return format(date, 'M/d/yy');
}

export function formatChatDate(dateStr: string): string {
  const date = new Date(dateStr);
  if (isToday(date)) return format(date, 'h:mm a');
  if (isYesterday(date)) return `Yesterday ${format(date, 'h:mm a')}`;
  if (isThisWeek(date)) return format(date, 'EEEE h:mm a');
  if (isThisYear(date)) return format(date, 'MMM d, h:mm a');
  return format(date, 'MMM d, yyyy h:mm a');
}

export function shouldShowDateHeader(current: string, previous: string): boolean {
  return differenceInMinutes(new Date(current), new Date(previous)) > 5;
}
