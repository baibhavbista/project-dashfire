import Phaser from 'phaser';
import { BasePlayer } from './BasePlayer';
import { GAME_CONFIG, Team } from '../config/GameConfig';
import { INPUT_CONFIG } from '../config/InputConfig';

/**
 * Local player class that handles input and movement
 * Extends BasePlayer with input handling and local physics
 */
export class LocalPlayer extends BasePlayer {
  // Input
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private jumpKey!: Phaser.Input.Keyboard.Key;
  private dashKey!: Phaser.Input.Keyboard.Key;
  private shootKey!: Phaser.Input.Keyboard.Key;
  private shootKeyAlt!: Phaser.Input.Keyboard.Key;
  
  // Movement state
  private coyoteTime: number = 0;
  private canDash: boolean = true;
  private dashCooldown: number = 0;
  
  // Dash buffering
  private dashBuffering: boolean = false;
  private dashBufferTime: number = 0;
  private initialDashDirections = {
    left: false,
    right: false,
    up: false,
    down: false
  };
  
  // Jump animation state
  private jumpVelocity: number = 0;
  private landingRecoveryTime: number = 0;
  private justLandedThisFrame: boolean = false;
  
  // Events
  public events: Phaser.Events.EventEmitter;
  
  constructor(
    scene: Phaser.Scene, 
    id: string,
    x: number, 
    y: number, 
    team: Team,
    playerName: string = 'You'
  ) {
    super(scene, id, x, y, team, playerName, true);
    
    // Enable collision and gravity for local player
    this.setCollideWorldBounds(true);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setGravityY(0); // We'll manage gravity dynamically
    
    // Create event emitter for communicating with GameScene
    this.events = new Phaser.Events.EventEmitter();
    
    // Set up input
    this.setupInput();
  }
  
  private setupInput(): void {
    if (!this.scene.input.keyboard) {
      throw new Error('Keyboard input not available');
    }
    
    this.cursors = this.scene.input.keyboard.createCursorKeys();
    this.jumpKey = this.scene.input.keyboard.addKey(INPUT_CONFIG.ACTIONS.JUMP);
    this.dashKey = this.scene.input.keyboard.addKey(INPUT_CONFIG.ACTIONS.DASH);
    this.shootKey = this.scene.input.keyboard.addKey(INPUT_CONFIG.ACTIONS.SHOOT_PRIMARY);
    this.shootKeyAlt = this.scene.input.keyboard.addKey(INPUT_CONFIG.ACTIONS.SHOOT_SECONDARY);
  }
  
  update(time: number, delta: number): void {
    // Skip if dead
    if (this.isDead) return;
    
    const body = this.body as Phaser.Physics.Arcade.Body;
    
    // Update ground state
    this.wasGrounded = this.isGrounded;
    this.isGrounded = body.blocked.down || body.touching.down;
    
    // Detect landing
    this.justLandedThisFrame = !this.wasGrounded && this.isGrounded && body.velocity.y > 50;
    
    // Handle input and movement
    this.handleMovement(delta);
    this.handleJumping();
    this.handleDashing(delta);
    this.handleShooting();
    
    // Update dynamic gravity
    this.updateGravity();
    
    // Update animations
    this.updateJumpAnimations(body.velocity.y);
    this.updateCharacterAnimations(body.velocity.x);
    
    // Update UI positions (for direction indicator)
    this.updateUIPositions();
    
    // Emit position update for networking
    this.events.emit('position-update', {
      x: this.x,
      y: this.y,
      velocityX: body.velocity.x,
      velocityY: body.velocity.y,
      flipX: this.flipX
    });
  }
  
  private handleMovement(delta: number): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    const currentVelX = body.velocity.x;
    const maxSpeed = GAME_CONFIG.PLAYER.MAX_SPEED;
    const acceleration = GAME_CONFIG.PLAYER.ACCELERATION;
    const friction = GAME_CONFIG.PLAYER.FRICTION;
    
