import Phaser from 'phaser';
import { COLORS, getTeamColors } from '../config/Colors';
import { GAME_CONFIG, Team } from '../config/GameConfig';

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
  
  // Dash system
  protected dashTrails: Phaser.GameObjects.Sprite[] = [];
  protected readonly MAX_TRAILS: number = GAME_CONFIG.PLAYER.DASH.MAX_TRAILS;
  protected _isDashing: boolean = false;
  protected wasDashing: boolean = false;
  
  // Animation state
  protected lastVelocityX: number = 0;
  protected breathingTween?: Phaser.Tweens.Tween;
  protected targetScaleX: number = 1;
  protected targetScaleY: number = 1;
  protected isGrounded: boolean = false;
  protected wasGrounded: boolean = false;
  protected landingSquashTween?: Phaser.Tweens.Tween;
  
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
      graphics.fillStyle(teamColors.PRIMARY, 1);
      graphics.fillRect(0, 0, GAME_CONFIG.PLAYER.WIDTH, GAME_CONFIG.PLAYER.HEIGHT);
      graphics.generateTexture(textureKey, GAME_CONFIG.PLAYER.WIDTH, GAME_CONFIG.PLAYER.HEIGHT);
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
    
    // Configure sprite
    this.setOrigin(0.5, 1); // Bottom-center origin for proper animations
    this.setBounce(GAME_CONFIG.PLAYER.BOUNCE);
    
    // Configure physics body
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(GAME_CONFIG.PLAYER.WIDTH, GAME_CONFIG.PLAYER.HEIGHT);
    
    // Create visual components
    this.createDirectionIndicator();
    this.createNameText();
    if (!isLocal) {
      this.createHealthBar(); // Remote players show health bars above them
    }
    
    // Start breathing animation when idle
    this.startBreathingAnimation();
  }
  
  protected createDirectionIndicator(): void {
    const teamColors = getTeamColors(this.team);
    this.directionIndicator = this.scene.add.triangle(
      this.x, 
      this.y - GAME_CONFIG.ANIMATION.INDICATOR.OFFSET_Y,
      0, 5,    // bottom left
      5, 0,    // top
      10, 5,   // bottom right
      teamColors.PRIMARY,
      GAME_CONFIG.ANIMATION.INDICATOR.ACTIVE_ALPHA
    );
    this.directionIndicator.setOrigin(0.5);
  }
  
  protected createNameText(): void {
    if (this.isLocalPlayer) return; // Don't show name for local player
    
    this.nameText = this.scene.add.text(
      this.x, 
      this.y - 75,
      this.playerName,
      {
        fontSize: GAME_CONFIG.UI.FONT.SIZE.SMALL,
        color: COLORS.UI.TEXT_PRIMARY,
        fontFamily: GAME_CONFIG.UI.FONT.FAMILY
      }
    );
    this.nameText.setOrigin(0.5);
  }
  
  protected createHealthBar(): void {
    const barWidth = 40;
    const barHeight = 4;
    const yOffset = -59;
    
    // Background
    this.healthBarBg = this.scene.add.rectangle(
      this.x,
      this.y + yOffset,
      barWidth,
      barHeight,
      COLORS.UI.HEALTH_BG,
      0.8
    );
    
    // Health bar
    this.healthBar = this.scene.add.rectangle(
      this.x,
      this.y + yOffset,
      barWidth,
      barHeight,
      COLORS.UI.HEALTH_GOOD
    );
    this.healthBar.setOrigin(0, 0.5);
    this.healthBar.x -= barWidth / 2;
  }
  
  /**
   * Start breathing animation when idle
   */
  protected startBreathingAnimation(): void {
    if (this.breathingTween) return;
    
    this.breathingTween = this.scene.tweens.add({
      targets: this,
      scaleX: { 
        from: GAME_CONFIG.ANIMATION.BREATHING.MIN_SCALE, 
        to: GAME_CONFIG.ANIMATION.BREATHING.MAX_SCALE 
      },
      scaleY: { 
        from: GAME_CONFIG.ANIMATION.BREATHING.MAX_SCALE, 
        to: GAME_CONFIG.ANIMATION.BREATHING.MIN_SCALE 
      },
      duration: GAME_CONFIG.ANIMATION.BREATHING.CYCLE_TIME,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1
    });
  }
  
  /**
   * Stop breathing animation when moving
   */
  protected stopBreathingAnimation(): void {
    if (this.breathingTween) {
      this.breathingTween.stop();
      this.breathingTween = undefined;
      this.setScale(1, 1);
    }
  }
  
  /**
   * Create a dash trail effect
   */
  protected createDashTrail(): void {
    // Remove oldest trail if at max
    if (this.dashTrails.length >= this.MAX_TRAILS) {
      const oldTrail = this.dashTrails.shift();
      if (oldTrail) {
        oldTrail.destroy();
      }
    }

    // Create new trail using the same texture as the player
    const trail = this.scene.add.sprite(this.x, this.y, this.texture.key);
    trail.setDisplaySize(GAME_CONFIG.PLAYER.WIDTH, GAME_CONFIG.PLAYER.HEIGHT);
    trail.setAlpha(0.6);
    trail.setFlipX(this.flipX);
    trail.setOrigin(0.5, 1);

    this.dashTrails.push(trail);

    // Fade out trail
    this.scene.tweens.add({
      targets: trail,
      alpha: 0,
      duration: GAME_CONFIG.PLAYER.DASH.TRAIL_FADE_DURATION,
      onComplete: () => {
        const index = this.dashTrails.indexOf(trail);
        if (index > -1) {
          this.dashTrails.splice(index, 1);
        }
        trail.destroy();
      }
    });
  }
  
  /**
   * Clean up all dash trails
   */
  protected clearDashTrails(): void {
    this.dashTrails.forEach(trail => {
      if (trail && trail.active) {
        trail.destroy();
      }
    });
    this.dashTrails = [];
  }
  
  /**
   * Update character animations based on movement state
   */
  protected updateCharacterAnimations(velocityX: number): void {
    const absVelX = Math.abs(velocityX);
    
    // Update direction indicator
    if (this.directionIndicator) {
      this.directionIndicator.setPosition(this.x, this.y - GAME_CONFIG.ANIMATION.INDICATOR.OFFSET_Y);
      
      if (absVelX > 10) {
        this.directionIndicator.setAlpha(GAME_CONFIG.ANIMATION.INDICATOR.ACTIVE_ALPHA);
        const angle = velocityX > 0 ? 90 : -90;
        this.directionIndicator.setRotation(Phaser.Math.DegToRad(angle));
        this.lastVelocityX = velocityX;
      } else {
        this.directionIndicator.setAlpha(GAME_CONFIG.ANIMATION.INDICATOR.FADE_ALPHA);
        const angle = this.lastVelocityX > 0 ? 90 : -90;
        this.directionIndicator.setRotation(Phaser.Math.DegToRad(angle));
      }
      
      // Glow during dash
      if (this._isDashing) {
        this.directionIndicator.setAlpha(1);
        this.directionIndicator.setScale(GAME_CONFIG.ANIMATION.INDICATOR.DASH_SCALE);
      } else {
        this.directionIndicator.setScale(1);
      }
    }
    
    // Movement lean
    if (absVelX > 10 && !this._isDashing) {
      const leanAngle = Phaser.Math.Clamp(
        velocityX * GAME_CONFIG.ANIMATION.LEAN_MULTIPLIER, 
        -GAME_CONFIG.ANIMATION.LEAN_MAX_ANGLE, 
        GAME_CONFIG.ANIMATION.LEAN_MAX_ANGLE
      );
      this.setRotation(Phaser.Math.DegToRad(leanAngle));
    } else if (this.isGrounded && !this._isDashing) {
      this.setRotation(0);
    }
    
    // Breathing animation when idle
    if (absVelX < 10 && this.isGrounded && !this._isDashing) {
      this.startBreathingAnimation();
    } else {
      this.stopBreathingAnimation();
    }
  }
  
  /**
   * Update health display
   */
  public updateHealth(health: number): void {
    this.currentHealth = health;
    
    if (this.healthBar && this.healthBarBg) {
      const healthPercent = Math.max(0, health / GAME_CONFIG.PLAYER.HEALTH.MAX);
      this.healthBar.setDisplaySize(40 * healthPercent, 4);
      
      // Update color based on health
      if (healthPercent > 0.6) {
        this.healthBar.setFillStyle(COLORS.UI.HEALTH_GOOD);
      } else if (healthPercent > 0.3) {
        this.healthBar.setFillStyle(COLORS.UI.HEALTH_WARNING);
      } else {
        this.healthBar.setFillStyle(COLORS.UI.HEALTH_CRITICAL);
      }
    }
  }
  
  /**
   * Update position of UI elements
   */
  protected updateUIPositions(): void {
    if (this.nameText) {
      this.nameText.setPosition(this.x, this.y - 75);
    }
    
    if (this.healthBarBg && this.healthBar) {
      const yOffset = -59;
      this.healthBarBg.setPosition(this.x, this.y + yOffset);
      this.healthBar.setPosition(this.x - 20, this.y + yOffset);
    }
  }
  
  /**
   * Set death state
   */
  public setDead(isDead: boolean): void {
    this.isDead = isDead;
    
    if (isDead) {
      this.setAlpha(0.3);
      if (this.directionIndicator) this.directionIndicator.setVisible(false);
      if (this.nameText) this.nameText.setVisible(false);
      if (this.healthBar) this.healthBar.setVisible(false);
      if (this.healthBarBg) this.healthBarBg.setVisible(false);
    } else {
      this.setAlpha(1);
      if (this.directionIndicator) this.directionIndicator.setVisible(true);
      if (this.nameText) this.nameText.setVisible(true);
      if (this.healthBar) this.healthBar.setVisible(true);
      if (this.healthBarBg) this.healthBarBg.setVisible(true);
    }
  }
  
  /**
   * Create landing squash effect
   */
  protected createLandingSquash(): void {
    if (this.landingSquashTween) {
      this.landingSquashTween.stop();
    }
    
    // Immediate squash
    this.setScale(1.3, 0.7);
    
    // Bounce back with overshoot
    this.landingSquashTween = this.scene.tweens.add({
      targets: this,
      scaleX: 1,
      scaleY: 1,
      duration: GAME_CONFIG.ANIMATION.JUMP.LANDING_DURATION,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.landingSquashTween = undefined;
      }
    });
  }
  
  /**
   * Get current dash state
   */
  public get isDashing(): boolean {
    return this._isDashing;
  }
  
  /**
   * Clean up all components
   */
  public destroy(): void {
    // Stop all animations
    this.stopBreathingAnimation();
    if (this.landingSquashTween) {
      this.landingSquashTween.stop();
    }
    
    // Clean up dash trails
    this.clearDashTrails();
    
    // Destroy UI elements
    if (this.directionIndicator) this.directionIndicator.destroy();
    if (this.nameText) this.nameText.destroy();
    if (this.healthBar) this.healthBar.destroy();
    if (this.healthBarBg) this.healthBarBg.destroy();
    
    // Call parent destroy
    super.destroy();
  }
} 