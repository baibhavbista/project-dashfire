import Phaser from 'phaser';
import { COLORS, getTeamColors } from '../config/Colors';

/**
 * Centralized effects system for managing all visual effects
 * Handles particles, screen effects, and other visual feedback
 */
export class EffectsSystem {
  private scene: Phaser.Scene;
  private dustParticles?: Phaser.GameObjects.Particles.ParticleEmitter;
  
  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }
  
  /**
   * Initialize the effects system - must be called in scene create
   */
  public initialize(): void {
    this.createDustParticles();
  }
  
  /**
   * Create dust particle emitter for landing/jumping effects
   */
  private createDustParticles(): void {
    // Create dust particles for landing effects - subtle and matching platform color
    const particles = this.scene.add.particles(0, 0, 'white-rect', {
      scale: { start: 0.05, end: 0.15 },
      speed: { min: 30, max: 60 },
      lifespan: 400,
      quantity: 0,
      tint: COLORS.EFFECTS.DUST,
      alpha: { start: 0.5, end: 0 }
    });

    // Store particles for later use
    this.dustParticles = particles;
  }
  
  /**
   * Create dust effect at position (for jumps/landings)
   */
  public createDustEffect(x: number, y: number, quantity: number): void {
    if (this.dustParticles) {
      this.dustParticles.setPosition(x, y);
      this.dustParticles.explode(quantity);
    }
  }
  
  /**
   * Create hit effect when player takes damage
   */
  public createHitEffect(x: number, y: number): void {
    // Use a particle emitter for more control
    const particles = this.scene.add.particles(x, y, 'white-rect', {
      blendMode: Phaser.BlendModes.ADD,
      scale: { start: 0.5, end: 0 },
      speed: { min: 80, max: 150 },
      lifespan: 400,
      quantity: 8,
      tint: COLORS.EFFECTS.HIT,
      alpha: { start: 0.8, end: 0 },
    });

    // Emitter self-destructs after particles are gone
    this.scene.time.delayedCall(1000, () => particles.destroy());
    
    // Flash the screen slightly
    this.scene.cameras.main.flash(100, 255, 0, 0, false);
    // Add a very subtle shake for a hit
    this.scene.cameras.main.shake(100, 0.005);
  }
  
  /**
   * Create death effect with team-colored particles
   */
  public createDeathEffect(x: number, y: number, team: 'red' | 'blue'): void {
    const teamColors = getTeamColors(team);
    const teamColor = teamColors.GLOW;

    // Create a particle emitter for the death burst
    const particles = this.scene.add.particles(x, y, 'white-rect', {
      blendMode: Phaser.BlendModes.ADD,
      scale: { start: 0.7, end: 0 },
      speed: { min: 100, max: 250 },
      lifespan: 800,
      quantity: 20,
      tint: teamColor,
      alpha: { start: 0.9, end: 0 },
    });

    // Emitter self-destructs
    this.scene.time.delayedCall(1500, () => particles.destroy());
    
    // Create expanding ring effect
    const ring = this.scene.add.circle(x, y, 10, teamColor, 0);
    ring.setStrokeStyle(3, teamColor);
    
    this.scene.tweens.add({
      targets: ring,
      scale: 4,
      alpha: 0,
      duration: 600,
      ease: 'Power2',
      onComplete: () => ring.destroy()
    });

    // Add a more noticeable shake for a death
    this.scene.cameras.main.shake(250, 0.01);
  }
  
  /**
   * Create bullet impact effect on platforms
   */
  public createBulletImpactEffect(x: number, y: number): void {
    // Create small particle burst for bullet impact
    const particles = this.scene.add.particles(x, y, 'white-rect', {
      scale: { start: 0.4, end: 0 },
      speed: { min: 40, max: 80 },
      lifespan: 300,
      quantity: 5,
      tint: COLORS.EFFECTS.BULLET_IMPACT,
      alpha: { start: 0.7, end: 0 },
    });

    // Emitter self-destructs
    this.scene.time.delayedCall(1000, () => particles.destroy());
  }
  
  /**
   * Clean up all effects
   */
  public destroy(): void {
    if (this.dustParticles) {
      this.dustParticles.destroy();
      this.dustParticles = undefined;
    }
  }
} 