import Phaser from 'phaser';
import { SHARED_CONFIG } from '../shared/GameConstants';

export interface Bullet extends Phaser.Physics.Arcade.Sprite {
  isActive: boolean;
}

export class BulletPool {
  private scene: Phaser.Scene;
  private bullets: Bullet[] = [];
  private readonly POOL_SIZE = 30;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.createPool();
  }

  private createPool(): void {
    for (let i = 0; i < this.POOL_SIZE; i++) {
      // Create a simple rectangle for the bullet
      const bullet = this.scene.physics.add.sprite(0, 0, 'white-rect') as Bullet;
      
      // Set bullet appearance
      bullet.setDisplaySize(SHARED_CONFIG.BULLET.WIDTH, SHARED_CONFIG.BULLET.HEIGHT);
      bullet.setTint(0xFFFFFF); // White by default, will be tinted with team color
      bullet.setActive(false);
      bullet.setVisible(false);
      bullet.isActive = false;
      
      // Configure physics
      const body = bullet.body as Phaser.Physics.Arcade.Body;
      body.setSize(SHARED_CONFIG.BULLET.WIDTH, SHARED_CONFIG.BULLET.HEIGHT);
      body.allowGravity = false; // Bullets don't fall
      
      this.bullets.push(bullet);
    }
  }

  fire(x: number, y: number, direction: number, teamColor?: number): Bullet | null {
    // Find an inactive bullet
    const bullet = this.bullets.find(b => !b.isActive);
    
    if (!bullet) {
      console.warn('No available bullets in pool!');
      return null;
    }

    // Activate and position bullet
    bullet.setActive(true);
    bullet.setVisible(true);
    bullet.isActive = true;
    bullet.setPosition(x, y);
    
    // Set team color if provided (bright version for visibility)
    if (teamColor) {
      bullet.setTint(teamColor);
    } else {
      // Default bright red for single player
      bullet.setTint(0xFF6B6B); // Red glow color
    }
    
    // Set velocity based on direction
    bullet.setVelocityX(SHARED_CONFIG.BULLET.SPEED * direction);
    bullet.setVelocityY(0);
    
    // Auto-deactivate if bullet goes off screen
    this.scene.time.delayedCall(SHARED_CONFIG.BULLET.LIFETIME_MS, () => {
      if (bullet.isActive) {
        this.deactivateBullet(bullet);
      }
    });

    return bullet;
  }

  deactivateBullet(bullet: Bullet): void {
    bullet.setActive(false);
    bullet.setVisible(false);
    bullet.isActive = false;
    bullet.setVelocity(0, 0);
    bullet.setPosition(-100, -100); // Move off screen
  }

  update(): void {
    // Check for bullets that have left the screen
    this.bullets.forEach(bullet => {
      if (bullet.isActive) {
        const bounds = this.scene.physics.world.bounds;
        if (bullet.x < bounds.x - 50 || bullet.x > bounds.x + bounds.width + 50) {
          this.deactivateBullet(bullet);
        }
      }
    });
  }

  getBullets(): Bullet[] {
    return this.bullets;
  }

  getActiveBullets(): Bullet[] {
    return this.bullets.filter(b => b.isActive);
  }
} 