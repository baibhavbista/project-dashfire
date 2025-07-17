import Phaser from 'phaser';

export class RemotePlayer {
  public sprite: Phaser.Physics.Arcade.Sprite;
  public id: string;
  public team: "red" | "blue";
  private healthBar?: Phaser.GameObjects.Rectangle;
  private healthBarBg?: Phaser.GameObjects.Rectangle;
  private scene: Phaser.Scene;
  private gun: Phaser.GameObjects.Rectangle;
  private isDestroyed: boolean = false;
  private nameText?: Phaser.GameObjects.Text;
  
  // Interpolation state
  private targetX: number;
  private targetY: number;
  private targetVelocityX: number = 0;
  private targetVelocityY: number = 0;
  private interpolationFactor: number = 0.2;
  
  // Dash trail properties
  private dashTrails: Phaser.GameObjects.Image[] = [];
  private readonly MAX_TRAILS: number = 8;
  private wasDashing: boolean = false;
  
  constructor(scene: Phaser.Scene, id: string, x: number, y: number, team: "red" | "blue", name?: string) {
    this.scene = scene;
    this.id = id;
    this.team = team;
    
    // Initialize position
    this.targetX = x;
    this.targetY = y;
    
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
    
    // Create name text
    this.nameText = scene.add.text(x, y - 50, name || "Unknown", {
      fontSize: '14px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 2
    });
    this.nameText.setOrigin(0.5);
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
    // Safety check - make sure player hasn't been destroyed
    if (this.isDestroyed) {
      return;
    }
    
    // Safety check - make sure sprite still exists
    if (!this.sprite || !this.sprite.body) {
      console.warn(`RemotePlayer ${this.id} sprite destroyed, skipping update`);
      return;
    }
    
    // Update target position
    this.targetX = x;
    this.targetY = y;
    this.targetVelocityX = velocityX;
    this.targetVelocityY = velocityY;
    
    // Calculate distance to target
    const dx = this.targetX - this.sprite.x;
    const dy = this.targetY - this.sprite.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // Adjust interpolation based on distance (faster catch-up for larger distances)
    let lerpFactor = this.interpolationFactor;
    if (distance > 100) {
      lerpFactor = 0.5; // Faster interpolation for large distances
    } else if (distance > 50) {
      lerpFactor = 0.3;
    }
    
    // Smooth interpolation with velocity prediction
    const predictedX = this.targetX + (this.targetVelocityX * 0.05); // Predict 50ms ahead
    const predictedY = this.targetY + (this.targetVelocityY * 0.05);
    
    this.sprite.x = Phaser.Math.Linear(this.sprite.x, predictedX, lerpFactor);
    this.sprite.y = Phaser.Math.Linear(this.sprite.y, predictedY, lerpFactor);
    
    // Set velocity for physics interactions
    this.sprite.setVelocity(
      (this.targetX - this.sprite.x) * 10, // Smooth velocity based on position difference
      (this.targetY - this.sprite.y) * 10
    );
    
    // Update flip
    this.sprite.setFlipX(flipX);
    
    // Update gun position
    if (this.gun && this.gun.active) {
      const direction = flipX ? -1 : 1;
      const gunX = this.sprite.x + (8 * direction);
      const gunY = this.sprite.y;
      this.gun.setPosition(gunX, gunY);
      this.gun.setScale(direction, 1);
    }
    
    // Update health bar position
    if (this.healthBarBg && this.healthBar && this.healthBarBg.active && this.healthBar.active) {
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
    
    // Update name position
    if (this.nameText && this.nameText.active) {
      this.nameText.setPosition(this.sprite.x, this.sprite.y - 50);
    }
    
    // Handle death state
    if (isDead) {
      this.sprite.setAlpha(0.3);
      if (this.gun && this.gun.active) this.gun.setVisible(false);
      if (this.healthBar && this.healthBar.active) this.healthBar.setVisible(false);
      if (this.healthBarBg && this.healthBarBg.active) this.healthBarBg.setVisible(false);
      if (this.nameText && this.nameText.active) this.nameText.setVisible(false);
    } else {
      this.sprite.setAlpha(1);
      if (this.gun && this.gun.active) this.gun.setVisible(true);
      if (this.healthBar && this.healthBar.active) this.healthBar.setVisible(true);
      if (this.healthBarBg && this.healthBarBg.active) this.healthBarBg.setVisible(true);
      if (this.nameText && this.nameText.active) this.nameText.setVisible(true);
    }
    
    // Update dash tint
    if (isDashing) {
      this.sprite.setTint(0x00FFFF);
      
      // Start creating dash trails if just started dashing
      if (!this.wasDashing) {
        this.wasDashing = true;
      }
      
      // Create dash trails while dashing
      if (Math.random() < 0.8) {
        this.createDashTrail();
      }
    } else {
      const teamColor = this.team === "red" ? 0xFF6B6B : 0x4ECDC4;
      this.sprite.setTint(teamColor);
      this.wasDashing = false;
    }
  }
  
  private createDashTrail(): void {
    // Safety check
    if (this.isDestroyed || !this.sprite || !this.sprite.active) return;
    
    // Remove oldest trail if at max
    if (this.dashTrails.length >= this.MAX_TRAILS) {
      const oldTrail = this.dashTrails.shift();
      if (oldTrail) {
        oldTrail.destroy();
      }
    }

    // Create new trail
    const trail = this.scene.add.image(this.sprite.x, this.sprite.y, 'player');
    trail.setDisplaySize(32, 48);
    trail.setTint(0x00FFFF);
    trail.setAlpha(0.6);
    trail.setFlipX(this.sprite.flipX);

    this.dashTrails.push(trail);

    // Fade out trail
    this.scene.tweens.add({
      targets: trail,
      alpha: 0,
      duration: 200,
      onComplete: () => {
        const index = this.dashTrails.indexOf(trail);
        if (index > -1) {
          this.dashTrails.splice(index, 1);
        }
        trail.destroy();
      }
    });
  }
  
  destroy(): void {
    // Mark as destroyed to prevent any further updates
    this.isDestroyed = true;
    
    // Clean up dash trails
    this.dashTrails.forEach(trail => {
      if (trail && trail.active) {
        trail.destroy();
      }
    });
    this.dashTrails = [];
    
    // Safely destroy all game objects
    if (this.sprite && this.sprite.active) {
      this.sprite.destroy();
    }
    if (this.healthBar && this.healthBar.active) {
      this.healthBar.destroy();
    }
    if (this.healthBarBg && this.healthBarBg.active) {
      this.healthBarBg.destroy();
    }
    if (this.gun && this.gun.active) {
      this.gun.destroy();
    }
    if (this.nameText && this.nameText.active) {
      this.nameText.destroy();
    }
  }
} 