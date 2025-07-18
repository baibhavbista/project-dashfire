import Phaser from 'phaser';
import { Team, GAME_CONFIG } from '../config/GameConfig';
import { getTeamColors } from '../config/Colors';

/**
 * Centralized player texture management
 * Ensures consistent textures across all player types
 */
export class PlayerTextureManager {
  private static readonly GUN_WIDTH = 20;
  private static readonly GUN_HEIGHT = 4;
  private static readonly GUN_X_OFFSET = GAME_CONFIG.PLAYER.WIDTH - 4;
  private static readonly GUN_Y_OFFSET = GAME_CONFIG.PLAYER.HEIGHT / 2 - 8;
  
  /**
   * Get or create a player texture with integrated gun
   */
  static getPlayerTexture(scene: Phaser.Scene, team: Team | 'neutral'): string {
    const textureKey = `${team}-player`;
    
    // Return if texture already exists
    if (scene.textures.exists(textureKey)) {
      return textureKey;
    }
    
    // Create texture
    const graphics = scene.add.graphics();
    
    // Determine color
    let bodyColor: number;
    if (team === 'neutral') {
      bodyColor = 0x888888; // Gray for unassigned
    } else {
      const teamColors = getTeamColors(team);
      bodyColor = teamColors.PRIMARY;
    }
    
    // Draw player body
    graphics.fillStyle(bodyColor, 1);
    graphics.fillRect(0, 0, GAME_CONFIG.PLAYER.WIDTH, GAME_CONFIG.PLAYER.HEIGHT);
    
    // Draw integrated gun on the right side
    graphics.fillStyle(0x666666, 1); // Gun color
    graphics.fillRect(
      this.GUN_X_OFFSET, 
      this.GUN_Y_OFFSET, 
      this.GUN_WIDTH, 
      this.GUN_HEIGHT
    );
    
    // Generate texture with increased width to accommodate gun
    const textureWidth = GAME_CONFIG.PLAYER.WIDTH + this.GUN_WIDTH - 4;
    graphics.generateTexture(textureKey, textureWidth, GAME_CONFIG.PLAYER.HEIGHT);
    graphics.destroy();
    
    return textureKey;
  }
  
  /**
   * Get the total width of the player texture (including gun)
   */
  static getTextureWidth(): number {
    return GAME_CONFIG.PLAYER.WIDTH + this.GUN_WIDTH - 4;
  }
  
  /**
   * Get gun tip offset from player center
   * Used for bullet spawning
   */
  static getGunTipOffset(): number {
    // Texture center is at half width
    const textureCenter = this.getTextureWidth() / 2;
    // Gun tip is at the right edge
    const gunTipX = this.getTextureWidth();
    // Offset from center to gun tip
    return gunTipX - textureCenter;
  }
  
  /**
   * Get gun Y offset from player bottom
   */
  static getGunYOffset(): number {
    return GAME_CONFIG.PLAYER.HEIGHT - this.GUN_Y_OFFSET - (this.GUN_HEIGHT / 2);
  }
} 