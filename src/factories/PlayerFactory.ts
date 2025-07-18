import Phaser from 'phaser';
import { LocalPlayer } from '../entities/LocalPlayer';
import { PlayerTextureManager } from '../entities/PlayerTextureManager';
import { NetworkManager } from '../network/NetworkManager';
import { Team } from '../config/GameConfig';
import { WorldBuilder } from '../systems/WorldBuilder';

/**
 * PlayerFactory - Handles player creation and initialization
 * 
 * Responsibilities:
 * - Determine initial team
 * - Calculate spawn position
 * - Handle neutral texture for unassigned players
 * - Create and configure player instance
 */
export class PlayerFactory {
  /**
   * Creates and initializes a local player
   */
  static createLocalPlayer(
    scene: Phaser.Scene,
    worldBuilder: WorldBuilder,
    networkManager?: NetworkManager,
    isMultiplayer: boolean = false
  ): LocalPlayer {
    const playerId = 'local-player';
    
    // Determine initial configuration
    const config = this.determineInitialConfig(scene, worldBuilder, networkManager, isMultiplayer);
    
    // Create neutral texture if needed
    if (config.useNeutralTexture) {
      PlayerTextureManager.getPlayerTexture(scene, 'neutral');
    }
    
    // Create player instance
    const player = new LocalPlayer(
      scene,
      playerId,
      config.x,
      config.y,
      config.team,
      'You'
    );
    
    // Override to neutral texture if no team assigned yet
    if (config.useNeutralTexture) {
      player.setTexture('neutral-player');
    }
    
    return player;
  }
  
  /**
   * Determines initial player configuration based on game mode
   */
  private static determineInitialConfig(
    scene: Phaser.Scene,
    worldBuilder: WorldBuilder,
    networkManager?: NetworkManager,
    isMultiplayer: boolean = false
  ): { team: Team; x: number; y: number; useNeutralTexture: boolean } {
    let team: Team = 'red';
    let useNeutralTexture = true;
    let x = 100;
    let y = 1350;
    
    if (isMultiplayer && networkManager) {
      // Multiplayer mode - check for pre-assigned team
      const assignedTeam = networkManager.getPlayerTeam();
      if (assignedTeam) {
        team = assignedTeam;
        useNeutralTexture = false;
        console.log("Player already has team:", assignedTeam);
      }
    } else {
      // Single-player mode - random team and position
      team = Math.random() < 0.5 ? 'red' : 'blue';
      useNeutralTexture = false; // Always have a team in single-player
      
      // Use WorldBuilder for spawn position
      const spawnPos = worldBuilder.getRandomSpawnPosition();
      x = spawnPos.x;
      y = spawnPos.y;
      
      console.log(`Single-player mode: Random team ${team} at position (${x}, ${y})`);
    }
    
    return { team, x, y, useNeutralTexture };
  }
} 