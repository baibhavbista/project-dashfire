/**
 * Centralized gameplay configuration for Project DashFire
 * Defines constants for game mechanics like player health, movement,
 * and physics properties. This ensures that game balance can be
 */

export const GAME_CONFIG = {
  // Player physics and movement
  PLAYER: {
    // Dimensions
    WIDTH: 32,
    HEIGHT: 64,  // Increased from 48
    
    // Movement speeds
    MAX_SPEED: 300,
    ACCELERATION: 3600,
    FRICTION: 2000,
    
    // Jump mechanics
    JUMP_POWER: 1000,            // Jump height tuned for 64px tall character
    COYOTE_TIME_MS: 80,        // Grace period for jumping after leaving platform
    
    // Dash mechanics
    DASH: {
      POWER: 800,
      DURATION: 150,            // milliseconds
      COOLDOWN: 300,            // milliseconds (longer for network sync)
      MAX_TRAILS: 8,
      TRAIL_FADE_DURATION: 200,
      BUFFER_WINDOW_MS: 100,     // Input buffer window
      DIRECTION_BUFFER_MS: 80,   // Time to wait for directional input after pressing dash
      DIAGONAL_WINDOW_MS: 120,   // Additional time to capture diagonal inputs (increased from 50ms for better reliability)
    },
    
    // Physics
    GRAVITY: {
      DEFAULT: 800,
      FAST_FALL: 1000,
      ASCENDING: 1800,
      HANG_TIME: 800,
      FALLING: 2400,
    },
    
    // Combat
    HEALTH: {
      MAX: 100,
      RESPAWN_TIME: 3000,       // 3 seconds
    },
    
    // Visual
    BOUNCE: 0.1,
  },
  
  // Weapon configuration
  WEAPON: {
    FIRE_RATE: 200,             // milliseconds between shots
  },
  
  // Animation settings
  ANIMATION: {
    // Breathing animation
    BREATHING: {
      MIN_SCALE: 0.98,
      MAX_SCALE: 1.02,
      CYCLE_TIME: 1500,         // 1.5 seconds
    },
    
    // Jump animations
    JUMP: {
      // Anticipation (pre-jump squash)
      ANTICIPATION_SQUASH_SCALE: { x: 1.2, y: 0.8 }, // How much to squash before jumping
      ANTICIPATION_DURATION: 80,                      // How long the squash lasts (in ms)
      
      // Jump stretch (explosive upward motion)
      STRETCH_SCALE: { x: 0.8, y: 1.5 },              // Fixed scale when stretched during jump
      
      // Landing
      LANDING_SQUASH_SCALE: { x: 1.1, y: 0.9 },       // How much to squash on landing (reduced from 1.25, 0.75)
      LANDING_BOUNCE_DURATION: 50,                     // How long to return to normal after landing (reduced from 150)
      
      // Legacy values (kept for compatibility)
      MAX_STRETCH: 1.50,
      MAX_SQUASH: 0.85,
      ANTICIPATION_SQUASH: 0.95,
      STRETCH_SPEED: 15,
      LANDING_DURATION: 100,
    },
    
    // Movement animations
    LEAN_MAX_ANGLE: 5,          // degrees
    LEAN_MULTIPLIER: 0.015,
    
    // Direction indicator
    INDICATOR: {
      OFFSET_Y: 60,             // pixels above player
      FADE_ALPHA: 0.3,
      ACTIVE_ALPHA: 0.8,
      DASH_SCALE: 1.2,
    },
  },
  
  // World settings
  WORLD: {
    WIDTH: 3000,                // Arena width (from WorldGeometry)
    HEIGHT: 1800,               // Arena height (from WorldGeometry)
    CAMERA_DEADZONE: {
      WIDTH: 200,
      HEIGHT: 100,
    },
  },
  
  // UI configuration
  UI: {
    // Health bar
    HEALTH_BAR: {
      WIDTH: 200,
      HEIGHT: 8,
      POSITION: { x: 20, y: 20 },
    },
    
    // Team indicator
    TEAM_INDICATOR: {
      POSITION: { x: 512, y: 30 },
      BG_SIZE: { width: 200, height: 50 },
    },
    
    // Score display
    SCORE: {
      POSITION: { x: 512, y: 80 },
    },
    
    // Kill feed
    KILL_FEED: {
      POSITION: { x: 1014, y: 600 },
      MESSAGE_HEIGHT: 25,
      MAX_MESSAGES: 5,
      FADE_DELAY: 5000,
      FADE_DURATION: 500,
    },
    
    // Respawn timer
    RESPAWN_TIMER: {
      POSITION: { x: 512, y: 300 },
    },
    
    // Font settings
    FONT: {
      FAMILY: 'Arial, sans-serif',
      SIZE: {
        SMALL: '12px',
        MEDIUM: '14px',
        LARGE: '16px',
        XLARGE: '20px',
        XXLARGE: '28px',
      },
    },
  },
  
  // Particle effects
  PARTICLES: {
    // Dust particles
    DUST: {
      SCALE: { start: 0.05, end: 0.15 },
      SPEED: { min: 30, max: 60 },
      LIFESPAN: 400,
      JUMP_QUANTITY: 5,
      RUN_CHANCE: 0.1,
    },
    
    // Hit effect
    HIT: {
      COUNT: 5,
      SIZE: 3,
      SPEED: { min: 100, max: 200 },
      DURATION: 500,
    },
    
    // Death effect
    DEATH: {
      COUNT: 15,
      SIZE: 4,
      SPEED: { min: 150, max: 300 },
      DURATION: 800,
      RING_SCALE: 4,
      RING_DURATION: 600,
    },
    
    // Bullet impact
    IMPACT: {
      COUNT: 3,
      SIZE: 2,
      SPEED: { min: 50, max: 100 },
      DURATION: 300,
    },
  },
  
  // Network settings
  NETWORK: {
    TICK_RATE: 60,              // Hz
    RECONCILIATION_SPEED: 0.3,
    PREDICTION_ERROR_SNAP: 100, // Snap if error > this
    DASH_PREDICTION_TOLERANCE: 300,
    UPDATE_RATE: 16,            // ~60Hz in milliseconds
    INTERPOLATION: {
      DEFAULT: 0.2,
      DASH: 0.4,
      LARGE_DISTANCE: 0.5,
      MEDIUM_DISTANCE: 0.3,
      TRANSITION: 0.25
    },
    PREDICTION: {
      TIME_DEFAULT: 0.05, // 50ms ahead
      TIME_DASH: 0.03, // 30ms ahead during dash
      JUMP_VELOCITY_THRESHOLD: -200,
      LANDING_TIME_WINDOW: 0.3, // 300ms
      VELOCITY_SMOOTH_FACTOR: 0.3
    }
  },
  
  // Visual effects
  EFFECTS: {
    CAMERA_FLASH_DURATION: 100,
    VIGNETTE_GRADIENT_WIDTH: 200,
    ATMOSPHERIC_PARTICLES: 20,
    GEOMETRIC_PATTERNS: 10,
  },
  
  // Game rules
  RULES: {
    MAX_PLAYERS: 8,
    TEAMS: ['red', 'blue'] as const,
    FRIENDLY_FIRE: false,
    MATCH_DURATION: 300000,     // 5 minutes in milliseconds
    SCORE_LIMIT: 30,
  },
} as const;

// Type exports for better type safety
export type Team = typeof GAME_CONFIG.RULES.TEAMS[number];

// Helper functions
export function getSpawnPosition(team: Team): { x: number, y: number } {
  return team === 'red' 
    ? { x: 200, y: 500 }
    : { x: 2800, y: 500 };
} 