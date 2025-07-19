import Phaser from 'phaser';
import { BulletPool } from './BulletPool';
import { PlayerBulletInterface } from './entities/PlayerBulletInterface';
import { BasePlayer } from './entities/BasePlayer';

export class WeaponSystem {
  private scene: Phaser.Scene;
  private player: BasePlayer;
  private bulletPool: BulletPool;
  private muzzleFlash?: Phaser.GameObjects.Arc;
  
  private canShoot: boolean = true;
  private shootCooldown: number = 0;
  private readonly SHOOT_COOLDOWN_MS: number = 200;

  constructor(scene: Phaser.Scene, player: BasePlayer) {
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

  shoot(teamColor?: number): boolean {
    // Can't shoot while on cooldown, dashing, or crouching
    if (!this.canShoot || this.shootCooldown > 0 || this.player.isDashing || this.player.isCrouching) {
      return false;
    }

    const direction = this.player.flipX ? -1 : 1;
    
    // Use shared bullet interface for consistent positioning
    const bulletData = PlayerBulletInterface.getBulletSpawnData(
      this.player.x,
      this.player.y,
      direction,
      this.player.team
    );
    
    // Fire bullet with calculated position and color
    const bullet = this.bulletPool.fire(
      bulletData.x, 
      bulletData.y, 
      direction, 
      teamColor || bulletData.color
    );
    
    if (bullet) {
      // Set cooldown
      this.canShoot = false;
      this.shootCooldown = this.SHOOT_COOLDOWN_MS;
      
      // Show muzzle flash
      this.showMuzzleFlash(bulletData.x, bulletData.y);
      
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