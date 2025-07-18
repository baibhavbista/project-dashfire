import Phaser from 'phaser';
import { MovementSystem, MovementInput, MovementState } from './MovementSystem';

/**
 * Movement event data
 */
export interface MovementEvents {
  onJump?: () => void;
  onLand?: () => void;
  onDashStart?: () => void;
  onDashEnd?: () => void;
  onGroundStateChange?: (isGrounded: boolean) => void;
}

/**
 * MovementController wraps MovementSystem for easier integration
 * Can be used by players, AI, or any entity that needs movement
 */
export class MovementController {
  private movementSystem: MovementSystem;
  private movementState: MovementState;
  private dashState: ReturnType<typeof MovementSystem.createDashState>;
  private scene: Phaser.Scene;
  private events: MovementEvents;
  
  // State tracking for edge detection
  private wasGrounded: boolean = false;
  private wasJumping: boolean = false;
  private wasDashing: boolean = false;
  
  constructor(scene: Phaser.Scene, events: MovementEvents = {}) {
    this.scene = scene;
    this.events = events;
    this.movementSystem = new MovementSystem(scene);
    this.movementState = MovementSystem.createMovementState();
    this.dashState = MovementSystem.createDashState();
  }
  
  /**
   * Update movement with given input
   */
  public update(
    body: Phaser.Physics.Arcade.Body,
    input: MovementInput,
    deltaTime: number
  ): void {
    // Store previous states
    this.wasGrounded = this.movementState.isGrounded;
    this.wasJumping = this.movementState.isJumping;
    this.wasDashing = this.movementState.isDashing;
    
    // Update movement
    this.movementSystem.updateMovement(body, input, this.movementState, deltaTime);
    
    // Update dash
    this.movementSystem.updateDash(body, input, this.movementState, this.dashState);
    
    // Detect state changes and fire events
    this.detectStateChanges();
    
    // Update dash button state for edge detection (must be after dash handling)
    this.movementState.wasDashPressed = input.dash;
  }
  
  /**
   * Try to start a dash
   */
  public tryDash(body: Phaser.Physics.Arcade.Body, input: MovementInput): boolean {
    // Only dash on rising edge of dash input
    if (!input.dash || this.movementState.wasDashPressed) {
      return false;
    }
    
    const started = this.movementSystem.startDash(body, input, this.movementState, this.dashState);
    
    if (started && this.events.onDashStart) {
      this.events.onDashStart();
      
      // Schedule dash end callback
      this.scene.time.delayedCall(this.getDashDuration(), () => {
        if (!this.movementState.isDashing && this.events.onDashEnd) {
          this.events.onDashEnd();
        }
      });
    }
    
    return started;
  }
  
  /**
   * Detect state changes and fire events
   */
  private detectStateChanges(): void {
    // Ground state change
    if (this.wasGrounded !== this.movementState.isGrounded) {
      if (this.events.onGroundStateChange) {
        this.events.onGroundStateChange(this.movementState.isGrounded);
      }
      
      // Landing
      if (!this.wasGrounded && this.movementState.isGrounded && this.events.onLand) {
        this.events.onLand();
      }
    }
    
    // Jump start
    if (!this.wasJumping && this.movementState.isJumping && this.events.onJump) {
      this.events.onJump();
    }
    
    // Dash end
    if (this.wasDashing && !this.movementState.isDashing && this.events.onDashEnd) {
      this.events.onDashEnd();
    }
  }
  
  /**
   * Get movement state (read-only)
   */
  public getState(): Readonly<MovementState> {
    return this.movementState;
  }
  
  /**
   * Check if can dash
   */
  public canDash(): boolean {
    return this.movementState.canDash && 
           this.movementState.dashCooldown <= 0 && 
           !this.movementState.isDashing && 
           !this.movementState.isGrounded;
  }
  
  /**
   * Get dash cooldown remaining
   */
  public getDashCooldown(): number {
    return Math.max(0, this.movementState.dashCooldown);
  }
  
  /**
   * Get dash duration from config
   */
  private getDashDuration(): number {
    return 150; // Would import from GAME_CONFIG but keeping it simple
  }
  
  /**
   * Reset movement state
   */
  public reset(): void {
    this.movementState = MovementSystem.createMovementState();
    this.dashState = MovementSystem.createDashState();
    this.wasGrounded = false;
    this.wasJumping = false;
    this.wasDashing = false;
  }
} 