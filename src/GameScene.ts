import Phaser from 'phaser';
import { WeaponSystem } from './WeaponSystem';
import { Bullet } from './BulletPool';
import { SoundManager } from './SoundManager';
import { RemotePlayer } from './network/RemotePlayer';
import { NetworkManager, PlayerData, BulletData } from './network/NetworkManager';
import { ARENA_WIDTH, ARENA_HEIGHT, MAIN_PLATFORM, ELEVATED_PLATFORMS } from '../shared/WorldGeometry';

// Thomas Was Alone color constants
const TEAM_COLORS = {
  RED: 0xE74C3C,
  BLUE: 0x3498DB,
  RED_GLOW: 0xFF6B6B,
  BLUE_GLOW: 0x5DADE2
} as const;

// Custom interfaces for better type safety
interface PlayerSprite extends Phaser.Physics.Arcade.Sprite {
  dustParticles?: Phaser.GameObjects.Particles.ParticleEmitter;
}

export class GameScene extends Phaser.Scene {
  private player!: PlayerSprite;
  private platforms!: Phaser.Physics.Arcade.StaticGroup;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private jumpKey!: Phaser.Input.Keyboard.Key; // This will be D key
  private dashKey!: Phaser.Input.Keyboard.Key; // This will be S key
  private shootKey!: Phaser.Input.Keyboard.Key; // This will be Space key
  private shootKeyAlt!: Phaser.Input.Keyboard.Key; // This will be A key
  private weaponSystem!: WeaponSystem;
  private soundManager!: SoundManager;
  private networkManager?: NetworkManager;
  private remotePlayers: Map<string, RemotePlayer> = new Map();
  private isMultiplayer: boolean = false;
  private localPlayerId?: string;
  private multiplayerUI?: Phaser.GameObjects.Container;
  private coyoteTime: number = 0;
  private readonly COYOTE_TIME_MS: number = 150; // 150ms window after leaving platform
  private canDash: boolean = true;
  private isDashing: boolean = false;
  private dashCooldown: number = 0;
  private readonly DASH_COOLDOWN_MS: number = 300; // Longer cooldown for network sync
  private dashTrails: Phaser.GameObjects.Sprite[] = [];
  private readonly MAX_TRAILS: number = 8;
  
  // Dash input buffering
  private dashBuffering: boolean = false;
  private dashBufferTime: number = 0;
  private readonly DASH_BUFFER_WINDOW_MS: number = 75; // 75ms window to input direction
  
  // Dash direction tracking
  private initialDashDirections = {
    left: false,
    right: false,
    up: false,
    down: false
  };

  // Client-side prediction
  private lastServerPosition: { x: number; y: number } = { x: 0, y: 0 };
  private predictionError: { x: number; y: number } = { x: 0, y: 0 };
  private reconciliationSpeed: number = 0.3; // How fast to correct prediction errors
  private debugText?: Phaser.GameObjects.Text;
  
  // Health UI
  private healthBar?: Phaser.GameObjects.Rectangle;
  private healthBarBg?: Phaser.GameObjects.Rectangle;
  private healthText?: Phaser.GameObjects.Text;
  private currentHealth: number = 100;
  private isDead: boolean = false;
  private respawnTimer?: Phaser.GameObjects.Text;
  
  // Kill feed
  private killFeedContainer?: Phaser.GameObjects.Container;
  private killFeedMessages: Phaser.GameObjects.Text[] = [];
  
  // Team scores
  private scoreText?: Phaser.GameObjects.Text;
  private redScore: number = 0;
  private blueScore: number = 0;
  
  // Character animations
  private directionIndicator?: Phaser.GameObjects.Triangle;

  private lastVelocityX: number = 0;
  private isGrounded: boolean = false;
  private wasGrounded: boolean = false;
  private landingSquashTween?: Phaser.Tweens.Tween;
  
  // Jump launch animation
  private jumpLaunchTime: number = 0;
  private isJumpLaunching: boolean = false;
  private readonly JUMP_LAUNCH_DURATION: number = 150; // 150ms stretch duration

  constructor() {
    super({ key: 'GameScene' });
  }

