import Phaser from 'phaser';
import { GAME_CONFIG } from '../config/GameConfig';

/**
 * Movement input state
 */
export interface MovementInput {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  jump: boolean;
  dash: boolean;
}

/**
 * Movement state tracking
 */
export interface MovementState {
  isGrounded: boolean;
  wasGrounded: boolean;
  isJumping: boolean;
  isDashing: boolean;
  canDash: boolean;
  dashCooldown: number;
  coyoteTime: number;
  facingDirection: number; // 1 for right, -1 for left
  wasJumpPressed: boolean; // For edge detection
  wasDashPressed: boolean; // For edge detection
}

/**
 * Dash state for tracking initial directions
 */
interface DashState {
  active: boolean;
  startTime: number;
  initialDirections: {
    left: boolean;
    right: boolean;
    up: boolean;
    down: boolean;
  };
}

/**
 * MovementSystem handles all physics-based movement calculations
 * Decoupled from specific entity implementations
 */
export class MovementSystem {
  private scene: Phaser.Scene;
  
  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }
  
  /**
   * Update movement based on input and current state
   */
  public updateMovement(
    body: Phaser.Physics.Arcade.Body,
    input: MovementInput,
    state: MovementState,
    deltaTime: number
  ): void {
    // Update ground state
    this.updateGroundState(body, state);
    
    // Update coyote time
    this.updateCoyoteTime(state, deltaTime);
    
    // Handle horizontal movement
    if (!state.isDashing) {
      this.handleHorizontalMovement(body, input, state, deltaTime);
    }
    
    // Handle jumping
    this.handleJumping(body, input, state);
    
    // Update gravity
    this.updateGravity(body, input, state);
    
    // Update dash cooldown
    if (state.dashCooldown > 0) {
      state.dashCooldown = Math.max(0, state.dashCooldown - deltaTime);
    }
  }
  
  /**
   * Update ground detection
   */
  private updateGroundState(body: Phaser.Physics.Arcade.Body, state: MovementState): void {
    state.wasGrounded = state.isGrounded;
    state.isGrounded = body.blocked.down || body.touching.down;
    
    // Reset dash when touching ground
    if (state.isGrounded && !state.wasGrounded) {
      state.canDash = true;
    }
  }
  
  /**
   * Update coyote time for forgiving jumps
   */
  private updateCoyoteTime(state: MovementState, deltaTime: number): void {
    if (state.isGrounded) {
      state.coyoteTime = GAME_CONFIG.PLAYER.COYOTE_TIME_MS;
    } else if (state.coyoteTime > 0) {
      state.coyoteTime = Math.max(0, state.coyoteTime - deltaTime);
    }
  }
  
  /**
   * Handle horizontal movement with acceleration and friction
   */
  private handleHorizontalMovement(
    body: Phaser.Physics.Arcade.Body,
    input: MovementInput,
    state: MovementState,
    deltaTime: number
  ): void {
    const maxSpeed = GAME_CONFIG.PLAYER.MAX_SPEED;
    const acceleration = GAME_CONFIG.PLAYER.ACCELERATION;
    const friction = GAME_CONFIG.PLAYER.FRICTION;
    const currentVelX = body.velocity.x;
    const dt = deltaTime / 1000; // Convert to seconds
    
    if (input.left) {
      const newVelX = Math.max(currentVelX - acceleration * dt, -maxSpeed);
      body.setVelocityX(newVelX);
      state.facingDirection = -1;
    } else if (input.right) {
      const newVelX = Math.min(currentVelX + acceleration * dt, maxSpeed);
      body.setVelocityX(newVelX);
      state.facingDirection = 1;
    } else {
      // Apply friction
      if (Math.abs(currentVelX) > 10) {
        const frictionForce = friction * dt;
        if (currentVelX > 0) {
          body.setVelocityX(Math.max(0, currentVelX - frictionForce));
        } else {
          body.setVelocityX(Math.min(0, currentVelX + frictionForce));
        }
      } else {
        body.setVelocityX(0);
      }
    }
  }
  
  /**
   * Handle jump mechanics
   */
  private handleJumping(
    body: Phaser.Physics.Arcade.Body,
    input: MovementInput,
    state: MovementState
  ): void {
    const canJump = state.isGrounded || state.coyoteTime > 0;
    
    // Only jump on the rising edge of the jump input (key press, not hold)
    if (input.jump && !state.wasJumpPressed && canJump && !state.isJumping) {
      body.setVelocityY(-GAME_CONFIG.PLAYER.JUMP_POWER);
      state.coyoteTime = 0;
      state.isJumping = true;
    }
    
    // Reset jump state when grounded
    if (state.isGrounded) {
      state.isJumping = false;
    }
    
    // Track jump button state for edge detection
    state.wasJumpPressed = input.jump;
  }
  
  /**
   * Update dynamic gravity based on movement state
   */
  private updateGravity(
    body: Phaser.Physics.Arcade.Body,
    input: MovementInput,
    state: MovementState
  ): void {
    if (state.isDashing) {
      // No gravity during dash
      body.setGravityY(0);
      return;
    }
    
    if (!state.isGrounded) {
      const isFastFalling = input.down && body.velocity.y > 0;
      
      if (isFastFalling) {
        body.setGravityY(GAME_CONFIG.PLAYER.GRAVITY.FAST_FALL);
      } else if (body.velocity.y < -50) {
        body.setGravityY(GAME_CONFIG.PLAYER.GRAVITY.ASCENDING);
      } else if (body.velocity.y >= -50 && body.velocity.y <= 30) {
        body.setGravityY(GAME_CONFIG.PLAYER.GRAVITY.HANG_TIME);
      } else {
        body.setGravityY(GAME_CONFIG.PLAYER.GRAVITY.FALLING);
      }
    } else {
      body.setGravityY(0);
    }
  }
  
  /**
   * Initiate a dash if possible
   */
  public startDash(
    body: Phaser.Physics.Arcade.Body,
    input: MovementInput,
    state: MovementState,
    dashState: DashState
  ): boolean {
    // Check if dash is possible
    if (!state.canDash || state.dashCooldown > 0 || state.isDashing || state.isGrounded) {
      return false;
    }
    
    // Determine dash direction
    let dashX = 0;
    let dashY = 0;
    
    // Store initial directions
    dashState.initialDirections = {
      left: input.left,
      right: input.right,
      up: input.up,
      down: input.down
    };
    
    if (input.left) dashX = -1;
    if (input.right) dashX = 1;
    if (input.up) dashY = -1;
    if (input.down) dashY = 1;
    
    // Default to facing direction if no input
    if (dashX === 0 && dashY === 0) {
      dashX = state.facingDirection;
      if (state.facingDirection < 0) {
        dashState.initialDirections.left = true;
      } else {
        dashState.initialDirections.right = true;
      }
    }
    
    // Normalize diagonal dashes
    const magnitude = Math.sqrt(dashX * dashX + dashY * dashY);
    if (magnitude > 0) {
      dashX /= magnitude;
      dashY /= magnitude;
    }
    
    // Apply dash velocity
    const dashPower = GAME_CONFIG.PLAYER.DASH.POWER;
    body.setVelocity(dashX * dashPower, dashY * dashPower);
    
    // Disable gravity during dash
    body.setAllowGravity(false);
    
    // Update state
    state.isDashing = true;
    state.canDash = false;
    state.dashCooldown = GAME_CONFIG.PLAYER.DASH.COOLDOWN;
    dashState.active = true;
    dashState.startTime = this.scene.time.now;
    
    return true;
  }
  
  /**
   * Update ongoing dash
   */
  public updateDash(
    body: Phaser.Physics.Arcade.Body,
    input: MovementInput,
    state: MovementState,
    dashState: DashState
  ): void {
    if (!state.isDashing) return;
    
    // Check if dash duration has expired
    const dashElapsed = this.scene.time.now - dashState.startTime;
    if (dashElapsed >= GAME_CONFIG.PLAYER.DASH.DURATION) {
      this.endDash(body, state, dashState);
      return;
    }
    
    // Check if still holding initial direction
    const stillHolding = 
      (dashState.initialDirections.left && input.left) ||
      (dashState.initialDirections.right && input.right) ||
      (dashState.initialDirections.up && input.up) ||
      (dashState.initialDirections.down && input.down);
    
    if (!stillHolding) {
      this.endDash(body, state, dashState);
    }
  }
  
  /**
   * End the dash
   */
  private endDash(
    body: Phaser.Physics.Arcade.Body,
    state: MovementState,
    dashState: DashState
  ): void {
    state.isDashing = false;
    dashState.active = false;
    
    // Reduce velocity
    body.setVelocity(body.velocity.x * 0.7, body.velocity.y * 0.7);
    
    // Re-enable gravity
    body.setAllowGravity(true);
    
    // Reset dash directions
    dashState.initialDirections = {
      left: false,
      right: false,
      up: false,
      down: false
    };
  }
  
  /**
   * Apply fast fall if conditions are met
   */
  public applyFastFall(
    body: Phaser.Physics.Arcade.Body,
    input: MovementInput,
    state: MovementState
  ): void {
    if (input.down && !state.isGrounded && !state.isDashing) {
      body.setVelocityY(Math.max(body.velocity.y, 300));
    }
  }
  
  /**
   * Create initial movement state
   */
  public static createMovementState(): MovementState {
    return {
      isGrounded: false,
      wasGrounded: false,
      isJumping: false,
      isDashing: false,
      canDash: true,
      dashCooldown: 0,
      coyoteTime: 0,
      facingDirection: 1,
      wasJumpPressed: false,
      wasDashPressed: false
    };
  }
  
  /**
   * Create initial dash state
   */
  public static createDashState(): DashState {
    return {
      active: false,
      startTime: 0,
      initialDirections: {
        left: false,
        right: false,
        up: false,
        down: false
      }
    };
  }
} 