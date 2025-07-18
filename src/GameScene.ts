import Phaser from 'phaser';
import { WeaponSystem } from './WeaponSystem';
import { Bullet } from './BulletPool';
import { SoundManager } from './SoundManager';
import { RemotePlayer } from './network/RemotePlayer';
import { LocalPlayer } from './entities/LocalPlayer';
import { NetworkManager, PlayerData, BulletData } from './network/NetworkManager';
import { ARENA_WIDTH, ARENA_HEIGHT, MAIN_PLATFORM, ELEVATED_PLATFORMS } from '../shared/WorldGeometry';
import { COLORS, getTeamColors } from './config/Colors';
import { GAME_CONFIG, getSpawnPosition } from './config/GameConfig';

// Team colors now imported from config/Colors.ts

export class GameScene extends Phaser.Scene {
  private player!: LocalPlayer;
  private platforms!: Phaser.Physics.Arcade.StaticGroup;
  private dustParticles?: Phaser.GameObjects.Particles.ParticleEmitter;
  private weaponSystem!: WeaponSystem;
  private soundManager!: SoundManager;
  private networkManager?: NetworkManager;
  private remotePlayers: Map<string, RemotePlayer> = new Map();
  private isMultiplayer: boolean = false;
  private localPlayerId?: string;
  private multiplayerUI?: Phaser.GameObjects.Container;

  // Client-side prediction
  private lastServerPosition: { x: number; y: number } = { x: 0, y: 0 };
  private predictionError: { x: number; y: number } = { x: 0, y: 0 };
  private reconciliationSpeed: number = 0.3; // How fast to correct prediction errors
  private debugText?: Phaser.GameObjects.Text;
  
  // Health UI
  private healthBar?: Phaser.GameObjects.Rectangle;
  private healthBarBg?: Phaser.GameObjects.Rectangle;
  private healthText?: Phaser.GameObjects.Text;
  private currentHealth: number = GAME_CONFIG.PLAYER.HEALTH.MAX;
  private isDead: boolean = false;
  private respawnTimer?: Phaser.GameObjects.Text;
  
  // Kill feed
  private killFeedContainer?: Phaser.GameObjects.Container;
  private killFeedMessages: Phaser.GameObjects.Text[] = [];
  
  // Team scores
  private scoreText?: Phaser.GameObjects.Text;
  private redScore: number = 0;
  private blueScore: number = 0;

  // Network quality visualization
  private showNetworkQuality: boolean = false;
  private networkQualityIndicators: Map<string, Phaser.GameObjects.Graphics> = new Map();

  // Animation constants
  private readonly MAX_STRETCH: number = 1.20;
  private readonly MAX_SQUASH: number = 0.85;
  private readonly ANTICIPATION_SQUASH: number = 0.95;
  private readonly ANTICIPATION_DURATION: number = 50; // ~3 frames at 60fps
  private readonly STRETCH_SPEED: number = 15; // How fast we interpolate to target
  private readonly LANDING_DURATION: number = 100; // Recovery time after landing

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
    const mainPlatform = this.add.rectangle(MAIN_PLATFORM.x, MAIN_PLATFORM.y, MAIN_PLATFORM.width, MAIN_PLATFORM.height, COLORS.PLATFORMS.MAIN);
    mainPlatform.setStrokeStyle(1, COLORS.PLATFORMS.EDGE); // Subtle edge highlight
    this.platforms.add(mainPlatform);

    // Create multiple elevated platforms for jumping
    this.createElevatedPlatforms();

    // Create player - clean rectangle design with guaranteed visible texture
    
    // Create local player
    const playerId = this.localPlayerId || 'local-player';
    this.player = new LocalPlayer(
      this,
      playerId,
      100,
      1350,
      'red', // Default to red team
      'You'
    );
    
    // Add collision with platforms
    this.physics.add.collider(this.player, this.platforms);
    
    // Set up player event listeners
    this.setupPlayerEventListeners();

    // Camera setup - follow player but constrain to world bounds
    this.cameras.main.setBounds(0, 0, arenaWidth, ARENA_HEIGHT);
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this.cameras.main.setDeadzone(GAME_CONFIG.WORLD.CAMERA_DEADZONE.WIDTH, GAME_CONFIG.WORLD.CAMERA_DEADZONE.HEIGHT);

    // Set world bounds
    this.physics.world.setBounds(0, 0, arenaWidth, ARENA_HEIGHT);



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
  
