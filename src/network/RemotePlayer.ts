import Phaser from 'phaser';
import { BasePlayer } from '../entities/BasePlayer';
import { Team } from '../config/GameConfig';

/**
 * Remote player class for networked players
 * Extends BasePlayer with interpolation and network state synchronization
 */
export class RemotePlayer extends BasePlayer {
  // Network state
  private targetX: number;
  private targetY: number;
  private targetVelocityX: number = 0;
  private targetVelocityY: number = 0;
  private interpolationFactor: number = 0.2;
  
  // Gun visual (not in BasePlayer)
  private gun?: Phaser.GameObjects.Rectangle;
  
  constructor(
    scene: Phaser.Scene, 
    id: string, 
    x: number, 
    y: number, 
    team: Team, 
    name: string = 'Player'
  ) {
    super(scene, id, x, y, team, name, false);
    
    // Initialize network position
    this.targetX = x;
    this.targetY = y;
    
    // Disable physics for remote players (controlled by server)
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setImmovable(true);
    
    // Create gun visual
    this.createGun();
  }
  
  private createGun(): void {
    this.gun = this.scene.add.rectangle(0, 0, 24, 3, 0x666666);
    this.gun.setOrigin(0, 0.5);
  }
  
  /**
   * Update remote player state from server
   */
  public updateFromServer(
    x: number, 
    y: number, 
    velocityX: number, 
    velocityY: number, 
    health: number, 
    flipX: boolean, 
    isDashing: boolean, 
    isDead: boolean
  ): void {
    // Update target position
    this.targetX = x;
    this.targetY = y;
    this.targetVelocityX = velocityX;
    this.targetVelocityY = velocityY;
    
    // Calculate distance to target
    const dx = this.targetX - this.x;
    const dy = this.targetY - this.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // Adjust interpolation based on distance
    let lerpFactor = this.interpolationFactor;
    if (distance > 100) {
      lerpFactor = 0.5; // Faster catch-up for large distances
    } else if (distance > 50) {
      lerpFactor = 0.3;
    }
    
    // Smooth interpolation with velocity prediction
    const predictedX = this.targetX + (this.targetVelocityX * 0.05); // Predict 50ms ahead
    const predictedY = this.targetY + (this.targetVelocityY * 0.05);
    
    this.x = Phaser.Math.Linear(this.x, predictedX, lerpFactor);
    this.y = Phaser.Math.Linear(this.y, predictedY, lerpFactor);
    
    // Set velocity for physics interactions
    this.setVelocity(
      (this.targetX - this.x) * 10,
      (this.targetY - this.y) * 10
    );
    
    // Update visual state
    this.setFlipX(flipX);
    this.updateHealth(health);
    this.setDead(isDead);
    
    // Update gun position
    if (this.gun) {
      const direction = flipX ? -1 : 1;
      const gunX = this.x + (8 * direction);
      const gunY = this.y - 24;
      this.gun.setPosition(gunX, gunY);
      this.gun.setScale(direction, 1);
      this.gun.setVisible(!isDead);
    }
    
    // Handle dash state
    if (isDashing && !this.wasDashing) {
      // Just started dashing
      this._isDashing = true;
      this.wasDashing = true;
    } else if (!isDashing && this.wasDashing) {
      // Just stopped dashing
      this._isDashing = false;
      this.wasDashing = false;
    }
    
    // Create dash trails while dashing
    if (this.isDashing && Math.random() < 0.8) {
      this.createDashTrail();
    }
    
    // Update animations
    this.updateCharacterAnimations(this.targetVelocityX);
    
    // Update UI positions
    this.updateUIPositions();
  }
  
  /**
   * Clean up remote player
   */
  public destroy(): void {
    // Destroy gun
    if (this.gun) {
      this.gun.destroy();
    }
    
    // Call parent destroy
    super.destroy();
  }
} 