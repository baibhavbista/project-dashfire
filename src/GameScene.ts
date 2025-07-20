import Phaser from 'phaser';
import { WeaponSystem } from './WeaponSystem';
import { Bullet } from './BulletPool';
import { SoundManager } from './SoundManager';
import { RemotePlayer } from './network/RemotePlayer';
import { LocalPlayer } from './entities/LocalPlayer';
import { NetworkManager } from './network/NetworkManager';
import { COLORS } from './config/Colors';
import { GAME_CONFIG } from './config/GameConfig';
import { GameHUD } from './ui/GameHUD';
import { KillFeed } from './ui/KillFeed';
import { EffectsSystem } from './systems/EffectsSystem';
import { WorldBuilder } from './systems/WorldBuilder';
import { MultiplayerCoordinator } from './systems/MultiplayerCoordinator';
import { PlayerFactory } from './factories/PlayerFactory';
import { DebugVisualization } from './systems/DebugVisualization';
import { InGameMenu } from './ui/InGameMenu';

// Team colors now imported from config/Colors.ts

export class GameScene extends Phaser.Scene {
  private player!: LocalPlayer;
  private platforms!: Phaser.Physics.Arcade.StaticGroup;
  private weaponSystem!: WeaponSystem;
  private soundManager!: SoundManager;
  private effectsSystem!: EffectsSystem;
  private worldBuilder!: WorldBuilder;
  private networkManager?: NetworkManager;
  private remotePlayers: Map<string, RemotePlayer> = new Map();
  private isMultiplayer: boolean = false;
  private multiplayerCoordinator?: MultiplayerCoordinator;
  
  // UI managers
  private gameHUD!: GameHUD;
  private killFeed!: KillFeed;
  private debugVisualization!: DebugVisualization;
  private inGameMenu!: InGameMenu;

  // Game state
  private currentHealth: number = GAME_CONFIG.PLAYER.HEALTH.MAX;
  private isDead: boolean = false;
  private redScore: number = 0;
  private blueScore: number = 0;
  private isMenuOpen: boolean = false;

  constructor() {
    super({ key: 'GameScene' });
  }
  
  init() {
    // Reset all state when scene is initialized
    this.isMenuOpen = false;
    this.isDead = false;
    this.currentHealth = GAME_CONFIG.PLAYER.HEALTH.MAX;
    this.redScore = 0;
    this.blueScore = 0;
    
    // Clear remote players if the map exists
    if (this.remotePlayers) {
      this.remotePlayers.clear();
    }
    
    // Reset all keyboard states
    if (this.input && this.input.keyboard) {
      this.input.keyboard.resetKeys();
    }
  }

