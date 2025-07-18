/**
 * Shared game constants between client and server
 * This ensures consistency in physics and gameplay mechanics
 */

export const SHARED_CONFIG = {
  BULLET: {
    SPEED: 700,          // Pixels per second
    WIDTH: 10,
    HEIGHT: 6,
    LIFETIME_MS: 3000,   // Bullets disappear after 3 seconds
    DAMAGE: 10           // Damage per hit
  },
  
  WEAPON: {
    FIRE_RATE_MS: 200    // Minimum time between shots
  }
}; 