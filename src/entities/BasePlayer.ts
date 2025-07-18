import Phaser from 'phaser';
import { GAME_CONFIG, Team } from '../config/GameConfig';
import { AnimationController } from '../systems/AnimationController';
import { PlayerTextureManager } from './PlayerTextureManager';
import { getTeamColors } from '../config/Colors';

/**
 * Base player class containing shared functionality for both local and remote players
 * Handles rendering, animations, and visual effects
 */
export class BasePlayer extends Phaser.Physics.Arcade.Sprite {
  // Core properties
  public id: string;
  public team: Team;
  public playerName: string;
  protected isLocalPlayer: boolean;
  
  // Visual components
  protected directionIndicator?: Phaser.GameObjects.Triangle;
  protected nameText?: Phaser.GameObjects.Text;
  protected healthBarBg?: Phaser.GameObjects.Rectangle;
  protected healthBar?: Phaser.GameObjects.Rectangle;
  protected playerLight?: Phaser.GameObjects.Light;
  
  // Animation controller
  protected animationController: AnimationController;
  
  // Dash state
  protected _isDashing: boolean = false;
  protected wasDashing: boolean = false;
  
  // Movement state
  protected isGrounded: boolean = false;
  protected wasGrounded: boolean = false;
  
  // Health
  protected currentHealth: number = GAME_CONFIG.PLAYER.HEALTH.MAX;
  protected isDead: boolean = false;
  
  // Dynamic origin for animations
  protected baseOriginX: number = 0.5;
  
  constructor(
    scene: Phaser.Scene, 
    id: string,
    x: number, 
    y: number, 
    team: Team,
    playerName: string = 'Unknown',
    isLocal: boolean = false
  ) {
    // Get or create the sprite texture using centralized manager
    const textureKey = PlayerTextureManager.getPlayerTexture(scene, team);
    super(scene, x, y, textureKey);
    
    this.id = id;
    this.team = team;
    this.playerName = playerName;
    this.isLocalPlayer = isLocal;
    
    // Add to scene
    scene.add.existing(this);
    scene.physics.add.existing(this);
    
    // Ensure sprite is visible
    this.setVisible(true);
    
    // Calculate origin for player body center (not texture center)
    // The texture is wider than the player body due to the gun
    const textureWidth = PlayerTextureManager.getTextureWidth();
    const playerBodyCenter = GAME_CONFIG.PLAYER.WIDTH / 2;
    this.baseOriginX = playerBodyCenter / textureWidth; // Store base origin for dynamic adjustment
    
    // Set initial origin (will be adjusted dynamically based on flip)
    this.setOrigin(this.baseOriginX, 1);
    this.setBounce(GAME_CONFIG.PLAYER.BOUNCE);
    
    // Configure physics body - keep original size, gun is just visual
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(GAME_CONFIG.PLAYER.WIDTH, GAME_CONFIG.PLAYER.HEIGHT);
    
    // Calculate initial body offset (when facing right)
    // The body should be aligned with the player rectangle, not the full texture
    const bodyOffsetX = 0; // Body starts at left edge of texture (where player rectangle starts)
    body.setOffset(bodyOffsetX, 0);
    
    // Create visual components
    this.createPlayerLight();
    // this.createDirectionIndicator(); // Removed direction indicator
    this.createNameText();
    if (!isLocal) {
      this.createHealthBar(); // Remote players show health bars above them
    }
    
    // Initialize animation controller
    this.animationController = new AnimationController(
      scene,
      this,
      undefined, // No direction indicator
      {
        onLandingSquash: () => this.onLandingSquash(),
        onDashTrailCreated: () => this.onDashTrailCreated()
      }
    );
  }
  
  /**
   * Creates a light source that follows the player
   */
  protected createPlayerLight(): void {
    const teamColors = getTeamColors(this.team);
    this.playerLight = this.scene.lights.addLight(
      this.x, 
      this.y, 
      250,          // Radius
      teamColors.GLOW, // Color
      1.8           // Intensity
    );
  }

  /**
   * Create direction indicator triangle above player
   * REMOVED - No longer used
   */
  // protected createDirectionIndicator(): void {
  //   const teamColors = getTeamColors(this.team);
  //   this.directionIndicator = this.scene.add.triangle(
  //     this.x, 
  //     this.y - GAME_CONFIG.ANIMATION.INDICATOR.OFFSET_Y,
  //     0, 10,  // top point
  //     -8, -8, // bottom left
  //     8, -8,  // bottom right
  //     teamColors.PRIMARY
  //   );
  //   this.directionIndicator.setAlpha(GAME_CONFIG.ANIMATION.INDICATOR.FADE_ALPHA);
  // }
  
  /**
   * Create name text above player (for remote players)
   */
  protected createNameText(): void {
    if (!this.isLocalPlayer) {
      this.nameText = this.scene.add.text(
        this.x, 
        this.y - 80, 
        this.playerName,
        {
          fontSize: '14px',
          color: '#ffffff',
          stroke: '#000000',
          strokeThickness: 2
        }
      );
      this.nameText.setOrigin(0.5, 0.5);
    }
  }
  