    // Horizontal movement
    if (this.cursors.left.isDown) {
      const newVelX = Math.max(currentVelX - acceleration * (delta / 1000), -maxSpeed);
      this.setVelocityX(newVelX);
      this.setFlipX(true);
    } else if (this.cursors.right.isDown) {
      const newVelX = Math.min(currentVelX + acceleration * (delta / 1000), maxSpeed);
      this.setVelocityX(newVelX);
      this.setFlipX(false);
    } else {
      // Apply friction
      if (Math.abs(currentVelX) > 10) {
        const frictionForce = friction * (delta / 1000);
        if (currentVelX > 0) {
          this.setVelocityX(Math.max(0, currentVelX - frictionForce));
        } else {
          this.setVelocityX(Math.min(0, currentVelX + frictionForce));
        }
      } else {
        this.setVelocityX(0);
      }
    }
  }
  
  private handleJumping(): void {
    
    // Update coyote time
    if (this.isGrounded) {
      this.coyoteTime = GAME_CONFIG.PLAYER.COYOTE_TIME_MS;
    } else if (this.coyoteTime > 0) {
      this.coyoteTime -= this.scene.game.loop.delta;
    }
    
    // Jump if allowed
    const canJump = this.isGrounded || this.coyoteTime > 0;
    if (Phaser.Input.Keyboard.JustDown(this.jumpKey) && canJump) {
      this.setVelocityY(-GAME_CONFIG.PLAYER.JUMP_POWER);
      this.coyoteTime = 0;
      this.jumpVelocity = -GAME_CONFIG.PLAYER.JUMP_POWER;
      
      // Emit jump event for sound/particles
      this.events.emit('jump');
    }
  }
  
  private handleDashing(delta: number): void {
    // Update dash cooldown
    if (this.dashCooldown > 0) {
      this.dashCooldown -= delta;
    }
    
    // Reset dash ability when touching ground
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (body.touching.down) {
      this.canDash = true;
      if (this.dashBuffering) {
        this.dashBuffering = false;
        this.dashBufferTime = 0;
      }
    }
    
    // Handle dash buffering
    if (this.dashBuffering) {
      this.dashBufferTime += delta;
      
      if (this.dashBufferTime >= GAME_CONFIG.PLAYER.DASH.BUFFER_WINDOW_MS) {
        this.dashBuffering = false;
        this.dashBufferTime = 0;
        this.performDash();
      }
    } else {
      // Start dash buffer on key press
      if (Phaser.Input.Keyboard.JustDown(this.dashKey) && 
          this.canDash && 
          this.dashCooldown <= 0 && 
          !this._isDashing && 
          !body.touching.down) {
        this.dashBuffering = true;
        this.dashBufferTime = 0;
      }
    }
    
    // Handle ongoing dash
    if (this.isDashing) {
      // Check if still holding direction
      const stillHolding = 
        (this.initialDashDirections.left && this.cursors.left.isDown) ||
        (this.initialDashDirections.right && this.cursors.right.isDown) ||
        (this.initialDashDirections.up && this.cursors.up.isDown) ||
        (this.initialDashDirections.down && this.cursors.down.isDown);
      
      if (!stillHolding) {
        this.endDash();
      } else {
        // Create dash trail
        if (Math.random() < 0.8) {
          this.createDashTrail();
        }
      }
    }
  }
  
  private performDash(): void {
    // Determine dash direction
    let dashX = 0;
    let dashY = 0;
    
    // Store initial directions
    this.initialDashDirections.left = this.cursors.left.isDown;
    this.initialDashDirections.right = this.cursors.right.isDown;
    this.initialDashDirections.up = this.cursors.up.isDown;
    this.initialDashDirections.down = this.cursors.down.isDown;
    
    if (this.initialDashDirections.left) dashX = -1;
    if (this.initialDashDirections.right) dashX = 1;
    if (this.initialDashDirections.up) dashY = -1;
    if (this.initialDashDirections.down) dashY = 1;
    
    // Default to facing direction if no input
    if (dashX === 0 && dashY === 0) {
      dashX = this.flipX ? -1 : 1;
      if (this.flipX) {
        this.initialDashDirections.left = true;
      } else {
        this.initialDashDirections.right = true;
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
    this.setVelocity(dashX * dashPower, dashY * dashPower);
    
    // Set dash state
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.allowGravity = false;
    this._isDashing = true;
    this.canDash = false;
    this.dashCooldown = GAME_CONFIG.PLAYER.DASH.COOLDOWN;
    
    // Emit dash event
    this.events.emit('dash-start');
    
    // End dash after duration
    this.scene.time.delayedCall(GAME_CONFIG.PLAYER.DASH.DURATION, () => {
      if (this.isDashing) {
        this.endDash();
      }
    });
  }
  
  private endDash(): void {
    this._isDashing = false;
    
    // Reduce velocity
    const body = this.body as Phaser.Physics.Arcade.Body;
    this.setVelocity(body.velocity.x * 0.7, body.velocity.y * 0.7);
    
    // Re-enable gravity
    body.allowGravity = true;
    
    // Reset dash directions
    this.initialDashDirections.left = false;
    this.initialDashDirections.right = false;
    this.initialDashDirections.up = false;
    this.initialDashDirections.down = false;
    
    // Emit dash end event
    this.events.emit('dash-end');
  }
  
  private handleShooting(): void {
    if (Phaser.Input.Keyboard.JustDown(this.shootKey) || 
        Phaser.Input.Keyboard.JustDown(this.shootKeyAlt)) {
      this.events.emit('shoot', {
        x: this.x,
        y: this.y,
        direction: this.flipX ? -1 : 1,
        team: this.team
      });
    }
  }
  
  private updateGravity(): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    
    if (!this.isDashing) {
      if (!body.touching.down) {
        const isFastFalling = this.cursors.down.isDown && body.velocity.y > 0;
        
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
  }
  
  private updateJumpAnimations(velocityY: number): void {
    // Handle landing
    if (this.justLandedThisFrame) {
      this.createLandingSquash();
      this.landingRecoveryTime = Date.now();
      this.events.emit('land');
    }
    
    // Jump stretch/squash
    if (!this.isGrounded && !this.isDashing) {
      if (velocityY < 0) {
        // Rising - stretch
        const t = Math.min(-velocityY / 800, 1);
        const stretchY = 1 + (GAME_CONFIG.ANIMATION.JUMP.MAX_STRETCH - 1) * t;
        this.targetScaleY = stretchY;
        this.targetScaleX = 1 / stretchY;
      } else {
        // Falling - compress
        const t = Math.min(velocityY / 400, 1);
        const compressY = 1 + (GAME_CONFIG.ANIMATION.JUMP.MAX_STRETCH - 1) * (1 - t);
        this.targetScaleY = compressY;
        this.targetScaleX = 1 / compressY;
      }
      
      // Apply smooth scaling
      const dt = this.scene.game.loop.delta / 1000;
      this.setScale(
        this.scaleX + (this.targetScaleX - this.scaleX) * GAME_CONFIG.ANIMATION.JUMP.STRETCH_SPEED * dt,
        this.scaleY + (this.targetScaleY - this.scaleY) * GAME_CONFIG.ANIMATION.JUMP.STRETCH_SPEED * dt
      );
    } else if (!this.landingSquashTween) {
      // Return to normal when grounded
      this.targetScaleX = 1;
      this.targetScaleY = 1;
      
      const dt = this.scene.game.loop.delta / 1000;
      this.setScale(
        this.scaleX + (this.targetScaleX - this.scaleX) * GAME_CONFIG.ANIMATION.JUMP.STRETCH_SPEED * dt,
        this.scaleY + (this.targetScaleY - this.scaleY) * GAME_CONFIG.ANIMATION.JUMP.STRETCH_SPEED * dt
      );
    }
  }
  
  /**
   * Fast fall if holding down
   */
  public fastFall(): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (this.cursors.down.isDown && !body.touching.down && !this.isDashing) {
      this.setVelocityY(Math.max(body.velocity.y, 300));
    }
  }
  
  /**
   * Get current dash cooldown remaining
   */
  public getDashCooldown(): number {
    return Math.max(0, this.dashCooldown);
  }
  
  /**
   * Check if player can currently dash
   */
  public getCanDash(): boolean {
    return this.canDash && this.dashCooldown <= 0 && !this.isDashing;
  }
} 