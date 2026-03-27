export const COLORS = {
  bg: {
    primary: '#08080d',    // Deepest background
    secondary: '#0e0e16',  // Panel background
    tertiary: '#14141f',   // Elevated surface
    hover: '#1c1c2e',      // Hover state
    active: '#252540',     // Active/selected row
  },
  text: {
    primary: '#d4d4e0',    // Main text
    secondary: '#7a7a95',  // Muted
    muted: '#4a4a60',      // Very muted
    bright: '#f0f0ff',     // Emphasized text
  },
  accent: {
    green: '#00e676',      // Profit / Buy / Up
    red: '#ff3d3d',        // Loss / Sell / Down
    blue: '#448aff',       // Links / Interactive
    amber: '#ffab00',      // Warnings / Pending
    cyan: '#00e5ff',       // Info highlight
    purple: '#b388ff',     // Options / Special
  },
  border: {
    default: '#1e1e30',    // Panel borders
    light: '#2a2a42',      // Lighter borders
    focus: '#448aff',      // Focus rings
  },
} as const;
