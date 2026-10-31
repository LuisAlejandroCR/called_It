// theme.ts: colors, spacing and touch-target size for the mobile app.
// Hex values are the web app's oklch tokens converted to sRGB, so both apps share one identity:
// white and cool light gray surfaces, navy text, blue actions, small purple accents, turquoise zone.
export const colors = {
  background: "#f4f7fa",
  foreground: "#111e3b",
  card: "#ffffff",
  primary: "#135ae4",
  primaryForeground: "#ffffff",
  secondary: "#e9eff7",
  muted: "#edf0f6",
  mutedForeground: "#4c5666",
  accent: "#dfecff",
  accentForeground: "#003db7",
  destructive: "#be000d",
  destructiveSoft: "#ffe7e4",
  border: "#dde2e8",
  input: "#b7bec7",
  twitch: "#6925d5",
  twitchSoft: "#eeebff",
  success: "#006d23",
  successSoft: "#d8f9dd",
  unknown: "#474d58",
  unknownSoft: "#e5e8ed",
  zone: "#00ebec",
  scrim: "rgba(17, 30, 59, 0.88)",
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;
export const radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const;
/** Minimum touch target: 48 dp covers Android (48) and iOS (44) guidelines. */
export const TOUCH = 48;
