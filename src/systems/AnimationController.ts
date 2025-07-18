import Phaser from 'phaser';
import { AnimationSystem, AnimationState } from './AnimationSystem';

/**
 * Event callbacks for animation events
 */
export interface AnimationEvents {
  onBreathingStart?: () => void;
  onBreathingStop?: () => void;
  onLandingSquash?: () => void;
  onDashTrailCreated?: () => void;
}

/**
 * Animation controller that wraps AnimationSystem for entity use
 * Manages animation state and provides simple interface
 */
export class AnimationController {
  private animationSystem: AnimationSystem;
  private animationState: AnimationState;
  private events: AnimationEvents;
  
  // References to visual components
  private sprite: Phaser.GameObjects.Sprite;
  private directionIndicator?: Phaser.GameObjects.Triangle;
  
  // State tracking
  private wasGrounded: boolean = true;
  private wasDashing: boolean = false;
  
  constructor(
    scene: Phaser.Scene,
    sprite: Phaser.GameObjects.Sprite,
    directionIndicator?: Phaser.GameObjects.Triangle,
    events?: AnimationEvents
  ) {
    this.animationSystem = new AnimationSystem(scene);
    this.animationState = AnimationSystem.createAnimationState();
    this.sprite = sprite;
    this.directionIndicator = directionIndicator;
    this.events = events || {};
    
    // Ensure sprite starts at normal scale
    this.sprite.setScale(1, 1);
  }
  
  /**
   * Update animations based on current physics state
   */
  public update(
    velocityX: number,
    velocityY: number,
    isGrounded: boolean,
    isDashing: boolean,
    delta: number
  ): void {
    // Check for state changes
    if (!this.wasGrounded && isGrounded) {
      // Just landed
      this.animationSystem.createLandingSquash(this.sprite, this.animationState);
      this.events.onLandingSquash?.();
    }
    
    if (!this.wasDashing && isDashing) {
      // Just started dashing
      this.events.onDashTrailCreated?.();
    }
    
    // Update all animations
    this.animationSystem.updateAnimations(
      this.sprite,
      this.animationState,
      velocityX,
      velocityY,
      isGrounded,
      isDashing,
      delta
    );
    
    // Direction indicator removed - no longer updating it
    
    // Track state changes
    this.wasGrounded = isGrounded;
    this.wasDashing = isDashing;
  }
  
  /**
   * Create a dash trail at current position
   */
  public createDashTrail(): void {
    this.animationSystem.createDashTrail(
      this.sprite,
      this.animationState,
      this.sprite.texture.key
    );
  }
  
  /**
   * Clear all dash trails
   */
  public clearDashTrails(): void {
    this.animationSystem.clearDashTrails(this.animationState);
  }
  
  /**
   * Apply predictive animations (for remote players)
   */
  public applyPredictiveAnimations(
    predictedJumping: boolean,
    predictedLanding: boolean,
    smoothVelocityX: number,
    isDashing: boolean
  ): void {
    this.animationSystem.applyPredictiveAnimations(
      this.sprite,
      this.animationState,
      predictedJumping,
      predictedLanding,
      smoothVelocityX,
      isDashing
    );
  }
  
  /**
   * Force a landing animation
   */
  public forceLandingAnimation(): void {
    this.animationSystem.createLandingSquash(this.sprite, this.animationState);
    this.events.onLandingSquash?.();
  }
  
  /**
   * Get current animation state
   */
  public getState(): AnimationState {
    return this.animationState;
  }
  
  /**
   * Clean up animations and resources
   */
  public destroy(): void {
    // Stop any active tweens
    if (this.animationState.breathingTween) {
      this.animationState.breathingTween.stop();
    }
    if (this.animationState.landingSquashTween) {
      this.animationState.landingSquashTween.stop();
    }
    
    // Clear dash trails
    this.clearDashTrails();
  }
} 