  preload() {
    // Create white textures for sprites
    this.load.image('white-pixel', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==');
    
    // Load game music
    this.load.audio('arena-music', 'audio/music/arena-normal.mp3');
    
    // Load generated sounds
    const sounds = SoundManager.generateSoundDataURIs();
    this.load.audio('jump', sounds.jump);
    this.load.audio('dash', sounds.dash);
    this.load.audio('shoot', sounds.shoot);
    this.load.audio('hit', sounds.hit);
    this.load.audio('death', sounds.death);
  }

  create() {
    // Create white texture programmatically to ensure it works
    const graphics = this.add.graphics();
    graphics.fillStyle(COLORS.EFFECTS.WHITE, 1);
    graphics.fillRect(0, 0, 1, 1);
    graphics.generateTexture('white-rect', 1, 1);
    graphics.destroy();
    

    
    // Store reference to this scene for external access
    (this.game as Phaser.Game & { gameScene?: GameScene }).gameScene = this;
    
    // Set dark background color (Thomas Was Alone style)
    this.cameras.main.setBackgroundColor(COLORS.BACKGROUND.MAIN);
    
    // Check if we're in multiplayer mode
    const networkManager = this.game.registry.get('networkManager');
    const isMultiplayer = this.game.registry.get('isMultiplayer');
    
    if (networkManager && isMultiplayer) {
      this.networkManager = networkManager;
      this.isMultiplayer = isMultiplayer;
      console.log("GameScene: Found network manager, setting up multiplayer...");
      // MultiplayerCoordinator will handle setup after it's created
    }
    
    // Initialize world builder and create world
    this.worldBuilder = new WorldBuilder(this);
    this.platforms = this.worldBuilder.buildWorld();

    // Create local player using factory
    this.player = PlayerFactory.createLocalPlayer(
      this,
      this.worldBuilder,
      this.networkManager,
      this.isMultiplayer
    );
    
    // Add collision with platforms
    this.physics.add.collider(this.player, this.platforms);
    
    // Set up player event listeners
    this.setupPlayerEventListeners();

    // Setup camera to follow player
    this.worldBuilder.setupCamera(this.player);

    // Enable 2D lighting system for shadows
    this.lights.enable();
    this.lights.setAmbientColor(0x1a1828); // Very dark ambient light for mood

    // Initialize weapon system
    this.weaponSystem = new WeaponSystem(this, this.player);
    
    // Initialize sound manager
    this.soundManager = new SoundManager(this);
    
    // Initialize effects system
    this.effectsSystem = new EffectsSystem(this);
    this.effectsSystem.initialize();
    
    // Initialize UI managers
    this.gameHUD = new GameHUD(this);
    this.killFeed = new KillFeed(this);
    
    // Initialize debug visualization
    this.debugVisualization = new DebugVisualization(this);
    
    // Initialize in-game menu
    this.inGameMenu = new InGameMenu(this);
    
    // Set up bullet-platform collision detection (visual effects only in multiplayer)
    const bullets = this.weaponSystem.getBulletPool().getBullets();
    this.physics.add.overlap(bullets, this.platforms, (bulletObj) => {
      const bullet = bulletObj as Bullet;
      
      // Create visual impact effect
      this.effectsSystem.createBulletImpactEffect(bullet.x, bullet.y);
      
      // In single-player mode, we handle collision locally
      // In multiplayer, the server is authoritative and will tell us when to remove bullets
      if (!this.isMultiplayer) {
        this.weaponSystem.getBulletPool().deactivateBullet(bullet);
      }
      // In multiplayer, we just show the effect and wait for server to remove the bullet
    });

    // Setup multiplayer if connected
    if (this.isMultiplayer && this.networkManager) {
      console.log("GameScene: Setting up multiplayer connection...");
      
      // Create multiplayer coordinator
      this.multiplayerCoordinator = new MultiplayerCoordinator(
        this,
        this.networkManager,
        this.player,
        this.remotePlayers,
        this.gameHUD,
        this.killFeed,
        this.effectsSystem,
        this.soundManager
      );
      
      // Set up callbacks for game state updates
      this.multiplayerCoordinator.setCallbacks({
        onScoreUpdate: (redScore, blueScore) => {
          this.redScore = redScore;
          this.blueScore = blueScore;
        },
        onHealthUpdate: (health) => {
          this.currentHealth = health;
        },
        onDeathStateChange: (isDead) => {
          this.isDead = isDead;
        }
      });
      
      // Initialize multiplayer
      this.multiplayerCoordinator.setupEventHandlers();
      this.multiplayerCoordinator.initialize();
    }

    // Add escape key to toggle in-game menu
    const escHandler = () => {
      if (!this.inGameMenu.getIsVisible()) {
        this.inGameMenu.show();
        this.isMenuOpen = true;
      }
      // Note: The menu handles its own ESC key to close itself
    };
    this.input.keyboard?.on('keydown-ESC', escHandler);
    
    // Add shutdown event to clean up when scene stops
    this.events.once('shutdown', () => {
      this.isMenuOpen = false;
      
      // Remove the ESC handler specifically
      this.input.keyboard?.off('keydown-ESC', escHandler);
      
      // Force hide menu if it's visible
      if (this.inGameMenu && this.inGameMenu.getIsVisible()) {
        this.inGameMenu.hide();
      }
    });
    
    // Start arena music
    this.startArenaMusic();

  }
  
  setupPlayerEventListeners() {
    // Listen for player events
    this.player.events.on('jump', () => {
      this.soundManager.playJump();
      // Create dust effect
      this.effectsSystem.createDustEffect(this.player.x, this.player.y, 5);
    });
    
    this.player.events.on('land', () => {
      // Create dust effect on landing
      this.effectsSystem.createDustEffect(this.player.x, this.player.y, 3);
    });
    
    this.player.events.on('dash-start', () => {
      this.soundManager.playDash();
      if (this.isMultiplayer && this.networkManager) {
        this.networkManager.sendDash(true);
      }
    });
    
    this.player.events.on('dash-end', () => {
      if (this.isMultiplayer && this.networkManager) {
        this.networkManager.sendDash(false);
      }
    });
    
    this.player.events.on('shoot', (data: { x: number; y: number; direction: number; team: string }) => {
      // Get team color for bullets
      const bulletColor = data.team === "blue" ? COLORS.TEAMS.BLUE.GLOW : COLORS.TEAMS.RED.GLOW;
      
      if (this.weaponSystem.shoot(bulletColor)) {
        this.soundManager.playShoot();
        
        // Send shoot to server if multiplayer (server will calculate velocity)
        if (this.isMultiplayer && this.networkManager) {
          this.networkManager.sendShoot({
            x: data.x,
            y: data.y
          });
        }
      }
    });
    
    this.player.events.on('position-update', (data: { x: number; y: number; velocityX: number; velocityY: number; flipX: boolean }) => {
      // Send position to server if multiplayer
      if (this.isMultiplayer && this.networkManager) {
        this.networkManager.sendMovement(data);
      }
    });
  }

  update(time: number, delta: number) {
    // Guard against player not existing yet
    if (!this.player) {
      return;
    }
    
    // If body is not ready, try to recreate it
    if (!this.player.body) {
      this.physics.world.enable(this.player);
      return;
    }
    
    // Update player
    this.player.update(time, delta);
    
    // Update weapon system
    this.weaponSystem.update(delta);
    
    // Update multiplayer coordinator if in multiplayer mode
    if (this.multiplayerCoordinator) {
      this.multiplayerCoordinator.update(delta);
    }
    
    // Update debug visualization
    this.debugVisualization.clear();
    
    // For local player, pass the detailed states
    if (this.player instanceof LocalPlayer) {
      this.debugVisualization.updatePlayer(
        this.player, 
        this.player.getMovementState(),
        this.player.getAnimationState()
      );
    } else {
      this.debugVisualization.updatePlayer(this.player);
    }
    
    // Update debug visualization for remote players (no detailed states)
    this.remotePlayers.forEach(remotePlayer => {
      this.debugVisualization.updatePlayer(remotePlayer);
    });
    
    this.debugVisualization.drawLegend();
    
    // Update debug text
    if (this.gameHUD.isDebugVisible()) {
      const playerBody = this.player.body as Phaser.Physics.Arcade.Body;
      const predictionError = this.multiplayerCoordinator?.getPredictionError() || { x: 0, y: 0 };
      const errorMag = Math.sqrt(predictionError.x * predictionError.x + predictionError.y * predictionError.y);
      const localPlayerId = this.multiplayerCoordinator?.getLocalPlayerId() || 'local-player';
      
      this.gameHUD.updateDebugText([
        `Network Debug (F3 to hide)`,
        `Player ID: ${localPlayerId}`,
        `Position: ${Math.round(this.player.x)}, ${Math.round(this.player.y)}`,
        `Velocity: ${Math.round(playerBody.velocity.x)}, ${Math.round(playerBody.velocity.y)}`,
        `Prediction Error: ${errorMag.toFixed(1)}px`,
        `Dash State: ${this.player.isDashing ? 'DASHING' : 'Ready'}`,
        `Remote Players: ${this.remotePlayers.size}`,
        `FPS: ${Math.round(this.game.loop.actualFps)}`
      ]);
    }
  }

  destroy() {
    // Clean up multiplayer coordinator
    if (this.multiplayerCoordinator) {
      this.multiplayerCoordinator.destroy();
    }
    
    // Clean up other resources
    this.weaponSystem.destroy();
    this.effectsSystem.destroy();
    this.gameHUD.destroy();
    this.killFeed.destroy();
    this.debugVisualization.destroy();
    this.inGameMenu.destroy();
  }

  /**
   * Get the weapon system (for MultiplayerCoordinator)
   */
  public getWeaponSystem(): WeaponSystem {
    return this.weaponSystem;
  }
  
  /**
   * Check if the in-game menu is open
   */
  public isInGameMenuOpen(): boolean {
    return this.isMenuOpen;
  }
  
  /**
   * Set the in-game menu state
   */
  public setInGameMenuOpen(isOpen: boolean): void {
    this.isMenuOpen = isOpen;
  }
  
  private startArenaMusic(): void {
    // Stop any currently playing music
    this.sound.stopAll();
    
    // Get volume from localStorage
    const musicVolume = parseFloat(localStorage.getItem('musicVolume') || '0.25');
    
    // Play arena music
    this.sound.play('arena-music', {
      loop: true,
      volume: musicVolume
    });
  }

}