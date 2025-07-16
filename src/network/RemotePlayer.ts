import Phaser from 'phaser';

export class RemotePlayer {
  public sprite: Phaser.Physics.Arcade.Sprite;
  public id: string;
  public team: "red" | "blue";
  private healthBar?: Phaser.GameObjects.Rectangle;
  private healthBarBg?: Phaser.GameObjects.Rectangle;
  private scene: Phaser.Scene;
  private gun: Phaser.GameObjects.Rectangle;
  
  constructor(scene: Phaser.Scene, id: string, x: number, y: number, team: "red" | "blue") {
    this.scene = scene;
    this.id = id;
    this.team = team;
    
    // Create sprite
    this.sprite = scene.physics.add.sprite(x, y, 'player');
    this.sprite.setDisplaySize(32, 48);
    
    // Set team color
    const teamColor = team === "red" ? 0xFF6B6B : 0x4ECDC4;
    this.sprite.setTint(teamColor);
    
    // Disable physics for remote players (they're controlled by server)
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setImmovable(true);
    
    // Create health bar
    this.createHealthBar();
    
    // Create gun visual
    this.gun = scene.add.rectangle(0, 0, 24, 3, 0x000000);
    this.gun.setOrigin(0, 0.5);
  }
  
  private createHealthBar(): void {
    const barWidth = 40;
    const barHeight = 4;
    const yOffset = -35;
    
    // Background
    this.healthBarBg = this.scene.add.rectangle(
      this.sprite.x,
      this.sprite.y + yOffset,
      barWidth,
      barHeight,
      0x000000,
      0.8
    );
    
    // Health bar
    this.healthBar = this.scene.add.rectangle(
      this.sprite.x,
      this.sprite.y + yOffset,
      barWidth,
      barHeight,
      0x00FF00
    );
    this.healthBar.setOrigin(0, 0.5);
    this.healthBar.x -= barWidth / 2;
  }
  
  update(x: number, y: number, velocityX: number, velocityY: number, health: number, flipX: boolean, isDashing: boolean, isDead: boolean): void {
    // Update position with interpolation
    const lerpFactor = 0.2;
    this.sprite.x = Phaser.Math.Linear(this.sprite.x, x, lerpFactor);
    this.sprite.y = Phaser.Math.Linear(this.sprite.y, y, lerpFactor);
    
    // Update velocity for smoother movement prediction
    this.sprite.setVelocity(velocityX, velocityY);
    
    // Update flip
    this.sprite.setFlipX(flipX);
    
    // Update gun position
    const direction = flipX ? -1 : 1;
    const gunX = this.sprite.x + (8 * direction);
    const gunY = this.sprite.y;
    this.gun.setPosition(gunX, gunY);
    this.gun.setScale(direction, 1);
    
    // Update health bar position
    if (this.healthBarBg && this.healthBar) {
      const yOffset = -35;
      this.healthBarBg.setPosition(this.sprite.x, this.sprite.y + yOffset);
      this.healthBar.setPosition(this.sprite.x - 20, this.sprite.y + yOffset);
      
      // Update health bar width
      const healthPercent = Math.max(0, health / 100);
      this.healthBar.setDisplaySize(40 * healthPercent, 4);
      
      // Change color based on health
      if (healthPercent > 0.6) {
        this.healthBar.setFillStyle(0x00FF00);
      } else if (healthPercent > 0.3) {
        this.healthBar.setFillStyle(0xFFFF00);
      } else {
        this.healthBar.setFillStyle(0xFF0000);
      }
    }
    
    // Handle death state
    if (isDead) {
      this.sprite.setAlpha(0.3);
      this.gun.setVisible(false);
      this.healthBar?.setVisible(false);
      this.healthBarBg?.setVisible(false);
    } else {
      this.sprite.setAlpha(1);
      this.gun.setVisible(true);
      this.healthBar?.setVisible(true);
      this.healthBarBg?.setVisible(true);
    }
    
    // Update dash tint
    if (isDashing) {
      this.sprite.setTint(0x00FFFF);
    } else {
      const teamColor = this.team === "red" ? 0xFF6B6B : 0x4ECDC4;
      this.sprite.setTint(teamColor);
    }
  }
  
  destroy(): void {
    this.sprite.destroy();
    this.healthBar?.destroy();
    this.healthBarBg?.destroy();
    this.gun.destroy();
  }
} 