  /**
   * Create health bar for remote players
   */
  protected createHealthBar(): void {
    const barWidth = 40;
    const barHeight = 4;
    
    this.healthBarBg = this.scene.add.rectangle(
      this.x, 
      this.y - 65,
      barWidth, 
      barHeight, 
      0x333333
    );
    
    this.healthBar = this.scene.add.rectangle(
      this.x, 
      this.y - 65,
      barWidth, 
      barHeight, 
      0x2ECC71
    );
    
    this.healthBarBg.setOrigin(0.5, 0.5);
    this.healthBar.setOrigin(0, 0.5);
    this.healthBar.x -= barWidth / 2;
  }
  
  /**
   * Override setFlipX to dynamically adjust origin
   */
  setFlipX(value: boolean): this {
    super.setFlipX(value);
    this.updateDynamicOrigin();
    return this;
  }
  
  /**
   * Update origin based on flip direction to keep animations centered on player body
   */
  protected updateDynamicOrigin(): void {
    const textureWidth = PlayerTextureManager.getTextureWidth();
    const gunWidth = textureWidth - GAME_CONFIG.PLAYER.WIDTH;
    const body = this.body as Phaser.Physics.Arcade.Body;
    
    if (this.flipX) {
      // When flipped (facing left), gun is on the left side
      // So we need to shift origin right to compensate
      const originX = this.baseOriginX + (gunWidth / textureWidth);
      this.setOrigin(originX, 1);
      
      // Also adjust physics body offset when flipped
      // The body needs to stay aligned with the player rectangle
      body.setOffset(gunWidth, 0);
    } else {
      // When not flipped (facing right), gun is on the right side
      // Use base origin which already accounts for this
      this.setOrigin(this.baseOriginX, 1);
      
      // Reset body offset to default
      body.setOffset(0, 0);
    }
  }
  
  /**
   * Update UI element positions
   */
  protected updateUIPositions(): void {
    if (this.nameText) {
      this.nameText.setPosition(this.x, this.y - 80);
    }
    
    if (this.healthBarBg && this.healthBar) {
      this.healthBarBg.setPosition(this.x, this.y - 65);
      this.healthBar.setPosition(this.x - 20, this.y - 65);
    }

    if (this.playerLight) {
      this.playerLight.setPosition(this.x, this.y - 20); // Position light slightly above feet
    }
  }
  
  /**
   * Update health and health bar
   */
  public updateHealth(health: number): void {
    this.currentHealth = health;
    
    if (this.healthBar) {
      const healthPercent = health / GAME_CONFIG.PLAYER.HEALTH.MAX;
      this.healthBar.setScale(healthPercent, 1);
      
      // Change color based on health
      if (healthPercent > 0.6) {
        this.healthBar.setFillStyle(0x2ECC71); // Green
      } else if (healthPercent > 0.3) {
        this.healthBar.setFillStyle(0xF39C12); // Orange
      } else {
        this.healthBar.setFillStyle(0xE74C3C); // Red
      }
    }
  }
  
  /**
   * Set player death state
   */
  public setDead(dead: boolean): void {
    this.isDead = dead;
    this.setVisible(!dead);
    
    // Removed direction indicator visibility handling
    
    if (this.nameText) {
      this.nameText.setVisible(!dead);
    }
    
    if (this.healthBarBg && this.healthBar) {
      this.healthBarBg.setVisible(!dead);
      this.healthBar.setVisible(!dead);
    }
    
    if (this.playerLight) {
      this.playerLight.setVisible(!dead);
    }
  }
  
  /**
   * Create dash trail effect
   */
  protected createDashTrail(): void {
    this.animationController.createDashTrail();
  }
  
  /**
   * Clear all dash trails
   */
  protected clearDashTrails(): void {
    this.animationController.clearDashTrails();
  }
  
  /**
   * Handle landing animation event
   */
  protected onLandingSquash(): void {
    // Override in subclasses if needed
  }
  
  /**
   * Handle dash trail creation event
   */
  protected onDashTrailCreated(): void {
    // Override in subclasses if needed
  }
  
  /**
   * Getter for isDashing
   */
  public get isDashing(): boolean {
    return this._isDashing;
  }
  
  /**
   * Get current health
   */
  public getHealth(): number {
    return this.currentHealth;
  }
  
  /**
   * Get team
   */
  public getTeam(): Team {
    return this.team;
  }
  
  /**
   * Clean up resources
   */
  public destroy(fromScene?: boolean): void {
    // Clean up animations
    this.animationController.destroy();
    
    // Clean up UI elements
    // Removed direction indicator cleanup
    
    if (this.nameText) {
      this.nameText.destroy();
    }
    
    if (this.healthBarBg) {
      this.healthBarBg.destroy();
    }
    
    if (this.healthBar) {
      this.healthBar.destroy();
    }

    if (this.playerLight) {
      this.scene.lights.removeLight(this.playerLight);
      this.playerLight = undefined;
    }
    
    super.destroy(fromScene);
  }
} 