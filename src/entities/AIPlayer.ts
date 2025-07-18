import Phaser from 'phaser';
import { BasePlayer } from './BasePlayer';
import { Team } from '../config/GameConfig';
import { MovementController } from '../systems/MovementController';
import { MovementInput } from '../systems/MovementSystem';

/**
 * AI behavior types
 */
export enum AIBehavior {
  AGGRESSIVE = 'aggressive',  // Actively hunts players
  DEFENSIVE = 'defensive',    // Guards area, attacks when approached
  PATROL = 'patrol'          // Patrols between points
}

/**
 * AI Player that uses MovementController for physics
 * Example implementation showing how MovementSystem can be reused
 */
export class AIPlayer extends BasePlayer {
  private movementController: MovementController;
  private behavior: AIBehavior;
  private target?: Phaser.GameObjects.Sprite;
  private patrolDirection: number = 1;
  private lastDirectionChange: number = 0;
  private attackCooldown: number = 0;
  
  // AI parameters
  private readonly SIGHT_RANGE = 400;
  private readonly ATTACK_RANGE = 300;
  private readonly PATROL_SPEED = 0.5;
  private readonly DIRECTION_CHANGE_TIME = 3000;
  private readonly ATTACK_COOLDOWN = 1000;
  
  constructor(
    scene: Phaser.Scene,
    id: string,
    x: number,
    y: number,
    team: Team,
    behavior: AIBehavior = AIBehavior.PATROL,
    name: string = 'AI'
  ) {
    super(scene, id, x, y, team, name, false);
    
    this.behavior = behavior;
    
    // Set up physics
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setCollideWorldBounds(true);
    body.setGravityY(0); // MovementController will handle gravity
    
    // Initialize movement controller with event handlers
    this.movementController = new MovementController(scene, {
      onJump: () => this.handleJump(),
      onLand: () => this.handleLanding(),
      onDashStart: () => this._isDashing = true,
      onDashEnd: () => this._isDashing = false
    });
  }
  
  /**
   * Set AI target (for aggressive/defensive behaviors)
   */
  public setTarget(target: Phaser.GameObjects.Sprite): void {
    this.target = target;
  }
  
  /**
   * Update AI logic and movement
   */
  public update(time: number, delta: number): void {
    if (this.isDead) return;
    
    // Update attack cooldown
    if (this.attackCooldown > 0) {
      this.attackCooldown -= delta;
    }
    
    // Get movement input based on AI behavior
    const input = this.calculateAIInput(time);
    
    // Update movement through controller
    const body = this.body as Phaser.Physics.Arcade.Body;
    this.movementController.update(body, input, delta);
    
    // Update facing direction
    const state = this.movementController.getState();
    if (state.facingDirection !== 0) {
      this.setFlipX(state.facingDirection < 0);
    }
    
    // Update animations through AnimationController
    this.animationController.update(
      body.velocity.x,
      body.velocity.y,
      state.isGrounded,
      this._isDashing,
      delta
    );
    
    // Create dash trails while dashing
    if (this._isDashing && Math.random() < 0.8) {
      this.createDashTrail();
    }
  }
  
  /**
   * Calculate AI input based on behavior
   */
  private calculateAIInput(time: number): MovementInput {
    const input: MovementInput = {
      left: false,
      right: false,
      up: false,
      down: false,
      jump: false,
      dash: false
    };
    
    switch (this.behavior) {
      case AIBehavior.AGGRESSIVE:
        this.calculateAggressiveInput(input);
        break;
      case AIBehavior.DEFENSIVE:
        this.calculateDefensiveInput(input);
        break;
      case AIBehavior.PATROL:
        this.calculatePatrolInput(input, time);
        break;
    }
    
    return input;
  }
  
