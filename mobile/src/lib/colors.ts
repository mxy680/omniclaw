const AGENT_COLORS: Record<string, string> = {
  blue: '#007AFF',
  green: '#34C759',
  orange: '#FF9500',
  purple: '#AF52DE',
  red: '#FF3B30',
  teal: '#5AC8FA',
  indigo: '#5856D6',
  pink: '#FF2D55',
};

export function agentColor(colorName: string): string {
  return AGENT_COLORS[colorName] ?? AGENT_COLORS.blue;
}
