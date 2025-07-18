import { PlayerTextureManager } from './PlayerTextureManager';
import { Team } from '../config/GameConfig';

/**
 * Shared interface for consistent bullet spawning across all player types
 */
export class PlayerBulletInterface {
  /**
   * Calculate bullet spawn position for any player
   * @param playerX Player X position
   * @param playerY Player Y position  
   * @param direction -1 for left, 1 for right
   * @param team Player's team for color
   * @returns Bullet spawn data
   */
  static getBulletSpawnData(
    playerX: number, 
    playerY: number, 
    direction: number, 
    team: Team
  ): {
    x: number;
    y: number;
    color: number;
  } {
    // Get gun offsets from texture manager
    const gunXOffset = PlayerTextureManager.getGunTipOffset();
    const gunYOffset = PlayerTextureManager.getGunYOffset();
    
    // Calculate bullet spawn position
    const bulletX = direction < 0 
      ? playerX - gunXOffset  // Gun on left when flipped
      : playerX + gunXOffset; // Gun on right when not flipped
    
    const bulletY = playerY - gunYOffset; // From bottom of sprite
    
    // Team color for bullet
    const bulletColor = team === "blue" ? 0x5DADE2 : 0xFF6B6B;
    
    return {
      x: bulletX,
      y: bulletY,
      color: bulletColor
    };
  }
} 