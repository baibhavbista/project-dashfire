import Phaser from 'phaser';
import { GAME_CONFIG } from '../config/GameConfig';

/**
 * Animation state for tracking current animations
 */
export interface AnimationState {
  // Current animation values
  targetScaleX: number;
  targetScaleY: number;
  currentRotation: number;
  
  // Animation flags
  isBreathing: boolean;
  isJumping: boolean;
  isFalling: boolean;
  isLanding: boolean;
  isDashing: boolean;
  
  // Tweens
  breathingTween?: Phaser.Tweens.Tween;
  landingSquashTween?: Phaser.Tweens.Tween;
  
  // Dash trails
  dashTrails: Phaser.GameObjects.Sprite[];
  
  // Direction memory
  lastVelocityX: number;
}

/**
 * Centralized animation system for all character animations
 * Handles breathing, lean, jump/fall deformation, landing impact, and dash effects
 */
export class AnimationSystem {
  private scene: Phaser.Scene;
  
  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }
  
  /**
   * Create initial animation state
   */
  static createAnimationState(): AnimationState {
    return {
      targetScaleX: 1,
      targetScaleY: 1,
      currentRotation: 0,
      isBreathing: false,
      isJumping: false,
      isFalling: false,
      isLanding: false,
      isDashing: false,
      dashTrails: [],
      lastVelocityX: 0
    };
  }
  
  /**
   * Update all animations for a sprite based on its movement state
   */
  public updateAnimations(
    sprite: Phaser.GameObjects.Sprite,
    state: AnimationState,
    velocityX: number,
    velocityY: number,
    isGrounded: boolean,
    isDashing: boolean,
    delta: number
  ): void {
    // Update state flags
    state.isDashing = isDashing;
    
    // Determine animation states
    const absVelX = Math.abs(velocityX);
    const isIdle = absVelX < 10 && isGrounded && !isDashing;
    
    // Update breathing animation
    this.updateBreathingAnimation(sprite, state, isIdle);
    
    // Update movement lean
    this.updateMovementLean(sprite, state, velocityX, isGrounded, isDashing);
    
    // Update jump/fall deformation
    this.updateJumpDeformation(sprite, state, velocityY, isGrounded, isDashing, delta);
    
    // Clean up old dash trails
    this.updateDashTrails(state);
  }
  
  /**
   * Update direction indicator position and state
   */
  public updateDirectionIndicator(
    indicator: Phaser.GameObjects.Triangle,
    x: number,
    y: number,
    velocityX: number,
    isDashing: boolean,
    state: AnimationState
  ): void {
    indicator.setPosition(x, y - GAME_CONFIG.ANIMATION.INDICATOR.OFFSET_Y);
    
    const absVelX = Math.abs(velocityX);
    
    if (absVelX > 10) {
      indicator.setAlpha(GAME_CONFIG.ANIMATION.INDICATOR.ACTIVE_ALPHA);
      const angle = velocityX > 0 ? 90 : -90;
      indicator.setRotation(Phaser.Math.DegToRad(angle));
      state.lastVelocityX = velocityX;
    } else {
      indicator.setAlpha(GAME_CONFIG.ANIMATION.INDICATOR.FADE_ALPHA);
      const angle = state.lastVelocityX > 0 ? 90 : -90;
      indicator.setRotation(Phaser.Math.DegToRad(angle));
    }
    
    // Glow during dash
    if (isDashing) {
      indicator.setAlpha(1);
      indicator.setScale(GAME_CONFIG.ANIMATION.INDICATOR.DASH_SCALE);
    } else {
      indicator.setScale(1);
    }
  }
  
  /**
   * Create a landing squash effect
   */
  public createLandingSquash(sprite: Phaser.GameObjects.Sprite, state: AnimationState): void {
    // Stop any existing landing animation
    if (state.landingSquashTween) {
      state.landingSquashTween.stop();
    }
    
    // Immediate squash
    sprite.setScale(1.3, 0.7);
    state.isLanding = true;
    
    // Bounce back with overshoot
    state.landingSquashTween = this.scene.tweens.add({
      targets: sprite,
      scaleX: 1,
      scaleY: 1,
      duration: GAME_CONFIG.ANIMATION.JUMP.LANDING_DURATION,
      ease: 'Back.easeOut',
      onComplete: () => {
        state.landingSquashTween = undefined;
        state.isLanding = false;
      }
    });
  }
  
  /**
   * Create a dash trail effect
   */
  public createDashTrail(
    sprite: Phaser.GameObjects.Sprite, 
    state: AnimationState,
    textureKey: string
  ): void {
    // Remove oldest trail if at max
    if (state.dashTrails.length >= GAME_CONFIG.PLAYER.DASH.MAX_TRAILS) {
      const oldTrail = state.dashTrails.shift();
      if (oldTrail) {
        oldTrail.destroy();
      }
    }

    // Create new trail
    const trail = this.scene.add.sprite(sprite.x, sprite.y, textureKey);
    trail.setDisplaySize(GAME_CONFIG.PLAYER.WIDTH, GAME_CONFIG.PLAYER.HEIGHT);
    trail.setAlpha(0.6);
    trail.setFlipX(sprite.flipX);
    trail.setOrigin(0.5, 1);

    state.dashTrails.push(trail);

    // Fade out trail
    this.scene.tweens.add({
      targets: trail,
      alpha: 0,
      duration: GAME_CONFIG.PLAYER.DASH.TRAIL_FADE_DURATION,
      onComplete: () => {
        const index = state.dashTrails.indexOf(trail);
        if (index > -1) {
          state.dashTrails.splice(index, 1);
        }
        trail.destroy();
      }
    });
  }
  
  /**
   * Clear all dash trails
   */
  public clearDashTrails(state: AnimationState): void {
    state.dashTrails.forEach(trail => {
      if (trail && trail.active) {
        trail.destroy();
      }
    });
    state.dashTrails = [];
  }
  
  /**
   * Handle predictive animations for remote players
   */
  public applyPredictiveAnimations(
    sprite: Phaser.GameObjects.Sprite,
    state: AnimationState,
    predictedJumping: boolean,
    predictedLanding: boolean,
    smoothVelocityX: number,
    isDashing: boolean
  ): void {
    // Jump anticipation
    if (predictedJumping && !isDashing) {
      const stretchScale = 1.1;
      sprite.setScale(1 / stretchScale, stretchScale);
    }
    
    // Landing preparation
    if (predictedLanding && !isDashing) {
      const compressScale = 0.95;
      sprite.setScale(1 / compressScale, compressScale);
    }
    
    // Enhanced movement anticipation
    if (Math.abs(smoothVelocityX) > 50) {
      const leanAngle = Phaser.Math.Clamp(
        smoothVelocityX * GAME_CONFIG.ANIMATION.LEAN_MULTIPLIER * 1.2, 
        -GAME_CONFIG.ANIMATION.LEAN_MAX_ANGLE * 1.2, 
        GAME_CONFIG.ANIMATION.LEAN_MAX_ANGLE * 1.2
      );
      sprite.setRotation(Phaser.Math.DegToRad(leanAngle));
    }
  }
  
  // Private helper methods
  
  private updateBreathingAnimation(
    sprite: Phaser.GameObjects.Sprite,
    state: AnimationState,
    _isIdle: boolean
  ): void {
    // Breathing animation disabled
    // Always ensure breathing is stopped
    if (state.isBreathing) {
      state.isBreathing = false;
      if (state.breathingTween) {
        state.breathingTween.stop();
        state.breathingTween = undefined;
        if (!state.isLanding) {
          sprite.setScale(1, 1);
        }
      }
    }
  }
  
  private updateMovementLean(
    sprite: Phaser.GameObjects.Sprite,
    state: AnimationState,
    velocityX: number,
    isGrounded: boolean,
    isDashing: boolean
  ): void {
    const absVelX = Math.abs(velocityX);
    
    if (absVelX > 10 && !isDashing) {
      // Apply lean based on velocity
      const leanAngle = Phaser.Math.Clamp(
        velocityX * GAME_CONFIG.ANIMATION.LEAN_MULTIPLIER, 
        -GAME_CONFIG.ANIMATION.LEAN_MAX_ANGLE, 
        GAME_CONFIG.ANIMATION.LEAN_MAX_ANGLE
      );
      sprite.setRotation(Phaser.Math.DegToRad(leanAngle));
      state.currentRotation = leanAngle;
    } else if (isGrounded && !isDashing) {
      // Return to upright when idle
      sprite.setRotation(0);
      state.currentRotation = 0;
    }
  }
  
  private updateJumpDeformation(
    sprite: Phaser.GameObjects.Sprite,
    state: AnimationState,
    velocityY: number,
    isGrounded: boolean,
    isDashing: boolean,
    delta: number
  ): void {
    // Skip if landing animation is playing or dashing
    if (state.isLanding || isDashing) return;
    
    if (!isGrounded) {
      if (velocityY < 0) {
        // Rising - stretch vertically
        const t = Math.min(-velocityY / 800, 1);
        const stretchY = 1 + (GAME_CONFIG.ANIMATION.JUMP.MAX_STRETCH - 1) * t;
        state.targetScaleY = stretchY;
        state.targetScaleX = 1 / stretchY;
        state.isJumping = true;
        state.isFalling = false;
      } else {
        // Falling - compress vertically
        const t = Math.min(velocityY / 400, 1);
        const compressY = 1 + (GAME_CONFIG.ANIMATION.JUMP.MAX_STRETCH - 1) * (1 - t);
        state.targetScaleY = compressY;
        state.targetScaleX = 1 / compressY;
        state.isJumping = false;
        state.isFalling = true;
      }
    } else {
      // Return to normal when grounded
      state.targetScaleX = 1;
      state.targetScaleY = 1;
      state.isJumping = false;
      state.isFalling = false;
    }
    
    // Apply smooth scaling
    const dt = delta / 1000;
    const currentScaleX = sprite.scaleX;
    const currentScaleY = sprite.scaleY;
    
    sprite.setScale(
      currentScaleX + (state.targetScaleX - currentScaleX) * GAME_CONFIG.ANIMATION.JUMP.STRETCH_SPEED * dt,
      currentScaleY + (state.targetScaleY - currentScaleY) * GAME_CONFIG.ANIMATION.JUMP.STRETCH_SPEED * dt
    );
  }
  
  private updateDashTrails(state: AnimationState): void {
    // Clean up destroyed trails
    state.dashTrails = state.dashTrails.filter(trail => trail && trail.active);
  }
} 