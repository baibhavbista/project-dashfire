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
  isCrouching: boolean;
  
  // Tweens
  breathingTween?: Phaser.Tweens.Tween;
  landingSquashTween?: Phaser.Tweens.Tween;
  postDashTween?: Phaser.Tweens.Tween;
  
  // Dash trails
  dashTrails: Phaser.GameObjects.Sprite[];
  
  // Direction memory
  lastVelocityX: number;
  
  // Post-dash scale persistence
  postDashScaleX: number;
  postDashScaleY: number;
  wasDashing: boolean;
  
  // Jump timing
  jumpStartTime?: number;
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
      isCrouching: false,
      dashTrails: [],
      lastVelocityX: 0,
      postDashScaleX: 1,
      postDashScaleY: 1,
      wasDashing: false,
      jumpStartTime: undefined
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
    // Track dash state changes
    if (state.isDashing && !isDashing) {
      // Just stopped dashing - capture current scale
      state.postDashScaleX = sprite.scaleX;
      state.postDashScaleY = sprite.scaleY;
      state.wasDashing = true;
      
      // Create a tween to maintain scale briefly then return to normal
      if (state.postDashTween) {
        state.postDashTween.stop();
      }
      
      // Hold the scale for 150ms, then smoothly return to normal over 200ms
      state.postDashTween = this.scene.tweens.add({
        targets: sprite,
        scaleX: 1,
        scaleY: 1,
        delay: 150,
        duration: 200,
        ease: 'Cubic.easeOut',
        onComplete: () => {
          state.wasDashing = false;
          state.postDashTween = undefined;
        }
      });
    }
    
    // Update state flags
    state.isDashing = isDashing;
    
    // Determine animation states
    const absVelX = Math.abs(velocityX);
    const isIdle = absVelX < 10 && isGrounded && !isDashing;
    
    // Update crouch animation first (base state)
    this.updateCrouchAnimation(sprite, state);
    
    // Update breathing animation
    this.updateBreathingAnimation(sprite, state, isIdle);
    
    // Update movement lean
    this.updateMovementLean(sprite, state, velocityX, isGrounded, isDashing);
    
    // Update jump/fall deformation (can override crouch)
    this.updateJumpDeformation(sprite, state, velocityY, isGrounded, isDashing, delta);
    
    // Clean up old dash trails
    this.updateDashTrails(state);
  }
  
  /**
   * Update direction indicator position and state
   * REMOVED - No longer used
   */
  // public updateDirectionIndicator(
  //   indicator: Phaser.GameObjects.Triangle,
  //   x: number,
  //   y: number,
  //   velocityX: number,
  //   isDashing: boolean,
  //   state: AnimationState
  // ): void {
  //   indicator.setPosition(x, y - GAME_CONFIG.ANIMATION.INDICATOR.OFFSET_Y);
  //   
  //   const absVelX = Math.abs(velocityX);
  //   
  //   if (absVelX > 10) {
  //     indicator.setAlpha(GAME_CONFIG.ANIMATION.INDICATOR.ACTIVE_ALPHA);
  //     const angle = velocityX > 0 ? 90 : -90;
  //     indicator.setRotation(Phaser.Math.DegToRad(angle));
  //     state.lastVelocityX = velocityX;
  //   } else {
  //     indicator.setAlpha(GAME_CONFIG.ANIMATION.INDICATOR.FADE_ALPHA);
  //     const angle = state.lastVelocityX > 0 ? 90 : -90;
  //     indicator.setRotation(Phaser.Math.DegToRad(angle));
  //   }
  //   
  //   // Glow during dash
  //   if (isDashing) {
  //     indicator.setAlpha(1);
  //     indicator.setScale(GAME_CONFIG.ANIMATION.INDICATOR.DASH_SCALE);
  //   } else {
  //     indicator.setScale(1);
  //   }
  // }
  
  /**
   * Create landing impact squash animation
   */
  public createLandingSquash(sprite: Phaser.GameObjects.Sprite, state: AnimationState): void {
    // Stop any existing landing animation
    if (state.landingSquashTween) {
      state.landingSquashTween.stop();
    }
    
    const { LANDING_SQUASH_SCALE, LANDING_BOUNCE_DURATION } = GAME_CONFIG.ANIMATION.JUMP;
    
    // Apply landing squash
    sprite.setScale(LANDING_SQUASH_SCALE.x, LANDING_SQUASH_SCALE.y);
    state.isLanding = true;
    state.jumpStartTime = undefined; // Clear any jump timing when landing
    
    // Bounce back with overshoot
    state.landingSquashTween = this.scene.tweens.add({
      targets: sprite,
      scaleX: 1,
      scaleY: 1,
      duration: LANDING_BOUNCE_DURATION,
      ease: 'Cubic.easeOut',  // Changed to Cubic for smoother, less bouncy landing
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

    // Create new trail that captures the current sprite scale/size
    const trail = this.scene.add.sprite(sprite.x, sprite.y, textureKey);
    
    // Copy the exact scale from the sprite (including any stretch/squash)
    trail.setScale(sprite.scaleX, sprite.scaleY);
    
    trail.setBlendMode(Phaser.BlendModes.ADD); // Make the trail glow
    trail.setAlpha(0.5); // Lower alpha for additive blending
    trail.setFlipX(sprite.flipX);
    trail.setOrigin(sprite.originX, sprite.originY); // Copy exact origin

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
    _smoothVelocityX: number, // eslint-disable-line @typescript-eslint/no-unused-vars
    isDashing: boolean // eslint-disable-line @typescript-eslint/no-unused-vars
  ): void {
    // Jump anticipation - allow during dashing
    if (predictedJumping) {
      const stretchScale = 1.1;
      sprite.setScale(1 / stretchScale, stretchScale);
    }
    
    // Landing preparation - allow during dashing
    if (predictedLanding) {
      const compressScale = 0.95;
      sprite.setScale(1 / compressScale, compressScale);
    }
    
    // Movement lean disabled - keep sprite upright
    // (Previously applied enhanced lean for remote players)
  }
  
  /**
   * Creates a jump anticipation squash, then launches the player.
   * This creates a much punchier, deliberate jump animation.
   * @param sprite The player sprite to animate.
   * @param body The physics body to apply jump velocity to.
   * @param state The animation state object.
   * @param onJumpCallback A function to call when the jump actually happens.
   */
  public createAnticipatedJump(
    sprite: Phaser.GameObjects.Sprite,
    body: Phaser.Physics.Arcade.Body,
    state: AnimationState,
    onJumpCallback: () => void
  ): void {
    // Don't allow a new jump while one is already in progress (removed landing check)
    if (state.isJumping) {
      return;
    }

    // Stop any other animations like breathing
    if (state.breathingTween) {
      state.breathingTween.stop();
      state.isBreathing = false;
    }
    state.isJumping = true;
    state.jumpStartTime = Date.now();

    const { ANTICIPATION_SQUASH_SCALE, ANTICIPATION_DURATION, STRETCH_SCALE } = GAME_CONFIG.ANIMATION.JUMP;

    // 1. SQUASH DOWN (Anticipation)
    this.scene.tweens.add({
      targets: sprite,
      scaleX: ANTICIPATION_SQUASH_SCALE.x,
      scaleY: ANTICIPATION_SQUASH_SCALE.y,
      duration: ANTICIPATION_DURATION,
      ease: 'Cubic.easeIn',
      onComplete: () => {
        // 2. JUMP & STRETCH (Explosion)
        // Apply physics immediately
        body.setVelocityY(-GAME_CONFIG.PLAYER.JUMP_POWER);
        onJumpCallback(); // Play sounds, create effects

        // Instantly snap to the stretched state
        sprite.setScale(STRETCH_SCALE.x, STRETCH_SCALE.y);
        state.targetScaleX = STRETCH_SCALE.x;
        state.targetScaleY = STRETCH_SCALE.y;
      }
    });
  }
  
  // Private helper methods
  
  private updateBreathingAnimation(
    sprite: Phaser.GameObjects.Sprite,
    state: AnimationState,
    isIdle: boolean // eslint-disable-line @typescript-eslint/no-unused-vars
  ): void {
    // Breathing animation disabled
    // Always ensure breathing is stopped
    if (state.isBreathing) {
      state.isBreathing = false;
      if (state.breathingTween) {
        state.breathingTween.stop();
        state.breathingTween = undefined;
        // Don't reset scale if crouching or landing
        if (!state.isLanding && !state.isCrouching) {
          sprite.setScale(1, 1);
        }
      }
    }
  }
  
  private updateMovementLean(
    sprite: Phaser.GameObjects.Sprite,
    state: AnimationState,
    _velocityX: number, // eslint-disable-line @typescript-eslint/no-unused-vars
    _isGrounded: boolean, // eslint-disable-line @typescript-eslint/no-unused-vars
    _isDashing: boolean // eslint-disable-line @typescript-eslint/no-unused-vars
  ): void {
    // Movement lean disabled - always keep sprite upright
    sprite.setRotation(0);
    state.currentRotation = 0;
  }
  
  private updateJumpDeformation(
    sprite: Phaser.GameObjects.Sprite,
    state: AnimationState,
    velocityY: number,
    isGrounded: boolean,
    isDashing: boolean,
    delta: number
  ): void {
    // If we are in the middle of a landing animation, let the tween handle it
    if (state.isLanding) return;
    
    // Don't update if we're in post-dash state (let the tween handle it)
    if (state.wasDashing) return;
    
    // Protect jump stretch animation for a brief period after jump starts
    // This handles the timing window where jump has started but player hasn't left ground yet
    const JUMP_PROTECTION_MS = 150; // Protect stretch for 150ms after jump starts
    if (state.isJumping && state.jumpStartTime && isGrounded) {
      const timeSinceJump = Date.now() - state.jumpStartTime;
      if (timeSinceJump < JUMP_PROTECTION_MS) {
        // Still in protection window - don't reset the stretch
        return;
      }
    }
    
    // Don't skip deformation during dashing - we want to capture the current height
    
    if (!isGrounded) {
      // If the player is moving downwards (after the jump's peak), return to a neutral scale.
      // This makes the stretch only apply on the way up.
      if (velocityY > 50 && state.isJumping) {
        this.scene.tweens.add({
          targets: sprite,
          scaleX: 1,
          scaleY: 1,
          duration: 50, // A quick transition back to normal
          ease: 'Cubic.easeOut'
        });
        // We are now just "falling", not actively "jumping"
        state.isJumping = false;
        state.isFalling = true;
        state.targetScaleX = 1;
        state.targetScaleY = 1;
        state.jumpStartTime = undefined; // Clear jump start time when transitioning to fall
      } else if (velocityY > 0 && !state.isJumping) {
        // Already falling without jumping - slight compression
        const t = Math.min(velocityY / 400, 1);
        const compressY = 1 - (0.1 * t); // Subtle compression when falling
        state.targetScaleY = compressY;
        state.targetScaleX = 2 - compressY; // Inverse relationship
        state.isFalling = true;
        
        // Apply smooth scaling for fall compression
        const dt = delta / 1000;
        const currentScaleX = sprite.scaleX;
        const currentScaleY = sprite.scaleY;
        
        sprite.setScale(
          currentScaleX + (state.targetScaleX - currentScaleX) * GAME_CONFIG.ANIMATION.JUMP.STRETCH_SPEED * dt,
          currentScaleY + (state.targetScaleY - currentScaleY) * GAME_CONFIG.ANIMATION.JUMP.STRETCH_SPEED * dt
        );
      }
    } else {
      // Reset all aerial state flags when on the ground
      state.isJumping = false;
      state.isFalling = false;
      state.targetScaleX = 1;
      state.targetScaleY = 1;
      state.jumpStartTime = undefined; // Clear jump start time when truly grounded
    }
  }
  
  private updateDashTrails(state: AnimationState): void {
    // Clean up destroyed trails
    state.dashTrails = state.dashTrails.filter(trail => trail && trail.active);
  }
  
  private updateCrouchAnimation(sprite: Phaser.GameObjects.Sprite, state: AnimationState): void {
    // Don't update crouch if other animations are playing
    if (state.isJumping || state.isLanding || state.isFalling || state.wasDashing) {
      return;
    }
    
    if (state.isCrouching) {
      // Only set scale if not already crouched
      if (Math.abs(sprite.scaleY - 0.5) > 0.01) {
        sprite.setScale(sprite.scaleX, 0.5);
      }
    } else {
      // Only reset scale if not already normal
      if (Math.abs(sprite.scaleY - 1) > 0.01) {
        sprite.setScale(sprite.scaleX, 1);
      }
    }
  }
} 