  preload() {
    // Create white textures for sprites
    this.load.image('white-pixel', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==');
    
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
    graphics.fillStyle(0xFFFFFF, 1);
    graphics.fillRect(0, 0, 1, 1);
    graphics.generateTexture('white-rect', 1, 1);
    graphics.destroy();
    
    // Store reference to this scene for external access
    (this.game as Phaser.Game & { gameScene?: GameScene }).gameScene = this;
    
    // Set dark background color (Thomas Was Alone style)
    this.cameras.main.setBackgroundColor('#0A0A0A');
    
    // Check if we're in multiplayer mode
    const networkManager = this.game.registry.get('networkManager');
    const isMultiplayer = this.game.registry.get('isMultiplayer');
    
    if (networkManager && isMultiplayer) {
      this.networkManager = networkManager;
      this.isMultiplayer = isMultiplayer;
      console.log("GameScene: Found network manager, setting up multiplayer...");
      // Setup multiplayer handlers after scene is created
      this.time.delayedCall(100, () => {
        this.setupMultiplayerHandlers();
      });
    }
    
    // Create platforms group
    this.platforms = this.physics.add.staticGroup();

    // Create the main wide platform (arena floor)
    const arenaWidth = ARENA_WIDTH;
    
    // Main arena floor using shared geometry - dark gray platform
    const mainPlatform = this.add.rectangle(MAIN_PLATFORM.x, MAIN_PLATFORM.y, MAIN_PLATFORM.width, MAIN_PLATFORM.height, 0x2B2B2B);
    mainPlatform.setStrokeStyle(1, 0x4A4A4A); // Subtle edge highlight
    this.platforms.add(mainPlatform);

    // Create multiple elevated platforms for jumping
    this.createElevatedPlatforms();

    // Create player - clean rectangle design with guaranteed visible texture
    
    // Create a solid red texture programmatically to ensure visibility
    const redGraphics = this.add.graphics();
    redGraphics.fillStyle(TEAM_COLORS.RED, 1);
    redGraphics.fillRect(0, 0, 32, 48); // Back to normal size
    redGraphics.generateTexture('red-player', 32, 48);
    redGraphics.destroy();
    
    this.player = this.physics.add.sprite(100, 1350, 'red-player'); // Spawn near bottom of expanded arena
    this.player.setOrigin(0.5, 0.5); // Center origin for proper scaling
    
    // Ensure normal scale at start
    this.player.setScale(1, 1);
    
    this.player.setBounce(0.1);
    this.player.setCollideWorldBounds(true); // Keep player within world bounds

    // Player physics
    (this.player.body as Phaser.Physics.Arcade.Body).setGravityY(0);
    (this.player.body as Phaser.Physics.Arcade.Body).setSize(32, 48); // Back to normal size
    this.physics.add.collider(this.player, this.platforms);
    
    // Create direction indicator (triangle above player)
    this.directionIndicator = this.add.triangle(
      this.player.x, 
      this.player.y - 35, 
      0, 5,    // bottom left
      5, 0,    // top
      10, 5,   // bottom right
      0xFFFFFF,
      0.8
    );
    this.directionIndicator.setOrigin(0.5);
    


    // Camera setup - follow player but constrain to world bounds
    this.cameras.main.setBounds(0, 0, arenaWidth, ARENA_HEIGHT);
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this.cameras.main.setDeadzone(200, 100);

    // Set world bounds
    this.physics.world.setBounds(0, 0, arenaWidth, ARENA_HEIGHT);

    // Create input handlers
    if (!this.input.keyboard) {
      throw new Error('Keyboard input not available');
    }
    
    this.cursors = this.input.keyboard.createCursorKeys();
    this.jumpKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D); // D key for jump
    this.dashKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S); // S key for dash
    this.shootKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE); // Space key for shoot
    this.shootKeyAlt = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A); // A key for shoot (alternative)

    // Initialize weapon system
    this.weaponSystem = new WeaponSystem(this, this.player);
    
    // Initialize sound manager
    this.soundManager = new SoundManager(this);
    
    // Set up bullet-platform collisions
    const bullets = this.weaponSystem.getBulletPool().getBullets();
    this.physics.add.collider(bullets, this.platforms, (bulletObj) => {
      const bullet = bulletObj as Bullet;
      
      // In single-player, handle collision locally
      // In multiplayer, let the server decide
      if (!this.isMultiplayer) {
        this.weaponSystem.getBulletPool().deactivateBullet(bullet);
      }
      
      // Visual effect for both modes
      this.createBulletImpactEffect(bullet.x, bullet.y);
    });

    // Add atmospheric background elements
    this.createAtmosphericBackground();
    this.createParticles();
  }

  createElevatedPlatforms() {
    // Use shared platform definitions with dark gray color scheme
    ELEVATED_PLATFORMS.forEach(platform => {
      const rect = this.add.rectangle(platform.x, platform.y, platform.width, platform.height, 0x3A3A3A);
      rect.setStrokeStyle(1, 0x4A4A4A); // Subtle edge highlight
      this.platforms.add(rect);
    });
  }

  createAtmosphericBackground() {
    // Add subtle geometric patterns in the far background
    for (let i = 0; i < 10; i++) {
      const size = Phaser.Math.Between(100, 200);
      const shape = this.add.rectangle(
        Phaser.Math.Between(0, ARENA_WIDTH),
        Phaser.Math.Between(100, ARENA_HEIGHT - 200),
        size,
        size,
        0x1A1A1A,
        0.1
      );
      shape.setScrollFactor(0.2); // Far parallax
      shape.setAngle(Phaser.Math.Between(0, 45));
    }

    // Add floating ambient particles
    for (let i = 0; i < 20; i++) {
      const particle = this.add.circle(
        Phaser.Math.Between(0, ARENA_WIDTH),
        Phaser.Math.Between(0, ARENA_HEIGHT),
        Phaser.Math.Between(1, 3),
        0x333333,
        0.3
      );
      particle.setScrollFactor(0.5); // Mid parallax
      
      // Animate floating
      this.tweens.add({
        targets: particle,
        y: particle.y + Phaser.Math.Between(50, 100),
        duration: Phaser.Math.Between(5000, 8000),
        ease: 'Sine.easeInOut',
        yoyo: true,
        repeat: -1,
        delay: Phaser.Math.Between(0, 2000)
      });
    }
    
    // Add vignette effect (dark edges)
    const vignette = this.add.graphics();
    vignette.fillStyle(0x000000, 0);
    
    // Create gradient effect at edges
    const gradientWidth = 200;
    
    // Left edge
    for (let i = 0; i < gradientWidth; i++) {
      const alpha = (1 - (i / gradientWidth)) * 0.5;
      vignette.fillStyle(0x000000, alpha);
      vignette.fillRect(i, 0, 1, ARENA_HEIGHT);
    }
    
    // Right edge
    for (let i = 0; i < gradientWidth; i++) {
      const alpha = (1 - (i / gradientWidth)) * 0.5;
      vignette.fillStyle(0x000000, alpha);
      vignette.fillRect(ARENA_WIDTH - gradientWidth + i, 0, 1, ARENA_HEIGHT);
    }
    
    vignette.setScrollFactor(0);
    vignette.setDepth(-100); // Ensure it's behind everything
  }

  createParticles() {
    // Create dust particles for landing effects - subtle and matching platform color
    const particles = this.add.particles(0, 0, 'white-rect', {
      scale: { start: 0.05, end: 0.15 },
      speed: { min: 30, max: 60 },
      lifespan: 400,
      quantity: 0,
      tint: 0x4A4A4A, // Platform edge color
      alpha: { start: 0.5, end: 0 }
    });

    // Store particles for later use
    this.player.dustParticles = particles;
  }

  setupMultiplayerHandlers() {
    if (!this.networkManager || !this.isMultiplayer) return;
    
    console.log("Setting up multiplayer handlers...");
    console.log("Current remotePlayers count:", this.remotePlayers.size);
    
    // Set up event listeners
    this.networkManager.on("team-assigned", (data: { playerId: string; team: "red" | "blue"; roomId: string }) => {
      this.localPlayerId = data.playerId;
      
      // Create team-specific texture and update player
      const teamColor = data.team === "red" ? TEAM_COLORS.RED : TEAM_COLORS.BLUE;
      
      // Create team-colored texture
      const teamGraphics = this.add.graphics();
      teamGraphics.fillStyle(teamColor, 1);
      teamGraphics.fillRect(0, 0, 32, 48); // Back to normal size
      teamGraphics.generateTexture(`${data.team}-player`, 32, 48);
      teamGraphics.destroy();
      
      // Update player texture
      this.player.setTexture(`${data.team}-player`);
      
      // Update direction indicator color (if enabled)
      if (this.directionIndicator) {
        this.directionIndicator.setFillStyle(teamColor, 0.8);
      }
      
      // Teleport to team spawn point
      if (data.team === "red") {
        this.player.setPosition(200, 500);
      } else {
        this.player.setPosition(2800, 500);
      }
      
      console.log(`Joined team ${data.team} with player ID ${data.playerId}!`);
      console.log(`Connected to room ${data.roomId}`);
      
      // Process any players that were added before we got our ID
      this.networkManager?.emit("process-pending-players");
    });
    
    this.networkManager.on("player-added", (player: PlayerData) => {
      // Skip if it's the local player or already exists
      if (player.id === this.localPlayerId || this.remotePlayers.has(player.id)) {
        console.log(`Skipping player ${player.id} - is local: ${player.id === this.localPlayerId}, already exists: ${this.remotePlayers.has(player.id)}`);
        return;
      }
      
      // Create remote player
      const remotePlayer = new RemotePlayer(this, player.id, player.x, player.y, player.team, player.name);
      this.remotePlayers.set(player.id, remotePlayer);
      console.log(`Player ${player.name} (${player.id}) joined on team ${player.team} at position (${player.x}, ${player.y})`);
    });
    
    this.networkManager.on("player-removed", (playerId: string) => {
      const remotePlayer = this.remotePlayers.get(playerId);
      if (remotePlayer) {
        console.log(`Removing player ${playerId}`);
        remotePlayer.destroy();
        this.remotePlayers.delete(playerId);
        console.log(`Player ${playerId} removed successfully`);
      }
    });
    
    this.networkManager.on("player-updated", (player: PlayerData) => {
      const remotePlayer = this.remotePlayers.get(player.id);
      if (remotePlayer) {
        remotePlayer.update(
          player.x, 
          player.y, 
          player.velocityX, 
          player.velocityY, 
          player.health, 
          player.flipX, 
          player.isDashing,
          player.isDead
        );
      } else if (player.id !== this.localPlayerId && !this.remotePlayers.has(player.id)) {
        // Player doesn't exist yet, create them
        console.log(`Creating player ${player.id} from update event`);
        const newRemotePlayer = new RemotePlayer(this, player.id, player.x, player.y, player.team, player.name);
        this.remotePlayers.set(player.id, newRemotePlayer);
      }
    });
    
    this.networkManager.on("bullet-added", (bullet: BulletData) => {
      // Only render bullets from other players
      if (bullet.ownerId !== this.localPlayerId) {
        // Create visual bullet with team color
        const bulletColor = bullet.ownerTeam === "blue" ? TEAM_COLORS.BLUE_GLOW : TEAM_COLORS.RED_GLOW;
        const bulletSprite = this.add.rectangle(bullet.x, bullet.y, 10, 6, bulletColor);
        
        // Animate bullet
        this.tweens.add({
          targets: bulletSprite,
          x: bullet.x + (bullet.velocityX * 3), // 3 seconds of travel
          duration: 3000,
          onComplete: () => bulletSprite.destroy()
        });
      }
    });
    
    this.networkManager.on("state-changed", (state: { gameState: string; winningTeam?: string; scores?: { red: number; blue: number } }) => {
      // Update game state UI if needed
      if (state.gameState === "ended") {
        console.log(`Game ended! ${state.winningTeam} team wins!`);
      }
      
      // Update scores
      if (state.scores) {
        this.redScore = state.scores.red;
        this.blueScore = state.scores.blue;
        this.updateScoreDisplay();
      }
    });
    
    // Listen for kill events
    this.networkManager.on("player-killed", (data: { killerId: string; victimId: string; killerName?: string; victimName?: string }) => {
      // Add to kill feed
      const killerName = data.killerName || "Player";
      const victimName = data.victimName || "Player";
      this.addKillFeedMessage(killerName, victimName);
      
      // Play death sound if it's the local player
      if (data.victimId === this.localPlayerId) {
        // Could add death sound here
      }
    });
    
    // Listen for our own position updates from server (for reconciliation)
    this.networkManager.on("local-player-server-update", (serverData: { x: number; y: number; health: number; isDead?: boolean; respawnTimer?: number }) => {
      this.handleServerReconciliation({ x: serverData.x, y: serverData.y });
      
      // Update health and check for damage
      if (serverData.health !== undefined) {
        const previousHealth = this.currentHealth;
        this.currentHealth = serverData.health;
        this.updateHealthUI();
        
        // Trigger hit effect if we took damage
        if (previousHealth > this.currentHealth && this.currentHealth > 0) {
          this.createHitEffect(this.player.x, this.player.y);
          this.soundManager.playHit();
        }
      }
      
      // Update death state
      if (serverData.isDead !== undefined) {
        const wasDead = this.isDead;
        this.isDead = serverData.isDead;
        
        if (this.isDead && !wasDead) {
          // Player just died
          this.player.setAlpha(0.3);
          this.player.setVelocity(0, 0);
          const team = this.networkManager?.getPlayerTeam() || "red";
          this.createDeathEffect(this.player.x, this.player.y, team);
          this.soundManager.playDeath();
        } else if (!this.isDead && wasDead) {
          // Player respawned
          this.player.setAlpha(1);
          this.respawnTimer?.setVisible(false);
        }
      }
      
      // Update respawn timer
      if (this.isDead && serverData.respawnTimer !== undefined && this.respawnTimer) {
        const seconds = Math.ceil(serverData.respawnTimer / 1000);
        if (seconds > 0) {
          this.respawnTimer.setText(`Respawning in ${seconds}...`);
          this.respawnTimer.setVisible(true);
        } else {
          this.respawnTimer.setVisible(false);
        }
      }
    });
    
    // Connection is already established from LobbyScene
    console.log("Multiplayer handlers ready!");
    
    // Get initial player ID if already assigned
    const playerId = this.networkManager.getPlayerId();
    if (playerId) {
      this.localPlayerId = playerId;
      console.log("Already have player ID:", this.localPlayerId);
    }
    
    // Set initial team color
    const team = this.networkManager.getPlayerTeam();
    if (team) {
      const teamColor = team === "red" ? 0xFF6B6B : 0x4ECDC4;
      this.player.setTint(teamColor);
      console.log("Already assigned to team:", team);
      
      // Teleport to team spawn point if already assigned
      if (team === "red") {
        this.player.setPosition(200, 500);
      } else {
        this.player.setPosition(2800, 500);
      }
    }
    
    // Create multiplayer UI
    this.createMultiplayerUI();
    
    // Request current room state to ensure we have all players
    console.log("Local player ID:", this.localPlayerId);
    console.log("Checking for existing players in room...");
  }
  
  createMultiplayerUI() {
    // Create UI container
    this.multiplayerUI = this.add.container(0, 0);
    this.multiplayerUI.setScrollFactor(0);
    
    // Minimal dark background for team info
    const bg = this.add.rectangle(512, 30, 200, 50, 0x1A1A1A, 0.8);
    
    // Team indicator
    const team = this.networkManager?.getPlayerTeam();
    const teamColor = team === "red" ? "#E74C3C" : team === "blue" ? "#3498DB" : "#ffffff";
    const teamText = this.add.text(512, 20, `Team: ${team?.toUpperCase() || 'Unknown'}`, {
      fontSize: '16px',
      color: teamColor,
      fontFamily: 'Arial, sans-serif'
    }).setOrigin(0.5);
    
    // Leave button - subtle style
    const leaveBtn = this.add.text(512, 40, '[Leave Game]', {
      fontSize: '14px',
      color: '#999999',
      fontFamily: 'Arial, sans-serif'
    }).setOrigin(0.5)
      .setInteractive()
      .on('pointerover', () => leaveBtn.setColor('#ffffff'))
      .on('pointerout', () => leaveBtn.setColor('#999999'))
      .on('pointerdown', () => {
        this.leaveMultiplayer();
      });
    
    this.multiplayerUI.add([bg, teamText, leaveBtn]);
    
    // Create team score display - minimalist style
    this.scoreText = this.add.text(512, 80, 'Red: 0 | Blue: 0', {
      fontSize: '20px',
      color: '#ffffff',
      fontFamily: 'Arial, sans-serif'
    });
    this.scoreText.setOrigin(0.5);
    this.scoreText.setScrollFactor(0);
    
    // Create health bar UI in top-left
    this.createHealthUI();
    
    // Create debug display (F3 to toggle)
    this.debugText = this.add.text(10, 100, '', {
      fontSize: '12px',
      color: '#00ff00',
      backgroundColor: '#000000',
      padding: { x: 5, y: 5 }
    });
    this.debugText.setScrollFactor(0);
    this.debugText.setVisible(false);
    
    // Toggle debug with F3
    this.input.keyboard?.on('keydown-F3', () => {
      if (this.debugText) {
        this.debugText.setVisible(!this.debugText.visible);
      }
    });
  }
  
  createHealthUI() {
    // Minimalist health bar - no borders
    this.healthBarBg = this.add.rectangle(20, 20, 200, 8, 0x2B2B2B);
    this.healthBarBg.setOrigin(0, 0);
    this.healthBarBg.setScrollFactor(0);
    
    // Health bar fill - gradient from green to red based on health
    this.healthBar = this.add.rectangle(20, 20, 200, 8, 0x2ECC71);
    this.healthBar.setOrigin(0, 0);
    this.healthBar.setScrollFactor(0);
    
    // Health text - clean typography
    this.healthText = this.add.text(120, 28, '100', {
      fontSize: '16px',
      color: '#ffffff',
      fontFamily: 'Arial, sans-serif'
    });
    this.healthText.setOrigin(0.5);
    this.healthText.setScrollFactor(0);
    
    // Respawn timer - minimal style
    this.respawnTimer = this.add.text(512, 300, '', {
      fontSize: '28px',
      color: '#ffffff',
      fontFamily: 'Arial, sans-serif'
    });
    this.respawnTimer.setOrigin(0.5);
    this.respawnTimer.setScrollFactor(0);
    this.respawnTimer.setVisible(false);
    
    // Create kill feed container
    this.killFeedContainer = this.add.container(1014, 600);
    this.killFeedContainer.setScrollFactor(0);
  }
  
  addKillFeedMessage(killerName: string, victimName: string) {
    if (!this.killFeedContainer) return;
    
    // Create kill message
    const message = this.add.text(0, 0, `${killerName} eliminated ${victimName}`, {
      fontSize: '14px',
      color: '#ffffff',
      backgroundColor: '#000000',
      padding: { x: 8, y: 4 }
    });
    message.setOrigin(1, 0);
    message.setAlpha(0.9);
    
    // Position message
    const yOffset = this.killFeedMessages.length * 25;
    message.setY(-yOffset);
    
    this.killFeedContainer.add(message);
    this.killFeedMessages.push(message);
    
    // Fade out and remove after 5 seconds
    this.tweens.add({
      targets: message,
      alpha: 0,
      delay: 5000,
      duration: 500,
      onComplete: () => {
        const index = this.killFeedMessages.indexOf(message);
        if (index > -1) {
          this.killFeedMessages.splice(index, 1);
          message.destroy();
          
          // Reposition remaining messages
          this.killFeedMessages.forEach((msg, i) => {
            this.tweens.add({
              targets: msg,
              y: -i * 25,
              duration: 200
            });
          });
        }
      }
    });
    
    // Limit to 5 messages
    if (this.killFeedMessages.length > 5) {
      const oldestMessage = this.killFeedMessages.shift();
      oldestMessage?.destroy();
    }
  }
  
  updateHealthUI() {
    if (!this.healthBar || !this.healthText) return;
    
    // Update bar width
    const healthPercent = this.currentHealth / 100;
    this.healthBar.setDisplaySize(200 * healthPercent, 8);
    
    // Update bar color based on health
    if (healthPercent > 0.6) {
      this.healthBar.setFillStyle(0x2ECC71); // Green
    } else if (healthPercent > 0.3) {
      this.healthBar.setFillStyle(0xF1C40F); // Yellow
    } else {
      this.healthBar.setFillStyle(0xE74C3C); // Red
    }
    
    // Update text
    this.healthText.setText(`${Math.max(0, Math.round(this.currentHealth))}`);
  }

  updateScoreDisplay() {
    if (this.scoreText) {
      this.scoreText.setText(`Red: ${this.redScore} | Blue: ${this.blueScore}`);
    }
  }
  
  createHitEffect(x: number, y: number) {
    // Create a burst of red particles for hit effect
    const particleCount = 5;
    
    for (let i = 0; i < particleCount; i++) {
      const particle = this.add.circle(x, y, 3, 0xff0000);
      
      // Random direction
      const angle = (Math.PI * 2 * i) / particleCount + Math.random() * 0.5;
      const speed = 100 + Math.random() * 100;
      
      // Animate particle
      this.tweens.add({
        targets: particle,
        x: x + Math.cos(angle) * speed,
        y: y + Math.sin(angle) * speed,
        alpha: 0,
        scale: 0.5,
        duration: 500,
        ease: 'Power2',
        onComplete: () => particle.destroy()
      });
    }
    
    // Flash the screen slightly
    this.cameras.main.flash(100, 255, 0, 0, false);
  }
  
  createDeathEffect(x: number, y: number, team: string) {
    // Create a burst of team-colored particles
    const teamColor = team === "red" ? 0xFF6B6B : 0x4ECDC4;
    const particleCount = 15;
    
    for (let i = 0; i < particleCount; i++) {
      const particle = this.add.circle(x, y, 4, teamColor);
      
      // Random direction
      const angle = (Math.PI * 2 * i) / particleCount + Math.random() * 0.3;
      const speed = 150 + Math.random() * 150;
      
      // Animate particle
      this.tweens.add({
        targets: particle,
        x: x + Math.cos(angle) * speed,
        y: y + Math.sin(angle) * speed,
        alpha: 0,
        scale: 0.2,
        duration: 800,
        ease: 'Power3',
        onComplete: () => particle.destroy()
      });
    }
    
    // Create expanding ring effect
    const ring = this.add.circle(x, y, 10, teamColor, 0);
    ring.setStrokeStyle(3, teamColor);
    
    this.tweens.add({
      targets: ring,
      scale: 4,
      alpha: 0,
      duration: 600,
      ease: 'Power2',
      onComplete: () => ring.destroy()
    });
  }
  
  createBulletImpactEffect(x: number, y: number) {
    // Create small particle burst for bullet impact
    const particleCount = 3;
    
    for (let i = 0; i < particleCount; i++) {
      const particle = this.add.circle(x, y, 2, 0x666666);
      
      // Random direction
      const angle = (Math.PI * 2 * i) / particleCount + Math.random() * 0.5;
      const speed = 50 + Math.random() * 50;
      
      // Animate particle
      this.tweens.add({
        targets: particle,
        x: x + Math.cos(angle) * speed,
        y: y + Math.sin(angle) * speed,
        alpha: 0,
        scale: 0.5,
        duration: 300,
        ease: 'Power2',
        onComplete: () => particle.destroy()
      });
    }
  }
  
  leaveMultiplayer() {
    if (this.networkManager) {
      this.networkManager.disconnect();
      this.networkManager = undefined;
    }
    
    // Clean up remote players
    this.remotePlayers.forEach(player => player.destroy());
    this.remotePlayers.clear();
    
    // Reset to single player
    this.isMultiplayer = false;
    this.localPlayerId = undefined;
    
    // Reset player to default red texture
    this.player.setTexture('red-player');
    
    // Destroy multiplayer UI
    this.multiplayerUI?.destroy();
    this.multiplayerUI = undefined;
    
    // Hide debug text
    this.debugText?.setVisible(false);
    
    // Clean up registry
    this.game.registry.remove('networkManager');
    this.game.registry.remove('isMultiplayer');
    
    console.log("Left multiplayer mode");
  }

  update() {
    // Guard against player not existing yet
    if (!this.player || !this.player.body) {
      return;
    }
    
    // Ensure cursors are initialized
    if (!this.cursors) {
      return;
    }
    
    const maxSpeed = 300;
    const acceleration = 1200; // High acceleration for snappy movement
    const friction = 800; // Quick deceleration when not moving
    const dashPower = 800; // 2x more powerful
    
    const playerBody = this.player.body as Phaser.Physics.Arcade.Body;
    const currentVelX = playerBody.velocity.x;
    
    // If player is dead, don't allow any input
    if (this.isDead) {
      return;
    }

    // Update weapon system
    this.weaponSystem.update(this.game.loop.delta);

    // Handle shooting (either Space or A key)
    if (Phaser.Input.Keyboard.JustDown(this.shootKey) || Phaser.Input.Keyboard.JustDown(this.shootKeyAlt)) {
      // Get team color for bullets
      let bulletColor: number = TEAM_COLORS.RED_GLOW; // Default red
      if (this.isMultiplayer && this.networkManager) {
        const team = this.networkManager.getPlayerTeam();
        bulletColor = team === "blue" ? TEAM_COLORS.BLUE_GLOW : TEAM_COLORS.RED_GLOW; // Bright team colors for bullets
      }
      
      if (this.weaponSystem.shoot(this.isDashing, bulletColor)) {
        this.soundManager.playShoot();
        
        // Send shoot to server if multiplayer
        if (this.isMultiplayer && this.networkManager) {
          const direction = this.player.flipX ? -1 : 1;
          const bulletX = this.player.x + (24 * direction * 0.9);
          const bulletY = this.player.y;
          const bulletVelocityX = 700 * direction;
          
          // Validate bullet data before sending
          if (isNaN(bulletX) || isNaN(bulletY) || isNaN(bulletVelocityX)) {
            console.error("Invalid bullet data detected:", {
              playerX: this.player.x,
              playerY: this.player.y,
              direction: direction,
              bulletX: bulletX,
              bulletY: bulletY,
              bulletVelocityX: bulletVelocityX
            });
          } else {
            this.networkManager.sendShoot({
              x: bulletX,
              y: bulletY,
              velocityX: bulletVelocityX
            });
          }
        }
      }
    }

    // Update dash cooldown
    if (this.dashCooldown > 0) {
      this.dashCooldown -= this.game.loop.delta;
    }

    // Reset dash ability when touching ground
    if (playerBody.touching.down) {
      this.canDash = true;
      // Cancel dash buffer if player lands
      if (this.dashBuffering) {
        this.dashBuffering = false;
        this.dashBufferTime = 0;
      }
    }

    // Handle dash buffering
    if (this.dashBuffering) {
      this.dashBufferTime += this.game.loop.delta;
      
      // Execute dash after buffer window
      if (this.dashBufferTime >= this.DASH_BUFFER_WINDOW_MS) {
        this.dashBuffering = false;
        this.dashBufferTime = 0;
        this.performDash(dashPower);
      }
    } else {
      // Start dash buffer on fresh key press
      if (Phaser.Input.Keyboard.JustDown(this.dashKey) && this.canDash && this.dashCooldown <= 0 && !this.isDashing && !playerBody.touching.down) {
        this.dashBuffering = true;
        this.dashBufferTime = 0;
      }
    }

    // Handle dash
    if (this.isDashing) {
      // Check if player is still holding at least one initial direction
      const stillHoldingLeft = this.initialDashDirections.left && this.cursors?.left?.isDown;
      const stillHoldingRight = this.initialDashDirections.right && this.cursors?.right?.isDown;
      const stillHoldingUp = this.initialDashDirections.up && this.cursors?.up?.isDown;
      const stillHoldingDown = this.initialDashDirections.down && this.cursors?.down?.isDown;
      
      const stillHoldingAnyDirection = stillHoldingLeft || stillHoldingRight || stillHoldingUp || stillHoldingDown;
      
      if (!stillHoldingAnyDirection) {
        // Cancel dash early
        this.endDash();
      } else {
        this.updateDashTrails();
      }
      return;
    }

    // Horizontal movement
    if (this.cursors?.left?.isDown) {
      // Accelerate to max speed quickly
      const newVelX = Math.max(currentVelX - acceleration * (1/60), -maxSpeed);
      this.player.setVelocityX(newVelX);
      this.player.setFlipX(true);
    } else if (this.cursors?.right?.isDown) {
      // Accelerate to max speed quickly
      const newVelX = Math.min(currentVelX + acceleration * (1/60), maxSpeed);
      this.player.setVelocityX(newVelX);
      this.player.setFlipX(false);
    } else {
      // Apply friction for quick stop
      if (Math.abs(currentVelX) > 10) {
        const frictionForce = friction * (1/60);
        if (currentVelX > 0) {
          this.player.setVelocityX(Math.max(0, currentVelX - frictionForce));
        } else {
          this.player.setVelocityX(Math.min(0, currentVelX + frictionForce));
        }
      } else {
        this.player.setVelocityX(0);
      }
    }

    // Jumping - only on fresh key press, not when held
    const canJump = playerBody.touching.down || this.coyoteTime > 0;
    
    if (this.jumpKey && Phaser.Input.Keyboard.JustDown(this.jumpKey) && canJump) {
      this.player.setVelocityY(-550);
      this.coyoteTime = 0; // Reset coyote time after jumping
      
      // Create dust effect on jump
      const particles = this.player.dustParticles;
      if (particles) {
        particles.setPosition(this.player.x, this.player.y + 24);
        particles.explode(5);
      }
    }

    // Update coyote time
    if (playerBody.touching.down) {
      this.coyoteTime = this.COYOTE_TIME_MS;
    } else if (this.coyoteTime > 0) {
      this.coyoteTime -= this.game.loop.delta;
    }

    // Fast fall when pressing down in midair (only if not dashing)
    if (this.cursors?.down?.isDown && !playerBody.touching.down && !this.isDashing) {
      // Apply strong downward force for fast fall
      this.player.setVelocityY(Math.max(playerBody.velocity.y, 300));
    }

    // Dynamic gravity based on jump phase (skip if dashing)
    if (!this.isDashing) {
      if (!playerBody.touching.down) {
        // Check if fast falling
        const isFastFalling = this.cursors?.down?.isDown && playerBody.velocity.y > 0;
        
        if (isFastFalling) {
          // Fast fall - very high gravity
          playerBody.setGravityY(1000);
        } else if (playerBody.velocity.y < -50) {
          // Ascending fast - normal gravity for quick rise
          playerBody.setGravityY(450);
        } else if (playerBody.velocity.y >= -50 && playerBody.velocity.y <= 30) {
          // Hang time - slightly reduced gravity for brief float (less floaty)
          playerBody.setGravityY(350);
        } else {
          // Falling fast - high gravity for quick descent
          playerBody.setGravityY(900);
        }
      } else {
        // On ground - reset gravity
        playerBody.setGravityY(0);
      }
    }

    // Add some bounce and feel
    if (playerBody.touching.down && Math.abs(playerBody.velocity.x) > 0) {
      // Create small dust particles when running
      if (Math.random() < 0.1) {
        const particles = this.player.dustParticles;
        if (particles) {
          particles.setPosition(this.player.x, this.player.y + 24);
          particles.explode(1);
        }
      }
    }

    // Camera smoothing based on player movement
    const camera = this.cameras.main;
    if (Math.abs(playerBody.velocity.x) > 50) {
      camera.setLerp(0.1, 0.1);
    } else {
      camera.setLerp(0.05, 0.05);
    }

    // Update dash trails
    this.updateDashTrails();

    // Apply smooth reconciliation if we have prediction error (only when not dashing)
    if (!this.isDashing && (this.predictionError.x !== 0 || this.predictionError.y !== 0)) {
      // Use slower reconciliation for a brief period after dashing
      const reconciliationSpeed = this.dashCooldown > 0 ? 0.05 : this.reconciliationSpeed;
      
      const reconcileX = this.predictionError.x * reconciliationSpeed * (this.game.loop.delta / 1000);
      const reconcileY = this.predictionError.y * reconciliationSpeed * (this.game.loop.delta / 1000);
      
      // Apply reconciliation
      this.player.x += reconcileX;
      this.player.y += reconcileY;
      
      // Reduce error
      this.predictionError.x -= reconcileX;
      this.predictionError.y -= reconcileY;
      
      // Clear tiny errors
      if (Math.abs(this.predictionError.x) < 0.1) this.predictionError.x = 0;
      if (Math.abs(this.predictionError.y) < 0.1) this.predictionError.y = 0;
    }

    // Send player position to server if multiplayer
    if (this.isMultiplayer && this.networkManager) {
      this.networkManager.sendMovement({
        x: this.player.x,
        y: this.player.y,
        velocityX: playerBody.velocity.x,
        velocityY: playerBody.velocity.y,
        flipX: this.player.flipX
      });
      
      // Update debug text
      if (this.debugText && this.debugText.visible) {
        const errorMag = Math.sqrt(this.predictionError.x * this.predictionError.x + this.predictionError.y * this.predictionError.y);
        this.debugText.setText([
          `Network Debug (F3 to hide)`,
          `Player ID: ${this.localPlayerId}`,
          `Position: ${Math.round(this.player.x)}, ${Math.round(this.player.y)}`,
          `Velocity: ${Math.round(playerBody.velocity.x)}, ${Math.round(playerBody.velocity.y)}`,
          `Prediction Error: ${errorMag.toFixed(1)}px`,
          `Dash State: ${this.isDashing ? 'DASHING' : (this.dashCooldown > 0 ? `Cooldown: ${Math.round(this.dashCooldown)}ms` : 'Ready')}`,
          `Remote Players: ${this.remotePlayers.size}`,
          `FPS: ${Math.round(this.game.loop.actualFps)}`
        ].join('\n'));
      }
    }

    // Update character animations
    this.updateCharacterAnimations(); // Re-enabled now that visibility is fixed
  }

  performDash(dashPower: number) {
    // Determine dash direction based on input
    let dashX = 0;
    let dashY = 0;

    // Store initial dash directions
    this.initialDashDirections.left = !!this.cursors?.left?.isDown;
    this.initialDashDirections.right = !!this.cursors?.right?.isDown;
    this.initialDashDirections.up = !!this.cursors?.up?.isDown;
    this.initialDashDirections.down = !!this.cursors?.down?.isDown;

    if (this.initialDashDirections.left) {
      dashX = -1;
    }
    if (this.initialDashDirections.right) {
      dashX = 1;
    }
    if (this.initialDashDirections.up) {
      dashY = -1;
    }
    if (this.initialDashDirections.down) {
      dashY = 1;
    }

    // Default to horizontal dash in facing direction if no input
    if (dashX === 0 && dashY === 0) {
      dashX = this.player.flipX ? -1 : 1;
      // Update the stored direction for default dash
      if (this.player.flipX) {
        this.initialDashDirections.left = true;
      } else {
        this.initialDashDirections.right = true;
      }
    }

    // Normalize diagonal dashes
    const magnitude = Math.sqrt(dashX * dashX + dashY * dashY);
    if (magnitude > 0) {
      dashX /= magnitude;
      dashY /= magnitude;
    }

    // Apply dash velocity
    this.player.setVelocity(dashX * dashPower, dashY * dashPower);
    
    // Disable gravity during dash
    const playerBody = this.player.body as Phaser.Physics.Arcade.Body;
    playerBody.allowGravity = false;
    
    // Set dash state
    this.isDashing = true;
    this.canDash = false;
    this.dashCooldown = 300; // Longer cooldown for network sync

    // Play dash sound
    this.soundManager.playDash();

    // Clear any existing prediction error when starting dash
    this.predictionError.x = 0;
    this.predictionError.y = 0;
    console.log(`Starting dash with velocity: ${dashX * dashPower}, ${dashY * dashPower}`);

    // Send dash to server if multiplayer
    if (this.isMultiplayer && this.networkManager) {
      this.networkManager.sendDash(true);
    }

    // Keep team color during dash (no tint change for cleaner aesthetic)
    // The dash trails will provide the visual feedback

    // End dash after duration (if not cancelled early)
    this.time.delayedCall(150, () => {
      if (this.isDashing) {
        this.endDash();
      }
    });

    // Create initial dash trail
    this.createDashTrail();
  }

  endDash() {
    this.isDashing = false;
    
    // Send dash end to server if multiplayer
    if (this.isMultiplayer && this.networkManager) {
      this.networkManager.sendDash(false);
    }
    
    // No need to set tint - texture already has correct color
    // REMOVED: Team color tinting since we use direct colored textures
    
    // Reduce velocity slightly after dash
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    const currentVelX = body.velocity.x;
    const currentVelY = body.velocity.y;
    this.player.setVelocity(currentVelX * 0.7, currentVelY * 0.7);
    
    // Re-enable gravity after dash
    body.allowGravity = true;
    // The dynamic gravity system will take over in the next update cycle
    
    // Reset scale and rotation after dash
    this.player.setScale(1, 1);
    this.player.setRotation(0);
    
    // Reset jump launch state
    this.isJumpLaunching = false;
    
    // Reset initial dash directions
    this.initialDashDirections.left = false;
    this.initialDashDirections.right = false;
    this.initialDashDirections.up = false;
    this.initialDashDirections.down = false;
  }

  createDashTrail() {
    // Remove oldest trail if at max
    if (this.dashTrails.length >= this.MAX_TRAILS) {
      const oldTrail = this.dashTrails.shift();
      if (oldTrail) {
        oldTrail.destroy();
      }
    }

    // Create new trail using the same texture as the player
    const trail = this.add.sprite(this.player.x, this.player.y, this.player.texture.key);
    trail.setDisplaySize(32, 48);
    trail.setAlpha(0.6);
    trail.setFlipX(this.player.flipX);

    this.dashTrails.push(trail);

    // Fade out trail
    this.tweens.add({
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

  updateDashTrails() {
    // Create trail during dash
    if (this.isDashing && Math.random() < 0.8) {
      this.createDashTrail();
    }
  }
  
  handleServerReconciliation(serverPos: { x: number; y: number }) {
    // Calculate prediction error
    const currentX = this.player.x;
    const currentY = this.player.y;
    
    this.predictionError.x = serverPos.x - currentX;
    this.predictionError.y = serverPos.y - currentY;
    
    // Only reconcile if error is significant (to avoid jitter)
    const errorMagnitude = Math.sqrt(this.predictionError.x * this.predictionError.x + this.predictionError.y * this.predictionError.y);
    
    if (errorMagnitude > 5) { // 5 pixels threshold
      // Store server position for smooth reconciliation
      this.lastServerPosition.x = serverPos.x;
      this.lastServerPosition.y = serverPos.y;
      
      // Be more tolerant during dashes and shortly after
      const snapThreshold = this.isDashing || this.dashCooldown > 0 ? 300 : 100;
      
      // If error is too large, snap to server position
      if (errorMagnitude > snapThreshold) {
        this.player.setPosition(serverPos.x, serverPos.y);
        this.predictionError.x = 0;
        this.predictionError.y = 0;
        console.log(`Large prediction error (${errorMagnitude.toFixed(1)}px), snapping to server position`);
      }
    } else {
      // Small error, clear it
      this.predictionError.x = 0;
      this.predictionError.y = 0;
    }
  }
  
  // Character animation methods

  
  updateCharacterAnimations() {
    // Safety check
    if (!this.player || !this.player.body || !this.player.active) {
      return;
    }
    
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    const velocityX = body.velocity.x;
    const velocityY = body.velocity.y;

    // Check if grounded
    this.wasGrounded = this.isGrounded;
    this.isGrounded = body.blocked.down || body.touching.down;

    // Detect jump launch (transition from grounded to airborne with upward velocity)
    if (this.wasGrounded && !this.isGrounded && velocityY < -100) {
      // Start jump launch animation
      this.isJumpLaunching = true;
      this.jumpLaunchTime = this.time.now;
    }

    // Update jump launch animation
    if (this.isJumpLaunching) {
      const timeSinceLaunch = this.time.now - this.jumpLaunchTime;
      if (timeSinceLaunch < this.JUMP_LAUNCH_DURATION) {
        // Still in launch phase - apply stretch
        this.player.setScale(0.8, 1.3);
      } else {
        // Launch phase over - return to normal
        this.isJumpLaunching = false;
        this.player.setScale(1, 1);
      }
    }

    // Landing squash effect
    if (!this.wasGrounded && this.isGrounded && velocityY > 100) {
      this.createLandingSquash();
      // Reset jump launch state when landing
      this.isJumpLaunching = false;
    }



    // Movement lean
    if (Math.abs(velocityX) > 10) {
      const leanAngle = Phaser.Math.Clamp(velocityX * 0.015, -5, 5); // Max 5 degrees
      this.player.setRotation(Phaser.Math.DegToRad(leanAngle));
    } else if (this.isGrounded && !this.isDashing) {
      // Return to upright position
      this.player.setRotation(0);
    }

    // REMOVED: Old velocity-based jump stretch - now using launch timing above
    
    // FORCE normal scale when grounded and not doing special animations
    if (this.isGrounded && !this.isDashing && !this.landingSquashTween?.isPlaying() && !this.isJumpLaunching) {
      this.player.setScale(1, 1);
    }
    
    // Update direction indicator
    if (this.directionIndicator) {
      // Position above player
      this.directionIndicator.setPosition(this.player.x, this.player.y - 35);
      
      // Point in movement direction or fade if stationary
      if (Math.abs(velocityX) > 10) {
        this.directionIndicator.setAlpha(0.8);
        
        // Calculate angle based on velocity
        const angle = velocityX > 0 ? 90 : -90;
        this.directionIndicator.setRotation(Phaser.Math.DegToRad(angle));
        
        // Store last velocity for when stopped
        this.lastVelocityX = velocityX;
      } else {
        // Fade out when not moving
        this.directionIndicator.setAlpha(0.3);
        
        // Keep pointing in last direction
        const angle = this.lastVelocityX > 0 ? 90 : -90;
        this.directionIndicator.setRotation(Phaser.Math.DegToRad(angle));
      }
      
      // Glow during dash
      if (this.isDashing) {
        this.directionIndicator.setAlpha(1);
        this.directionIndicator.setScale(1.2);
      } else {
        this.directionIndicator.setScale(1);
      }
    }
  }
  
  createLandingSquash() {
    // Stop any existing landing animation
    if (this.landingSquashTween) {
      this.landingSquashTween.stop();
    }
    
    // More subtle squash effect
    this.player.setScale(1.15, 0.85);
    
    this.landingSquashTween = this.tweens.add({
      targets: this.player,
      scaleX: 1,
      scaleY: 1,
      duration: 200,
      ease: 'Back.out'
    });
  }
}