  setupPlayerEventListeners() {
    // Listen for player events
    this.player.events.on('jump', () => {
      this.soundManager.playJump();
      // Create dust effect
      if (this.dustParticles) {
        this.dustParticles.setPosition(this.player.x, this.player.y);
        this.dustParticles.explode(5);
      }
    });
    
    this.player.events.on('land', () => {
      // Create dust effect on landing
      if (this.dustParticles) {
        this.dustParticles.setPosition(this.player.x, this.player.y);
        this.dustParticles.explode(3);
      }
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
      
      if (this.weaponSystem.shoot(this.player.isDashing, bulletColor)) {
        this.soundManager.playShoot();
        
        // Send shoot to server if multiplayer
        if (this.isMultiplayer && this.networkManager) {
          const bulletX = data.x + (24 * data.direction * 0.9);
          const bulletY = data.y;
          const bulletVelocityX = GAME_CONFIG.WEAPON.BULLET_SPEED * data.direction;
          
          this.networkManager.sendShoot({
            x: bulletX,
            y: bulletY,
            velocityX: bulletVelocityX
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

  createElevatedPlatforms() {
    // Use shared platform definitions with dark gray color scheme
    ELEVATED_PLATFORMS.forEach(platform => {
      const rect = this.add.rectangle(platform.x, platform.y, platform.width, platform.height, COLORS.PLATFORMS.ELEVATED);
      rect.setStrokeStyle(1, COLORS.PLATFORMS.EDGE); // Subtle edge highlight
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
        COLORS.BACKGROUND.SECONDARY,
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
        COLORS.EFFECTS.PARTICLE,
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
    vignette.fillStyle(COLORS.BACKGROUND.VIGNETTE, 0);
    
    // Create gradient effect at edges
    const gradientWidth = 200;
    
    // Left edge
          for (let i = 0; i < gradientWidth; i++) {
        const alpha = (1 - (i / gradientWidth)) * 0.5;
        vignette.fillStyle(COLORS.BACKGROUND.VIGNETTE, alpha);
        vignette.fillRect(i, 0, 1, ARENA_HEIGHT);
      }
    
    // Right edge
          for (let i = 0; i < gradientWidth; i++) {
        const alpha = (1 - (i / gradientWidth)) * 0.5;
        vignette.fillStyle(COLORS.BACKGROUND.VIGNETTE, alpha);
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
      tint: COLORS.EFFECTS.DUST,
      alpha: { start: 0.5, end: 0 }
    });

    // Store particles for later use
    this.dustParticles = particles;
  }

  setupMultiplayerHandlers() {
    if (!this.networkManager || !this.isMultiplayer) return;
    
    console.log("Setting up multiplayer handlers...");
    console.log("Current remotePlayers count:", this.remotePlayers.size);
    
    // Set up event listeners
    this.networkManager.on("team-assigned", (data: { playerId: string; team: "red" | "blue"; roomId: string }) => {
      this.localPlayerId = data.playerId;
      
      // Create team-specific texture and update player
      const teamColor = data.team === "red" ? COLORS.TEAMS.RED.PRIMARY : COLORS.TEAMS.BLUE.PRIMARY;
      
      // Create team-colored texture
      const teamGraphics = this.add.graphics();
      teamGraphics.fillStyle(teamColor, 1);
      teamGraphics.fillRect(0, 0, 32, 48); // Back to normal size
      teamGraphics.generateTexture(`${data.team}-player`, 32, 48);
      teamGraphics.destroy();
      
      // Update player texture
      this.player.setTexture(`${data.team}-player`);
      
      // Teleport to team spawn point
      const spawnPos = getSpawnPosition(data.team);
      this.player.setPosition(spawnPos.x, spawnPos.y);
      
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
      
      // Create network quality indicator for this player
      const indicator = this.add.graphics();
      indicator.setVisible(this.showNetworkQuality);
      this.networkQualityIndicators.set(player.id, indicator);
    });
    
    this.networkManager.on("player-removed", (playerId: string) => {
      const remotePlayer = this.remotePlayers.get(playerId);
      if (remotePlayer) {
        console.log(`Removing player ${playerId}`);
        remotePlayer.destroy();
        this.remotePlayers.delete(playerId);
        console.log(`Player ${playerId} removed successfully`);
        
        // Remove network quality indicator
        const indicator = this.networkQualityIndicators.get(playerId);
        if (indicator) {
          indicator.destroy();
          this.networkQualityIndicators.delete(playerId);
        }
      }
    });
    
    this.networkManager.on("player-updated", (player: PlayerData) => {
      const remotePlayer = this.remotePlayers.get(player.id);
      if (remotePlayer) {
        remotePlayer.updateFromServer(
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
        const bulletColor = bullet.ownerTeam === "blue" ? COLORS.TEAMS.BLUE.GLOW : COLORS.TEAMS.RED.GLOW;
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
      const teamColors = getTeamColors(team);
      this.player.setTint(teamColors.GLOW);
      console.log("Already assigned to team:", team);
      
      // Teleport to team spawn point if already assigned
      const spawnPos = getSpawnPosition(team);
      this.player.setPosition(spawnPos.x, spawnPos.y);
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
    const bg = this.add.rectangle(
      GAME_CONFIG.UI.TEAM_INDICATOR.POSITION.x, 
      GAME_CONFIG.UI.TEAM_INDICATOR.POSITION.y, 
      GAME_CONFIG.UI.TEAM_INDICATOR.BG_SIZE.width, 
      GAME_CONFIG.UI.TEAM_INDICATOR.BG_SIZE.height, 
      COLORS.UI.UI_BG, 
      COLORS.UI.UI_BG_ALPHA
    );
    
    // Team indicator
    const team = this.networkManager?.getPlayerTeam();
    const teamColor = team === "red" ? "#E74C3C" : team === "blue" ? "#3498DB" : "#ffffff";
    const teamText = this.add.text(
      GAME_CONFIG.UI.TEAM_INDICATOR.POSITION.x, 
      GAME_CONFIG.UI.TEAM_INDICATOR.POSITION.y - 10, 
      `Team: ${team?.toUpperCase() || 'Unknown'}`, 
      {
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
    
    // Toggle network quality visualization with F4
    this.input.keyboard?.on('keydown-F4', () => {
      this.showNetworkQuality = !this.showNetworkQuality;
      this.networkQualityIndicators.forEach(indicator => {
        indicator.setVisible(this.showNetworkQuality);
      });
    });
  }
  
  createHealthUI() {
    // Minimalist health bar - no borders
    this.healthBarBg = this.add.rectangle(20, 20, 200, 8, COLORS.UI.HEALTH_BG);
    this.healthBarBg.setOrigin(0, 0);
    this.healthBarBg.setScrollFactor(0);
    
    // Health bar fill - gradient from green to red based on health
    this.healthBar = this.add.rectangle(20, 20, 200, 8, COLORS.UI.HEALTH_GOOD);
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
      this.healthBar.setFillStyle(COLORS.UI.HEALTH_GOOD);
    } else if (healthPercent > 0.3) {
      this.healthBar.setFillStyle(COLORS.UI.HEALTH_WARNING);
    } else {
      this.healthBar.setFillStyle(COLORS.UI.HEALTH_CRITICAL);
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
      const particle = this.add.circle(x, y, 3, COLORS.EFFECTS.HIT);
      
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
    const teamColors = getTeamColors(team as 'red' | 'blue');
    const teamColor = teamColors.GLOW;
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
      const particle = this.add.circle(x, y, 2, COLORS.EFFECTS.BULLET_IMPACT);
      
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

  update(time: number, delta: number) {
    // Guard against player not existing yet
    if (!this.player || !this.player.body) {
      return;
    }
    
    // Update player
    this.player.update(time, delta);
    
    // Update weapon system
    this.weaponSystem.update(delta);
    
    // Update network quality indicators
    if (this.showNetworkQuality) {
      this.updateNetworkQualityIndicators();
    }
    
    // Apply smooth reconciliation if we have prediction error
    if (this.predictionError.x !== 0 || this.predictionError.y !== 0) {
      const reconcileX = this.predictionError.x * this.reconciliationSpeed * (delta / 1000);
      const reconcileY = this.predictionError.y * this.reconciliationSpeed * (delta / 1000);
      
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
    
    // Update debug text
    if (this.debugText && this.debugText.visible) {
      const playerBody = this.player.body as Phaser.Physics.Arcade.Body;
      const errorMag = Math.sqrt(this.predictionError.x * this.predictionError.x + this.predictionError.y * this.predictionError.y);
      this.debugText.setText([
        `Network Debug (F3 to hide)`,
        `Player ID: ${this.localPlayerId}`,
        `Position: ${Math.round(this.player.x)}, ${Math.round(this.player.y)}`,
        `Velocity: ${Math.round(playerBody.velocity.x)}, ${Math.round(playerBody.velocity.y)}`,
        `Prediction Error: ${errorMag.toFixed(1)}px`,
        `Dash State: ${this.player.isDashing ? 'DASHING' : (this.player.getDashCooldown() > 0 ? `Cooldown: ${Math.round(this.player.getDashCooldown())}ms` : 'Ready')}`,
        `Remote Players: ${this.remotePlayers.size}`,
        `FPS: ${Math.round(this.game.loop.actualFps)}`
      ].join('\n'));
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
      const snapThreshold = this.player.isDashing || this.player.getDashCooldown() > 0 ? 300 : 100;
      
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
  
  /**
   * Update network quality visualization for remote players
   */
  private updateNetworkQualityIndicators(): void {
    this.remotePlayers.forEach((remotePlayer, playerId) => {
      const indicator = this.networkQualityIndicators.get(playerId);
      if (!indicator) return;
      
      // Clear previous drawing
      indicator.clear();
      
      // Get interpolation data from remote player
      const dx = Math.abs(remotePlayer.x - remotePlayer.getTargetX());
      const dy = Math.abs(remotePlayer.y - remotePlayer.getTargetY());
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      // Color based on prediction accuracy
      let color = 0x00FF00; // Green - good
      if (distance > 50) {
        color = 0xFFFF00; // Yellow - medium
      }
      if (distance > 100) {
        color = 0xFF0000; // Red - poor
      }
      
      // Draw indicator
      indicator.lineStyle(2, color, 0.8);
      indicator.strokeCircle(remotePlayer.x, remotePlayer.y - 70, 5);
      
      // Draw prediction line
      indicator.lineStyle(1, color, 0.4);
      indicator.beginPath();
      indicator.moveTo(remotePlayer.x, remotePlayer.y);
      indicator.lineTo(remotePlayer.getTargetX(), remotePlayer.getTargetY());
      indicator.strokePath();
    });
  }

}