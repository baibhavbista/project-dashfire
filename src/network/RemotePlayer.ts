import Phaser from 'phaser';
import { BasePlayer } from '../entities/BasePlayer';
import { Team, GAME_CONFIG } from '../config/GameConfig';

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
  private interpolationFactor: number = GAME_CONFIG.NETWORK.INTERPOLATION.DEFAULT;
  
  // Smoothed velocity for animations
  private smoothVelocityX: number = 0;
  private smoothVelocityY: number = 0;
  private velocitySmoothFactor: number = GAME_CONFIG.NETWORK.PREDICTION.VELOCITY_SMOOTH_FACTOR;
  
  // Prediction state
  private predictedGrounded: boolean = false;
  private lastGroundedY: number = 0;
  private airTime: number = 0;
  private predictedJumping: boolean = false;
  private predictedLanding: boolean = false;
  
  // Animation prediction
  private jumpPredictionThreshold: number = GAME_CONFIG.NETWORK.PREDICTION.JUMP_VELOCITY_THRESHOLD;
  private landingPredictionWindow: number = GAME_CONFIG.NETWORK.PREDICTION.LANDING_TIME_WINDOW;
  
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
    this.lastGroundedY = y;
    
    // Disable physics for remote players (controlled by server)
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setImmovable(true);
    
    // Create gun visual
    this.createGun();
  }
  
  private createGun(): void {
    const gunLength = 20;
    const gunWidth = 6;
    this.gun = this.scene.add.rectangle(
      this.x + 8,
      this.y - 24,
      gunLength,
      gunWidth,
      0x555555
    );
    this.gun.setOrigin(0, 0.5);
  }
  
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
    // Update target position and velocity
    this.targetX = x;
    this.targetY = y;
    this.targetVelocityX = velocityX;
    this.targetVelocityY = velocityY;
    
    // Smooth velocity for better animations
    this.smoothVelocityX = Phaser.Math.Linear(
      this.smoothVelocityX, 
      velocityX, 
      this.velocitySmoothFactor
    );
    this.smoothVelocityY = Phaser.Math.Linear(
      this.smoothVelocityY, 
      velocityY, 
      this.velocitySmoothFactor
    );
    
    // Update ground prediction
    this.updateGroundPrediction(y, velocityY);
    
    // Update jump/land prediction
    this.updateJumpLandPrediction(velocityY);
    
    // Calculate interpolation factor based on distance
    const distance = Phaser.Math.Distance.Between(this.x, this.y, this.targetX, this.targetY);
    const adaptiveFactor = distance > 100 ? 
      GAME_CONFIG.NETWORK.INTERPOLATION.LARGE_DISTANCE : 
      this.interpolationFactor;
    
    // Interpolate position
    const lerpFactor = 1 - Math.pow(1 - adaptiveFactor, this.scene.game.loop.delta / 16.67);
    
    // Use direct position for large corrections
    if (distance > 200) {
      this.x = this.targetX;
      this.y = this.targetY;
    } else {
      this.x = Phaser.Math.Linear(this.x, this.targetX, lerpFactor);
      const predictedY = this.predictGroundedY(this.targetY);
      this.y = Phaser.Math.Linear(this.y, predictedY, lerpFactor);
    }
    
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
    
    // Update animations through AnimationController
    this.animationController.update(
      this.smoothVelocityX,
      this.smoothVelocityY,
      this.predictedGrounded,
      this._isDashing,
      this.scene.game.loop.delta
    );
    
    // Apply predictive animations
    this.animationController.applyPredictiveAnimations(
      this.predictedJumping,
      this.predictedLanding,
      this.smoothVelocityX,
      this._isDashing
    );
    
    // Update UI positions
    this.updateUIPositions();
  }
  
  /**
   * Update ground prediction based on Y position and velocity
   */
  private updateGroundPrediction(y: number, velocityY: number): void {
    // Track when player is likely on ground (50 units/s threshold)
    if (Math.abs(velocityY) < 50) {
      if (Math.abs(y - this.lastGroundedY) < 5) {
        // Stable Y position, likely grounded
        this.predictedGrounded = true;
        this.airTime = 0;
      } else {
        // Y changed but low velocity, update ground reference
        this.lastGroundedY = y;
        this.predictedGrounded = true;
        this.airTime = 0;
      }
    } else {
      // Moving vertically, likely in air
      this.airTime += this.scene.game.loop.delta;
      if (this.airTime > 100) {
        this.predictedGrounded = false;
      }
    }
  }
  
  /**
   * Update jump and landing predictions
   */
  private updateJumpLandPrediction(velocityY: number): void {
    // Predict jumping (strong upward velocity)
    if (velocityY < -this.jumpPredictionThreshold && !this.predictedJumping) {
      this.predictedJumping = true;
      this.predictedLanding = false;
    }
    
    // Predict landing (was in air, now low velocity)
    if (this.predictedJumping && Math.abs(velocityY) < 50) {
      this.predictedJumping = false;
      this.predictedLanding = true;
      
      // Clear landing prediction after a short time
      this.scene.time.delayedCall(this.landingPredictionWindow, () => {
        this.predictedLanding = false;
      });
    }
  }
  
  /**
   * Predict grounded Y position for smoother movement
   */
  private predictGroundedY(targetY: number): number {
    if (this.predictedGrounded && Math.abs(this.smoothVelocityY) < 50) {
      // Snap to last known ground position for stability
      return Phaser.Math.Linear(targetY, this.lastGroundedY, 0.5);
    }
    return targetY;
  }
  
  /**
   * Clean up resources
   */
  public destroy(fromScene?: boolean): void {
    if (this.gun) {
      this.gun.destroy();
    }
    super.destroy(fromScene);
  }
} 