import Phaser from 'phaser';
import { COLORS } from '../config/Colors';
import { GAME_CONFIG } from '../config/GameConfig';
import { VolumeControlManager } from './VolumeControlManager';

/**
 * Game HUD manager - handles all UI elements
 * Health bar, team scores, respawn timer, debug text
 */
export class GameHUD {
  private scene: Phaser.Scene;
  
  // Health UI
  private healthBar: Phaser.GameObjects.Rectangle;
  private healthBarBg: Phaser.GameObjects.Rectangle;
  private healthText: Phaser.GameObjects.Text;
  
  // Team/Score UI
  private scoreText: Phaser.GameObjects.Text;
  private teamIndicatorBg?: Phaser.GameObjects.Rectangle;
  private teamIndicatorText?: Phaser.GameObjects.Text;
  private leaveButton?: Phaser.GameObjects.Text;
  
  // Respawn timer
  private respawnTimer: Phaser.GameObjects.Text;
  
  // Debug text
  private debugText: Phaser.GameObjects.Text;
  private debugVisible: boolean = false;
  
  // Container for multiplayer UI elements
  private multiplayerContainer?: Phaser.GameObjects.Container;
  
  // Volume control manager
  private volumeControlManager: VolumeControlManager;
  
  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    
    // Create health UI
    this.healthBarBg = scene.add.rectangle(
      GAME_CONFIG.UI.HEALTH_BAR.POSITION.x,
      GAME_CONFIG.UI.HEALTH_BAR.POSITION.y,
      GAME_CONFIG.UI.HEALTH_BAR.WIDTH,
      GAME_CONFIG.UI.HEALTH_BAR.HEIGHT,
      COLORS.UI.HEALTH_BG
    );
    this.healthBarBg.setOrigin(0, 0);
    this.healthBarBg.setScrollFactor(0);
    
    this.healthBar = scene.add.rectangle(
      GAME_CONFIG.UI.HEALTH_BAR.POSITION.x,
      GAME_CONFIG.UI.HEALTH_BAR.POSITION.y,
      GAME_CONFIG.UI.HEALTH_BAR.WIDTH,
      GAME_CONFIG.UI.HEALTH_BAR.HEIGHT,
      COLORS.UI.HEALTH_GOOD
    );
    this.healthBar.setOrigin(0, 0);
    this.healthBar.setScrollFactor(0);
    
    this.healthText = scene.add.text(
      GAME_CONFIG.UI.HEALTH_BAR.POSITION.x + GAME_CONFIG.UI.HEALTH_BAR.WIDTH / 2,
      GAME_CONFIG.UI.HEALTH_BAR.POSITION.y + GAME_CONFIG.UI.HEALTH_BAR.HEIGHT + 8,
      '100',
      {
        fontSize: GAME_CONFIG.UI.FONT.SIZE.LARGE,
        color: COLORS.UI.TEXT_PRIMARY,
        fontFamily: GAME_CONFIG.UI.FONT.FAMILY
      }
    );
    this.healthText.setOrigin(0.5);
    this.healthText.setScrollFactor(0);
    
    // Create score text
    this.scoreText = scene.add.text(
      GAME_CONFIG.UI.SCORE.POSITION.x,
      GAME_CONFIG.UI.SCORE.POSITION.y,
      'Red: 0 | Blue: 0',
      {
        fontSize: GAME_CONFIG.UI.FONT.SIZE.XLARGE,
        color: COLORS.UI.TEXT_PRIMARY,
        fontFamily: GAME_CONFIG.UI.FONT.FAMILY
      }
    );
    this.scoreText.setOrigin(0.5);
    this.scoreText.setScrollFactor(0);
    this.scoreText.setVisible(false); // Hidden until multiplayer
    
    // Create respawn timer
    this.respawnTimer = scene.add.text(
      GAME_CONFIG.UI.RESPAWN_TIMER.POSITION.x,
      GAME_CONFIG.UI.RESPAWN_TIMER.POSITION.y,
      '',
      {
        fontSize: GAME_CONFIG.UI.FONT.SIZE.XXLARGE,
        color: COLORS.UI.TEXT_PRIMARY,
        fontFamily: GAME_CONFIG.UI.FONT.FAMILY
      }
    );
    this.respawnTimer.setOrigin(0.5);
    this.respawnTimer.setScrollFactor(0);
    this.respawnTimer.setVisible(false);
    
    // Create debug text
    this.debugText = scene.add.text(10, 100, '', {
      fontSize: GAME_CONFIG.UI.FONT.SIZE.SMALL,
      color: COLORS.UI.TEXT_DEBUG,
      backgroundColor: '#000000',
      padding: { x: 5, y: 5 }
    });
    this.debugText.setScrollFactor(0);
    this.debugText.setVisible(false);
    
    // Set up F3 toggle for debug
    scene.input.keyboard?.on('keydown-F3', () => {
      this.toggleDebug();
    });
    
