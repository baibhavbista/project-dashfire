import Phaser from 'phaser';
import { BasePlayer } from './BasePlayer';
import { Team } from '../config/GameConfig';
import { MovementController } from '../systems/MovementController';
import { MovementInput } from '../systems/MovementSystem';

/**
 * AI behavior types
 */
export enum AIBehavior {
  AGGRESSIVE = 'aggressive', // Always chase and attack
  DEFENSIVE = 'defensive',   // Keep distance and shoot
  PATROL = 'patrol'         // Patrol area until player spotted
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
   * Set the target for AI to track (usually the player)
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
    
    // Update animations
    this.updateAnimationsFromState(body.velocity);
  }
  
  /**
   * Calculate AI input based on behavior and game state
   */
  private calculateAIInput(time: number): MovementInput {
    // If no target, just patrol
    if (!this.target || !this.target.active) {
      return this.getPatrolInput(time);
    }
    
    const distance = Phaser.Math.Distance.Between(
      this.x, this.y,
      this.target.x, this.target.y
    );
    
    // Check if target is in sight range
    if (distance > this.SIGHT_RANGE) {
      return this.getPatrolInput(time);
    }
    
    // Apply behavior-specific logic
    switch (this.behavior) {
      case AIBehavior.AGGRESSIVE:
        return this.getAggressiveInput(distance);
      case AIBehavior.DEFENSIVE:
        return this.getDefensiveInput(distance);
      case AIBehavior.PATROL:
      default:
        // If target spotted while patrolling, become aggressive
        return this.getAggressiveInput(distance);
    }
  }
  
  /**
   * Patrol behavior - walk back and forth
   */
  private getPatrolInput(time: number): MovementInput {
    const input: MovementInput = {
      left: false,
      right: false,
      up: false,
      down: false,
      jump: false,
      dash: false
    };
    
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
    
    // Occasionally jump
    if (Math.random() < 0.01) {
      input.jump = true;
    }
    
    return input;
  }
  
  /**
   * Aggressive behavior - chase and attack
   */
  private getAggressiveInput(distance: number): MovementInput {
    const input: MovementInput = {
      left: false,
      right: false,
      up: false,
      down: false,
      jump: false,
      dash: false
    };
    
    if (!this.target) return input;
    
    const dx = this.target.x - this.x;
    const dy = this.target.y - this.y;
    
    // Horizontal movement
    if (Math.abs(dx) > 20) {
      if (dx < 0) {
        input.left = true;
      } else {
        input.right = true;
      }
    }
    
    // Jump if target is above
    if (dy < -50 && this.movementController.getState().isGrounded) {
      input.jump = true;
    }
    
    // Dash towards target if far away and can dash
    if (distance > 200 && distance < 400 && this.movementController.canDash()) {
      input.dash = true;
    }
    
    // Attack if in range
    if (distance < this.ATTACK_RANGE && this.attackCooldown <= 0) {
      this.performAttack();
    }
    
    return input;
  }
  
  /**
   * Defensive behavior - keep distance and shoot
   */
  private getDefensiveInput(distance: number): MovementInput {
    const input: MovementInput = {
      left: false,
      right: false,
      up: false,
      down: false,
      jump: false,
      dash: false
    };
    
    if (!this.target) return input;
    
    const dx = this.target.x - this.x;
    const optimalDistance = 250;
    
    // Try to maintain optimal distance
    if (distance < optimalDistance - 50) {
      // Too close, back away
      if (dx < 0) {
        input.right = true;
      } else {
        input.left = true;
      }
      
      // Dash away if too close
      if (distance < 100 && this.movementController.canDash()) {
        input.dash = true;
      }
    } else if (distance > optimalDistance + 50) {
      // Too far, move closer
      if (dx < 0) {
        input.left = true;
      } else {
        input.right = true;
      }
    }
    
    // Jump occasionally to be evasive
    if (Math.random() < 0.02 && this.movementController.getState().isGrounded) {
      input.jump = true;
    }
    
    // Attack from distance
    if (distance < this.ATTACK_RANGE && this.attackCooldown <= 0) {
      this.performAttack();
    }
    
    return input;
  }
  
  /**
   * Perform attack action
   */
  private performAttack(): void {
    // This would emit a shoot event or call weapon system
    // For now, just set cooldown
    this.attackCooldown = this.ATTACK_COOLDOWN;
    
    // Could emit event: this.events.emit('shoot', {...});
  }
  
  /**
   * Handle jump event
   */
  private handleJump(): void {
    // Could add effects or sounds
  }
  
  /**
   * Handle landing event
   */
  private handleLanding(): void {
    this.createLandingSquash();
  }
  
  /**
   * Update animations based on velocity
   */
  private updateAnimationsFromState(velocity: Phaser.Math.Vector2): void {
    // Update character animations
    this.updateCharacterAnimations(velocity.x);
    
    // Create dash trails while dashing
    if (this._isDashing && Math.random() < 0.8) {
      this.createDashTrail();
    }
  }
  
  /**
   * Change AI behavior
   */
  public setBehavior(behavior: AIBehavior): void {
    this.behavior = behavior;
  }
  
  /**
   * Get current dash cooldown
   */
  public getDashCooldown(): number {
    return this.movementController.getDashCooldown();
  }
} 