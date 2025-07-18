import Phaser from 'phaser';
import { BasePlayer } from './BasePlayer';
import { GAME_CONFIG, Team } from '../config/GameConfig';
import { INPUT_CONFIG } from '../config/InputConfig';
import { MovementSystem, MovementInput, MovementState } from '../systems/MovementSystem';

/**
 * Local player class that handles input and uses MovementSystem
 * Extends BasePlayer with input handling
 */
export class LocalPlayer extends BasePlayer {
  // Input
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private jumpKey!: Phaser.Input.Keyboard.Key;
  private dashKey!: Phaser.Input.Keyboard.Key;
  private shootKey!: Phaser.Input.Keyboard.Key;
  private shootKeyAlt!: Phaser.Input.Keyboard.Key;
  
  // Movement system
  private movementSystem: MovementSystem;
  private movementState: MovementState;
  private dashState: ReturnType<typeof MovementSystem.createDashState>;
  
  // Dash buffering
  private dashBuffering: boolean = false;
  private dashBufferTime: number = 0;
  
  // Events
  public events: Phaser.Events.EventEmitter;
  
  // Previous jump state for edge detection
  private wasJumpPressed: boolean = false;
  
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
    body.setGravityY(0); // MovementSystem will manage gravity
    
    // Initialize movement system
    this.movementSystem = new MovementSystem(scene);
    this.movementState = MovementSystem.createMovementState();
    this.dashState = MovementSystem.createDashState();
    
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
    
    // Gather input
    const input: MovementInput = {
      left: this.cursors.left.isDown,
      right: this.cursors.right.isDown,
      up: this.cursors.up.isDown,
      down: this.cursors.down.isDown,
      jump: this.jumpKey.isDown,
      dash: this.dashKey.isDown
    };
    
    // Update movement through system
    this.movementSystem.updateMovement(body, input, this.movementState, delta);
    
    // Handle dash buffering and execution
    this.handleDashBuffering(body, input, delta);
    
    // Update ongoing dash
    this.movementSystem.updateDash(body, input, this.movementState, this.dashState);
    
    // Handle shooting
    this.handleShooting();
    
    // Detect state changes for events
    this.detectStateChanges(input, body);
    
    // Update facing direction
    if (this.movementState.facingDirection !== 0) {
      this.setFlipX(this.movementState.facingDirection < 0);
    }
    
    // Update animations based on state
    this.updateAnimationsFromState();
    
    // Emit position update for networking
    this.events.emit('position-update', {
      x: this.x,
      y: this.y,
      velocityX: body.velocity.x,
      velocityY: body.velocity.y,
      flipX: this.flipX
    });
  }
  
  private handleDashBuffering(body: Phaser.Physics.Arcade.Body, input: MovementInput, delta: number): void {
    // Handle dash buffering
    if (this.dashBuffering) {
      this.dashBufferTime += delta;
      
      if (this.dashBufferTime >= GAME_CONFIG.PLAYER.DASH.BUFFER_WINDOW_MS) {
        this.dashBuffering = false;
        this.dashBufferTime = 0;
        this.tryDash(body, input);
      }
    } else {
      // Start dash buffer on key press
      if (Phaser.Input.Keyboard.JustDown(this.dashKey) && 
          this.movementState.canDash && 
          this.movementState.dashCooldown <= 0 && 
          !this.movementState.isDashing && 
          !this.movementState.isGrounded) {
        this.dashBuffering = true;
        this.dashBufferTime = 0;
      }
    }
  }
  
  private tryDash(body: Phaser.Physics.Arcade.Body, input: MovementInput): void {
    if (this.movementSystem.startDash(body, input, this.movementState, this.dashState)) {
      this._isDashing = true;
      this.events.emit('dash-start');
      
      // Schedule dash end
      this.scene.time.delayedCall(GAME_CONFIG.PLAYER.DASH.DURATION, () => {
        if (this._isDashing) {
          this.endDashAnimation();
        }
      });
    }
  }
  
  private endDashAnimation(): void {
    this._isDashing = false;
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
  
  private detectStateChanges(input: MovementInput, body: Phaser.Physics.Arcade.Body): void {
    // Jump detection
    if (input.jump && !this.wasJumpPressed && this.movementState.isJumping) {
      this.events.emit('jump');
    }
    this.wasJumpPressed = input.jump;
    
    // Landing detection
    if (!this.wasGrounded && this.isGrounded && body.velocity.y > 50) {
      this.createLandingSquash();
      this.events.emit('land');
    }
    
    // Update ground state for BasePlayer animations
    this.wasGrounded = this.isGrounded;
    this.isGrounded = this.movementState.isGrounded;
  }
  
  private updateAnimationsFromState(): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    
    // Update character animations from BasePlayer
    this.updateCharacterAnimations(body.velocity.x);
    
    // Update jump animations
    this.updateJumpAnimations(body.velocity.y);
    
    // Create dash trails while dashing
    if (this._isDashing && Math.random() < 0.8) {
      this.createDashTrail();
    }
  }
  
  private updateJumpAnimations(velocityY: number): void {
    // Jump stretch/squash
    if (!this.isGrounded && !this._isDashing) {
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
   * Get current dash cooldown remaining
   */
  public getDashCooldown(): number {
    return Math.max(0, this.movementState.dashCooldown);
  }
  
  /**
   * Check if player can currently dash
   */
  public getCanDash(): boolean {
    return this.movementState.canDash && this.movementState.dashCooldown <= 0 && !this._isDashing;
  }
} 