    // Add escape key hint
    const escapeHint = scene.add.text(1014, 10, 'ESC - Main Menu', {
      fontSize: GAME_CONFIG.UI.FONT.SIZE.SMALL,
      color: COLORS.UI.TEXT_MUTED,
      fontFamily: GAME_CONFIG.UI.FONT.FAMILY
    });
    escapeHint.setOrigin(1, 0);
    escapeHint.setScrollFactor(0);
    escapeHint.setAlpha(0.6);
    
    // Initialize volume control manager
    this.volumeControlManager = new VolumeControlManager(scene);
    this.volumeControlManager.createSoundButton();
  }
  
  /**
   * Update health display
   */
  updateHealth(currentHealth: number, maxHealth: number = GAME_CONFIG.PLAYER.HEALTH.MAX): void {
    const healthPercent = Math.max(0, currentHealth) / maxHealth;
    
    // Update bar width
    this.healthBar.setDisplaySize(GAME_CONFIG.UI.HEALTH_BAR.WIDTH * healthPercent, GAME_CONFIG.UI.HEALTH_BAR.HEIGHT);
    
    // Update bar color based on health
    if (healthPercent > 0.6) {
      this.healthBar.setFillStyle(COLORS.UI.HEALTH_GOOD);
    } else if (healthPercent > 0.3) {
      this.healthBar.setFillStyle(COLORS.UI.HEALTH_WARNING);
    } else {
      this.healthBar.setFillStyle(COLORS.UI.HEALTH_CRITICAL);
    }
    
    // Update text
    this.healthText.setText(`${Math.max(0, Math.round(currentHealth))}`);
  }
  
  /**
   * Update score display
   */
  updateScores(redScore: number, blueScore: number): void {
    this.scoreText.setText(`Red: ${redScore} | Blue: ${blueScore}`);
  }
  
  /**
   * Show/hide respawn timer
   */
  setRespawnTimer(seconds: number): void {
    if (seconds > 0) {
      this.respawnTimer.setText(`Respawning in ${seconds}...`);
      this.respawnTimer.setVisible(true);
    } else {
      this.respawnTimer.setVisible(false);
    }
  }
  
  /**
   * Create multiplayer-specific UI elements
   */
  createMultiplayerUI(team: string, onLeave: () => void): void {
    this.multiplayerContainer = this.scene.add.container(0, 0);
    this.multiplayerContainer.setScrollFactor(0);
    
    // Team indicator background
    this.teamIndicatorBg = this.scene.add.rectangle(
      GAME_CONFIG.UI.TEAM_INDICATOR.POSITION.x,
      GAME_CONFIG.UI.TEAM_INDICATOR.POSITION.y,
      GAME_CONFIG.UI.TEAM_INDICATOR.BG_SIZE.width,
      GAME_CONFIG.UI.TEAM_INDICATOR.BG_SIZE.height,
      COLORS.UI.UI_BG,
      COLORS.UI.UI_BG_ALPHA
    );
    
    // Team text
    const teamColor = team === "red" ? "#E74C3C" : team === "blue" ? "#3498DB" : "#ffffff";
    this.teamIndicatorText = this.scene.add.text(
      GAME_CONFIG.UI.TEAM_INDICATOR.POSITION.x,
      GAME_CONFIG.UI.TEAM_INDICATOR.POSITION.y - 10,
      `Team: ${team.toUpperCase()}`,
      {
        fontSize: GAME_CONFIG.UI.FONT.SIZE.LARGE,
        color: teamColor,
        fontFamily: GAME_CONFIG.UI.FONT.FAMILY
      }
    ).setOrigin(0.5);
    
    // Leave button
    this.leaveButton = this.scene.add.text(512, 40, '[Leave Game]', {
      fontSize: GAME_CONFIG.UI.FONT.SIZE.MEDIUM,
      color: COLORS.UI.TEXT_MUTED,
      fontFamily: GAME_CONFIG.UI.FONT.FAMILY
    }).setOrigin(0.5)
      .setInteractive()
      .on('pointerover', () => this.leaveButton!.setColor(COLORS.UI.TEXT_PRIMARY))
      .on('pointerout', () => this.leaveButton!.setColor(COLORS.UI.TEXT_MUTED))
      .on('pointerdown', onLeave);
    
    this.multiplayerContainer.add([this.teamIndicatorBg, this.teamIndicatorText, this.leaveButton]);
    
    // Show score text in multiplayer
    this.scoreText.setVisible(true);
  }
  
  /**
   * Update debug text content
   */
  updateDebugText(lines: string[]): void {
    if (this.debugVisible) {
      this.debugText.setText(lines.join('\n'));
    }
  }
  
  /**
   * Toggle debug display
   */
  toggleDebug(): void {
    this.debugVisible = !this.debugVisible;
    this.debugText.setVisible(this.debugVisible);
  }
  
  /**
   * Check if debug is visible
   */
  isDebugVisible(): boolean {
    return this.debugVisible;
  }
  
  /**
   * Clean up
   */
  destroy(): void {
    this.healthBar.destroy();
    this.healthBarBg.destroy();
    this.healthText.destroy();
    this.scoreText.destroy();
    this.respawnTimer.destroy();
    this.debugText.destroy();
    this.multiplayerContainer?.destroy();
    this.volumeControlManager.destroy();
  }
} 