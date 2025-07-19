/**
 * Centralized color configuration for Project SlingFire
 * All colors follow the Thomas Was Alone minimalist aesthetic
 */

export const COLORS = {
  // Background and atmospheric colors
  BACKGROUND: {
    MAIN: 0x39447C,           // Deep, moody purple (from Thomas Was Alone)
    SECONDARY: 0x3d3a50,      // Atmospheric patterns (adjusted for purple)
    VIGNETTE: 0x1a1828,       // Darker purple for edges
    FOG: 0x1E1E1E,            // Ambient fog (not used yet)
  },

  // Platform colors
  PLATFORMS: {
    MAIN: 0x2B2B2B,           // Main arena floor
    ELEVATED: 0x3A3A3A,       // Elevated platforms
    EDGE: 0x4A4A4A,           // Platform edge highlights
  },

  // Team colors
  TEAMS: {
    RED: {
      PRIMARY: 0xE74C3C,      // Vibrant red for player
      GLOW: 0xFF6B6B,         // Bright red for effects/bullets
      DARK: 0xC0392B,         // Darker red (for damaged state - future)
    },
    BLUE: {
      PRIMARY: 0x3498DB,      // Vibrant blue for player
      GLOW: 0x5DADE2,         // Bright blue for effects/bullets
      DARK: 0x2980B9,         // Darker blue (for damaged state - future)
    },
  },

  // UI colors
  UI: {
    // Health bar colors
    HEALTH_GOOD: 0x2ECC71,    // Green
    HEALTH_WARNING: 0xF1C40F, // Yellow
    HEALTH_CRITICAL: 0xE74C3C,// Red
    HEALTH_BG: 0x2B2B2B,      // Health bar background
    
    // Text colors
    TEXT_PRIMARY: '#ffffff',   // Pure white
    TEXT_MUTED: '#999999',     // Muted gray
    TEXT_DEBUG: '#00ff00',     // Debug green
    
    // UI backgrounds
    UI_BG: 0x1A1A1A,          // Dark background for UI elements
    UI_BG_ALPHA: 0.8,         // Alpha for UI backgrounds
  },

  // Effect colors
  EFFECTS: {
    HIT: 0xff0000,            // Red hit effect
    DUST: 0x4A4A4A,           // Platform dust (matches edge color)
    BULLET_IMPACT: 0x666666,  // Gray bullet impact
    PARTICLE: 0x333333,       // General particle color
    WHITE: 0xFFFFFF,          // Pure white for flashes/indicators
  },

  // Legacy colors (to be cleaned up)
  LEGACY: {
    CYAN_TEAM: 0x4ECDC4,      // Old cyan team color - should be removed
  }
} as const;

// Type-safe color getter for team colors
export function getTeamColors(team: 'red' | 'blue') {
  return team === 'red' ? COLORS.TEAMS.RED : COLORS.TEAMS.BLUE;
}

// Convert hex color to CSS string
export function hexToCSS(hex: number): string {
  return `#${hex.toString(16).padStart(6, '0')}`;
} 