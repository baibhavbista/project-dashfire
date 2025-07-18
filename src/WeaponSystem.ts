import Phaser from 'phaser';
import { BulletPool } from './BulletPool';

export class WeaponSystem {
  private scene: Phaser.Scene;
  private player: Phaser.Physics.Arcade.Sprite;
  private bulletPool: BulletPool;
  private muzzleFlash?: Phaser.GameObjects.Arc;
  
  private canShoot: boolean = true;
  private shootCooldown: number = 0;
  private readonly SHOOT_COOLDOWN_MS: number = 200;
  // Gun is now integrated into sprite, these define where bullets spawn
  private readonly GUN_LENGTH: number = 20;
  private readonly GUN_OFFSET_X: number = 24; // From player center to gun tip (texture is 48px wide, center at 24px, gun tip at 48px)
  private readonly GUN_OFFSET_Y: number = -32; // Vertical offset to gun (from bottom of sprite)

  constructor(scene: Phaser.Scene, player: Phaser.Physics.Arcade.Sprite) {
    this.scene = scene;
    this.player = player;
    this.bulletPool = new BulletPool(scene);
    
    // Create muzzle flash (initially hidden)
    this.muzzleFlash = scene.add.arc(0, 0, 8, 0, 360, false, 0xFFFFFF, 0.8);
    this.muzzleFlash.setVisible(false);
  }

  update(deltaTime: number): void {
    // Update cooldown
    if (this.shootCooldown > 0) {
      this.shootCooldown -= deltaTime;
      if (this.shootCooldown <= 0) {
        this.canShoot = true;
      }
    }

    // Update bullet pool
    this.bulletPool.update();
  }

  shoot(isPlayerDashing: boolean, teamColor?: number): boolean {
    // Can't shoot while dashing or on cooldown
    if (!this.canShoot || isPlayerDashing || this.shootCooldown > 0) {
      return false;
    }

    const direction = this.player.flipX ? -1 : 1;
    
    // Calculate bullet spawn position from integrated gun
    const bulletX = this.player.flipX 
      ? this.player.x - this.GUN_OFFSET_X  // Gun on left when flipped
      : this.player.x + this.GUN_OFFSET_X; // Gun on right normally
    const bulletY = this.player.y + this.GUN_OFFSET_Y;
    
    // Fire bullet with team color
    const bulletColor = teamColor || 0xFF6B6B; // Default to red glow if no team color
    const bullet = this.bulletPool.fire(bulletX, bulletY, direction, bulletColor);
    
    if (bullet) {
      // Set cooldown
      this.canShoot = false;
      this.shootCooldown = this.SHOOT_COOLDOWN_MS;
      
      // Show muzzle flash
      this.showMuzzleFlash(bulletX, bulletY);
      
      return true;
    }
    
    return false;
  }

  private showMuzzleFlash(x: number, y: number): void {
    if (!this.muzzleFlash) return;
    
    this.muzzleFlash.setPosition(x, y);
    this.muzzleFlash.setVisible(true);
    this.muzzleFlash.setScale(1);
    
    // Fade out muzzle flash
    this.scene.tweens.add({
      targets: this.muzzleFlash,
      scale: 0,
      alpha: 0,
      duration: 100,
      onComplete: () => {
        this.muzzleFlash?.setVisible(false);
        this.muzzleFlash?.setAlpha(1);
      }
    });
  }

  getBulletPool(): BulletPool {
    return this.bulletPool;
  }

  // Cleanup
  destroy(): void {
    this.muzzleFlash?.destroy();
    // Note: BulletPool bullets will be cleaned up by Phaser scene destruction
  }
} 