  /**
   * Aggressive AI - actively hunts the target
   */
  private calculateAggressiveInput(input: MovementInput): void {
    if (!this.target || !this.target.active) return;
    
    const dx = this.target.x - this.x;
    const dy = this.target.y - this.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // Only pursue if within sight range
    if (distance > this.SIGHT_RANGE) return;
    
    // Move towards target
    if (Math.abs(dx) > 20) {
      if (dx > 0) {
        input.right = true;
      } else {
        input.left = true;
      }
    }
    
    // Jump if target is above and close enough
    if (dy < -50 && Math.abs(dx) < 100) {
      input.jump = true;
    }
    
    // Dash towards target if medium distance
    if (distance > 150 && distance < 300 && Math.random() < 0.02) {
      input.dash = true;
    }
    
    // Attack if in range
    if (distance < this.ATTACK_RANGE && this.attackCooldown <= 0) {
      this.performAttack();
    }
  }
  
  /**
   * Defensive AI - guards position, attacks when approached
   */
  private calculateDefensiveInput(input: MovementInput): void {
    if (!this.target || !this.target.active) return;
    
    const dx = this.target.x - this.x;
    const dy = this.target.y - this.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // Only react if target is close
    if (distance > this.ATTACK_RANGE) return;
    
    // Face the target
    if (Math.abs(dx) > 10) {
      if (dx > 0) {
        input.right = true;
      } else {
        input.left = true;
      }
      
      // Move back and forth slightly
      if (Math.sin(Date.now() * 0.001) > 0) {
        input.left = !input.left;
        input.right = !input.right;
      }
    }
    
    // Jump defensively
    if (Math.random() < 0.01) {
      input.jump = true;
    }
    
    // Dash away if too close
    if (distance < 100 && Math.random() < 0.05) {
      input.dash = true;
      // Dash away from target
      input.left = dx > 0;
      input.right = dx < 0;
    }
    
    // Attack if in range
    if (distance < this.ATTACK_RANGE && this.attackCooldown <= 0) {
      this.performAttack();
    }
  }
  
  /**
   * Patrol AI - moves back and forth
   */
  private calculatePatrolInput(input: MovementInput, time: number): void {
    // Change direction periodically
    if (time - this.lastDirectionChange > this.DIRECTION_CHANGE_TIME) {
      this.patrolDirection *= -1;
      this.lastDirectionChange = time;
    }
    
    // Move in patrol direction
    if (this.patrolDirection > 0) {
      input.right = true;
    } else {
      input.left = true;
    }
    
    // Random jump
    if (Math.random() < 0.005) {
      input.jump = true;
    }
    
    // Random dash
    if (Math.random() < 0.002) {
      input.dash = true;
    }
    
    // Check for nearby enemies
    if (this.target && this.target.active) {
      const dx = this.target.x - this.x;
      const distance = Math.abs(dx);
      
      if (distance < this.SIGHT_RANGE) {
        // Switch to aggressive temporarily
        this.calculateAggressiveInput(input);
      }
    }
  }
  
  /**
   * Perform attack action
   */
  private performAttack(): void {
    // Set cooldown
    this.attackCooldown = this.ATTACK_COOLDOWN;
    
    // Emit attack event (could be connected to weapon system)
    console.log(`AI ${this.id} attacks!`);
  }
  
  /**
   * Handle jump event
   */
  private handleJump(): void {
    // Could play jump sound or create particles
    console.log(`AI ${this.id} jumps`);
  }
  
  /**
   * Handle landing event
   */
  private handleLanding(): void {
    // Could create landing particles
    console.log(`AI ${this.id} lands`);
  }
  
  /**
   * Override landing animation event
   */
  protected onLandingSquash(): void {
    this.handleLanding();
  }
  
  /**
   * Get current behavior
   */
  public getBehavior(): AIBehavior {
    return this.behavior;
  }
  
  /**
   * Set behavior
   */
  public setBehavior(behavior: AIBehavior): void {
    this.behavior = behavior;
  }
  
  /**
   * Clean up resources
   */
  public destroy(fromScene?: boolean): void {
    // Movement controller doesn't need explicit cleanup
    super.destroy(fromScene);
  }
} 