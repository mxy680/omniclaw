const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

function formatTime(hour: number, minute: number): string {
  const ampm = hour >= 12 ? "PM" : "AM";
  const h = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${h}:${pad(minute)} ${ampm}`;
}

export function cronToHuman(cron: string): string {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return cron;

  const [minute, hour, dom, month, dow] = parts;

  // Every N minutes: */N * * * *
  if (minute.startsWith("*/") && hour === "*" && dom === "*" && month === "*" && dow === "*") {
    const n = parseInt(minute.slice(2), 10);
    if (n === 1) return "Every minute";
    return `Every ${n} minutes`;
  }

  const min = parseInt(minute, 10);
  const hr = parseInt(hour, 10);
  if (isNaN(min) || isNaN(hr)) return cron;

  const time = formatTime(hr, min);

  // Daily: M H * * *
  if (dom === "*" && month === "*" && dow === "*") {
    return `Every day at ${time}`;
  }

  // Weekly: M H * * D
  if (dom === "*" && month === "*" && dow !== "*") {
    const dayNum = parseInt(dow, 10);
    const dayName = DAYS[dayNum];
    if (dayName) return `Every ${dayName} at ${time}`;
    return `Every ${dow} at ${time}`;
  }

  // Monthly: M H D * *
  if (dom !== "*" && month === "*" && dow === "*") {
    const d = parseInt(dom, 10);
    const suffix = d === 1 ? "st" : d === 2 ? "nd" : d === 3 ? "rd" : "th";
    return `${d}${suffix} of every month at ${time}`;
  }

  return cron;
}
