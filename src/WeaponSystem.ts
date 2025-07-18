import Phaser from 'phaser';
import { BulletPool } from './BulletPool';

export class WeaponSystem {
  private scene: Phaser.Scene;
  private player: Phaser.Physics.Arcade.Sprite;
  private gun: Phaser.GameObjects.Rectangle;
  private bulletPool: BulletPool;
  private muzzleFlash?: Phaser.GameObjects.Arc;
  
  private canShoot: boolean = true;
  private shootCooldown: number = 0;
  private readonly SHOOT_COOLDOWN_MS: number = 200;
  private readonly GUN_LENGTH: number = 24;
  private readonly GUN_WIDTH: number = 3;
  private readonly GUN_OFFSET_X: number = 8; // Offset from player center
  private readonly GUN_OFFSET_Y: number = -24; // Height offset (adjusted for bottom-center origin)

  constructor(scene: Phaser.Scene, player: Phaser.Physics.Arcade.Sprite) {
    this.scene = scene;
    this.player = player;
    this.bulletPool = new BulletPool(scene);
    
    // Create gun visual
    this.gun = scene.add.rectangle(0, 0, this.GUN_LENGTH, this.GUN_WIDTH, 0x666666);
    this.gun.setOrigin(0, 0.5); // Origin at the left/base of gun
    
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

    // Update gun position to follow player
    this.updateGunPosition();

    // Update bullet pool
    this.bulletPool.update();
  }

  private updateGunPosition(): void {
    // Position gun relative to player
    const direction = this.player.flipX ? -1 : 1;
    const gunX = this.player.x + (this.GUN_OFFSET_X * direction);
    const gunY = this.player.y + this.GUN_OFFSET_Y;
    
    this.gun.setPosition(gunX, gunY);
    
    // Flip gun based on player direction
    if (this.player.flipX) {
      this.gun.setScale(-1, 1);
    } else {
      this.gun.setScale(1, 1);
    }
  }

  shoot(isPlayerDashing: boolean, teamColor?: number): boolean {
    // Can't shoot while dashing or on cooldown
    if (!this.canShoot || isPlayerDashing || this.shootCooldown > 0) {
      return false;
    }

    const direction = this.player.flipX ? -1 : 1;
    
    // Calculate bullet spawn position (at gun tip)
    const bulletX = this.gun.x + (this.GUN_LENGTH * direction * 0.9);
    const bulletY = this.gun.y;
    
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

  // Set gun visibility
  setVisible(visible: boolean): void {
    this.gun.setVisible(visible);
  }

  // Cleanup
  destroy(): void {
    this.gun.destroy();
    this.muzzleFlash?.destroy();
    // Note: BulletPool bullets will be cleaned up by Phaser scene destruction
  }
} 