/**
 * Local agent profile enrichment.
 * Maps agent IDs to avatar configuration and description.
 * These are merged into the Agent objects after fetching from the gateway.
 */

export interface AgentProfile {
  description: string;
  /** Icon library + name, e.g. "material:gmail" or "ionicons:mail" */
  avatarIcon?: string;
  /** Override the agent's background color for the avatar */
  avatarColor?: string;
}

export const agentProfiles: Record<string, AgentProfile> = {
  'gmail-manager': {
    description: 'Manages your Gmail inbox',
    avatarIcon: 'material:gmail',
    avatarColor: '#EA4335',
  },
  'gitbot': {
    description: 'Manages your GitHub profile, repos & social',
    avatarIcon: 'material:github',
    avatarColor: '#238636',
  },
};
