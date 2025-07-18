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
    // Create a burst of red particles for hit effect
    const particleCount = 5;
    
    for (let i = 0; i < particleCount; i++) {
      const particle = this.scene.add.circle(x, y, 3, COLORS.EFFECTS.HIT);
      
      // Random direction
      const angle = (Math.PI * 2 * i) / particleCount + Math.random() * 0.5;
      const speed = 100 + Math.random() * 100;
      
      // Animate particle
      this.scene.tweens.add({
        targets: particle,
        x: x + Math.cos(angle) * speed,
        y: y + Math.sin(angle) * speed,
        alpha: 0,
        scale: 0.5,
        duration: 500,
        ease: 'Power2',
        onComplete: () => particle.destroy()
      });
    }
    
    // Flash the screen slightly
    this.scene.cameras.main.flash(100, 255, 0, 0, false);
  }
  
  /**
   * Create death effect with team-colored particles
   */
  public createDeathEffect(x: number, y: number, team: 'red' | 'blue'): void {
    // Create a burst of team-colored particles
    const teamColors = getTeamColors(team);
    const teamColor = teamColors.GLOW;
    const particleCount = 15;
    
    for (let i = 0; i < particleCount; i++) {
      const particle = this.scene.add.circle(x, y, 4, teamColor);
      
      // Random direction
      const angle = (Math.PI * 2 * i) / particleCount + Math.random() * 0.3;
      const speed = 150 + Math.random() * 150;
      
      // Animate particle
      this.scene.tweens.add({
        targets: particle,
        x: x + Math.cos(angle) * speed,
        y: y + Math.sin(angle) * speed,
        alpha: 0,
        scale: 0.2,
        duration: 800,
        ease: 'Power3',
        onComplete: () => particle.destroy()
      });
    }
    
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
  }
  
  /**
   * Create bullet impact effect on platforms
   */
  public createBulletImpactEffect(x: number, y: number): void {
    // Create small particle burst for bullet impact
    const particleCount = 3;
    
    for (let i = 0; i < particleCount; i++) {
      const particle = this.scene.add.circle(x, y, 2, COLORS.EFFECTS.BULLET_IMPACT);
      
      // Random direction
      const angle = (Math.PI * 2 * i) / particleCount + Math.random() * 0.5;
      const speed = 50 + Math.random() * 50;
      
      // Animate particle
      this.scene.tweens.add({
        targets: particle,
        x: x + Math.cos(angle) * speed,
        y: y + Math.sin(angle) * speed,
        alpha: 0,
        scale: 0.5,
        duration: 300,
        ease: 'Power2',
        onComplete: () => particle.destroy()
      });
    }
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