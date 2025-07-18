import Phaser from 'phaser';
import { getTeamColors } from '../config/Colors';
import { GAME_CONFIG, Team } from '../config/GameConfig';
import { AnimationController } from '../systems/AnimationController';

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
  
  constructor(
    scene: Phaser.Scene, 
    id: string,
    x: number, 
    y: number, 
    team: Team,
    playerName: string = 'Unknown',
    isLocal: boolean = false
  ) {
    // Create the sprite with team-colored texture
    const teamColors = getTeamColors(team);
    const textureKey = `${team}-player`;
    
    // Ensure texture exists, if not create it
    if (!scene.textures.exists(textureKey)) {
      const graphics = scene.add.graphics();
      
      // Draw player body
      graphics.fillStyle(teamColors.PRIMARY, 1);
      graphics.fillRect(0, 0, GAME_CONFIG.PLAYER.WIDTH, GAME_CONFIG.PLAYER.HEIGHT);
      
      // Draw integrated gun on the right side
      graphics.fillStyle(0x666666, 1); // Gun color
      const gunWidth = 20;
      const gunHeight = 4;
      const gunX = GAME_CONFIG.PLAYER.WIDTH - 4; // Right edge of player
      const gunY = GAME_CONFIG.PLAYER.HEIGHT / 2 - 8; // Middle-ish of player
      graphics.fillRect(gunX, gunY, gunWidth, gunHeight);
      
      // Generate texture with increased width to accommodate gun
      graphics.generateTexture(textureKey, GAME_CONFIG.PLAYER.WIDTH + gunWidth - 4, GAME_CONFIG.PLAYER.HEIGHT);
      graphics.destroy();
    }
    
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
    
    // Configure sprite
    this.setOrigin(0.5, 1); // Bottom-center origin for proper animations
    this.setBounce(GAME_CONFIG.PLAYER.BOUNCE);
    
    // Configure physics body - keep original size, gun is just visual
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(GAME_CONFIG.PLAYER.WIDTH, GAME_CONFIG.PLAYER.HEIGHT);
    body.setOffset(0, 0); // Body stays aligned with player rectangle, not gun
    
    // Create visual components
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
    
    super.destroy(fromScene);
  }
} 