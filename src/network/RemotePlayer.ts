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
    
    // Smooth velocity for animations
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
    
    // Predict ground state
    this.updateGroundPrediction();
    
    // Predict jump and landing
    this.predictMovementStates();
    
    // Calculate distance to target
    const dx = this.targetX - this.x;
    const dy = this.targetY - this.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // Adjust interpolation based on state and distance
    let lerpFactor = this.interpolationFactor;
    
    if (isDashing) {
      lerpFactor = GAME_CONFIG.NETWORK.INTERPOLATION.DASH;
    } else if (distance > 100) {
      lerpFactor = GAME_CONFIG.NETWORK.INTERPOLATION.LARGE_DISTANCE;
    } else if (distance > 50) {
      lerpFactor = GAME_CONFIG.NETWORK.INTERPOLATION.MEDIUM_DISTANCE;
    } else if (this.predictedJumping || this.predictedLanding) {
      lerpFactor = GAME_CONFIG.NETWORK.INTERPOLATION.TRANSITION;
    }
    
    // Smooth interpolation with velocity prediction
    const predictionTime = isDashing ? 
      GAME_CONFIG.NETWORK.PREDICTION.TIME_DASH : 
      GAME_CONFIG.NETWORK.PREDICTION.TIME_DEFAULT;
    const predictedX = this.targetX + (this.targetVelocityX * predictionTime);
    const predictedY = this.targetY + (this.targetVelocityY * predictionTime);
    
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
    
    // Update animations with smoothed velocity for better visuals
    this.updateCharacterAnimations(this.smoothVelocityX);
    
    // Apply predictive animations
    this.applyPredictiveAnimations();
    
    // Update UI positions
    this.updateUIPositions();
  }
  
  /**
   * Update ground state prediction based on velocity and position
   */
  private updateGroundPrediction(): void {
    const wasGrounded = this.predictedGrounded;
    
    // Simple ground detection based on velocity and position stability
    const verticalSpeed = Math.abs(this.smoothVelocityY);
    const isNearGround = Math.abs(this.y - this.lastGroundedY) < 10;
    
    if (verticalSpeed < 50 && isNearGround) {
      this.predictedGrounded = true;
      this.lastGroundedY = this.y;
      this.airTime = 0;
    } else {
      this.predictedGrounded = false;
      this.airTime += this.scene.game.loop.delta;
    }
    
    // Update BasePlayer's ground state for animations
    this.isGrounded = this.predictedGrounded;
    this.wasGrounded = wasGrounded;
  }
  
  /**
   * Predict jump and landing states based on velocity
   */
  private predictMovementStates(): void {
    // Reset predictions
    this.predictedJumping = false;
    this.predictedLanding = false;
    
    // Predict jump start
    if (this.predictedGrounded && this.smoothVelocityY < this.jumpPredictionThreshold) {
      this.predictedJumping = true;
    }
    
    // Predict landing
    if (!this.predictedGrounded && this.smoothVelocityY > 100) {
      // Estimate time to ground based on velocity
      const timeToGround = (this.lastGroundedY - this.y) / this.smoothVelocityY;
      
      if (timeToGround > 0 && timeToGround < this.landingPredictionWindow) {
        this.predictedLanding = true;
      }
    }
  }
  
  /**
   * Apply predictive animations based on predicted states
   */
  private applyPredictiveAnimations(): void {
    // Jump anticipation
    if (this.predictedJumping && !this._isDashing) {
      // Start stretch animation early
      const stretchScale = 1.1;
      this.setScale(1 / stretchScale, stretchScale);
    }
    
    // Landing preparation
    if (this.predictedLanding && !this._isDashing) {
      // Start compression animation early
      const compressScale = 0.95;
      this.setScale(1 / compressScale, compressScale);
    }
    
    // Enhanced idle breathing for remote players
    if (this.predictedGrounded && Math.abs(this.smoothVelocityX) < 10 && !this._isDashing) {
      // Stronger breathing animation for remote players
      if (!this.breathingTween) {
        this.startBreathingAnimation();
      }
    }
    
    // Movement anticipation
    if (Math.abs(this.smoothVelocityX) > 50) {
      // Lean into movement direction
      const leanAngle = Phaser.Math.Clamp(
        this.smoothVelocityX * GAME_CONFIG.ANIMATION.LEAN_MULTIPLIER * 1.2, 
        -GAME_CONFIG.ANIMATION.LEAN_MAX_ANGLE * 1.2, 
        GAME_CONFIG.ANIMATION.LEAN_MAX_ANGLE * 1.2
      );
      this.setRotation(Phaser.Math.DegToRad(leanAngle));
    }
  }
  
  /**
   * Get target X position for debug visualization
   */
  public getTargetX(): number {
    return this.targetX;
  }
  
  /**
   * Get target Y position for debug visualization
   */
  public getTargetY(): number {
    return this.targetY;
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