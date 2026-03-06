export interface Agent {
  id: string;
  name: string;
  role: string;
  colorName: string;
  services: string[];
  description?: string;
  /** Icon spec, e.g. "material:gmail" or "ionicons:mail" */
  avatarIcon?: string;
  /** Override avatar background color (hex) */
  avatarColor?: string;
}
