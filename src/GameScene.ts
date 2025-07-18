import Phaser from 'phaser';
import { WeaponSystem } from './WeaponSystem';
import { Bullet } from './BulletPool';
import { SoundManager } from './SoundManager';
import { RemotePlayer } from './network/RemotePlayer';
import { LocalPlayer } from './entities/LocalPlayer';
import { NetworkManager, PlayerData, BulletData } from './network/NetworkManager';
import { COLORS } from './config/Colors';
import { GAME_CONFIG, getSpawnPosition, Team } from './config/GameConfig';
import { GameHUD } from './ui/GameHUD';
import { KillFeed } from './ui/KillFeed';
import { EffectsSystem } from './systems/EffectsSystem';
import { PlayerTextureManager } from './entities/PlayerTextureManager';
import { PlayerBulletInterface } from './entities/PlayerBulletInterface';
import { WorldBuilder } from './systems/WorldBuilder';

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
  private localPlayerId?: string;
  
  // UI managers
  private gameHUD!: GameHUD;
  private killFeed!: KillFeed;

  // Client-side prediction
  private lastServerPosition: { x: number; y: number } = { x: 0, y: 0 };
  private predictionError: { x: number; y: number } = { x: 0, y: 0 };
  private reconciliationSpeed: number = 0.3; // How fast to correct prediction errors
  private debugText?: Phaser.GameObjects.Text;
  
  // Game state
  private currentHealth: number = GAME_CONFIG.PLAYER.HEALTH.MAX;
  private isDead: boolean = false;
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
    
    // Initialize world builder and create world
    this.worldBuilder = new WorldBuilder(this);
    this.platforms = this.worldBuilder.buildWorld();

    // Create player - clean rectangle design with guaranteed visible texture
    
    // Create local player
    const playerId = this.localPlayerId || 'local-player';
    
    // Determine initial team - check if we already have one from NetworkManager
    let initialTeam: Team = 'red'; // Default
    let useNeutralTexture = true;
    let initialX = 100;
    let initialY = 1350;
    
    if (this.isMultiplayer && this.networkManager) {
      const assignedTeam = this.networkManager.getPlayerTeam();
      if (assignedTeam) {
        initialTeam = assignedTeam;
        useNeutralTexture = false;
        console.log("Player already has team:", assignedTeam);
      }
    } else {
      // Single-player mode: random team and position
      initialTeam = Math.random() < 0.5 ? 'red' : 'blue';
      useNeutralTexture = false; // Always have a team in single-player
      
      // Use WorldBuilder for spawn position
      const spawnPos = this.worldBuilder.getRandomSpawnPosition();
      initialX = spawnPos.x;
      initialY = spawnPos.y;
      
      console.log(`Single-player mode: Random team ${initialTeam} at position (${initialX}, ${initialY})`);
    }
    
    // Create a neutral gray texture for unassigned players (only if needed)
    if (useNeutralTexture) {
      PlayerTextureManager.getPlayerTexture(this, 'neutral');
    }
    
    this.player = new LocalPlayer(
      this,
      playerId,
      initialX,
      initialY,
      initialTeam,
      'You'
    );
    
    // Only override to neutral texture if we don't have a team yet
    if (useNeutralTexture) {
      this.player.setTexture('neutral-player');
    }
    
    // Add collision with platforms
    this.physics.add.collider(this.player, this.platforms);
    
    // Set up player event listeners
    this.setupPlayerEventListeners();

    // Setup camera to follow player
    this.worldBuilder.setupCamera(this.player);

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
      this.effectsSystem.createBulletImpactEffect(bullet.x, bullet.y);
    });

    // Setup multiplayer if connected
    if (this.isMultiplayer && this.networkManager) {
      console.log("GameScene: Setting up multiplayer connection...");
      // Set up event listeners
      this.networkManager.on("team-assigned", (data: { playerId: string; team: "red" | "blue"; roomId: string }) => {
        this.localPlayerId = data.playerId;
        
        console.log(`Team assignment received: ${data.team} (was: ${this.player.team})`);
        
        // Update player team
        this.player.team = data.team;
        
        // Get the team texture using centralized manager
        const textureKey = PlayerTextureManager.getPlayerTexture(this, data.team);
        
        // Force texture update
        this.player.setTexture(textureKey);
        this.player.setFrame(0); // Force frame refresh
        
        console.log(`Texture updated to: ${textureKey}`);
        
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
          this.gameHUD.updateScores(this.redScore, this.blueScore);
        }
      });
      
      // Listen for kill events
      this.networkManager.on("player-killed", (data: { killerId: string; victimId: string; killerName?: string; victimName?: string }) => {
        // Add to kill feed
        const killerName = data.killerName || "Player";
        const victimName = data.victimName || "Player";
        this.killFeed.addKillMessage(killerName, victimName);
        
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
          this.gameHUD.updateHealth(this.currentHealth);
          
          // Trigger hit effect if we took damage
          if (previousHealth > this.currentHealth && this.currentHealth > 0) {
            this.effectsSystem.createHitEffect(this.player.x, this.player.y);
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
            this.effectsSystem.createDeathEffect(this.player.x, this.player.y, team);
            this.soundManager.playDeath();
          } else if (!this.isDead && wasDead) {
            // Player respawned
            this.player.setAlpha(1);
            this.gameHUD.setRespawnTimer(0);
          }
        }
        
        // Update respawn timer
        if (this.isDead && serverData.respawnTimer !== undefined) {
          const seconds = Math.ceil(serverData.respawnTimer / 1000);
          this.gameHUD.setRespawnTimer(seconds);
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
        console.log("Already assigned to team:", team);
        
        // Update the player's team and texture
        this.player.team = team;
        
        // Get the team texture using centralized manager
        const textureKey = PlayerTextureManager.getPlayerTexture(this, team);
        
        // Force texture update
        this.player.setTexture(textureKey);
        console.log(`Updated texture to ${textureKey} for already assigned team ${team}`);
        
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
      
      if (this.weaponSystem.shoot(this.player.isDashing, bulletColor)) {
        this.soundManager.playShoot();
        
        // Send shoot to server if multiplayer
        if (this.isMultiplayer && this.networkManager) {
          // Use shared bullet interface for consistent positioning
          const bulletData = PlayerBulletInterface.getBulletSpawnData(
            data.x,
            data.y,
            data.direction,
            data.team as Team
          );
          
          this.networkManager.sendShoot({
            x: bulletData.x,
            y: bulletData.y,
            velocityX: bulletData.velocityX
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

  setupMultiplayerHandlers() {
    if (!this.networkManager || !this.isMultiplayer) return;
    
    console.log("Setting up multiplayer handlers...");
    console.log("Current remotePlayers count:", this.remotePlayers.size);
    
    // Set up event listeners
    this.networkManager.on("team-assigned", (data: { playerId: string; team: "red" | "blue"; roomId: string }) => {
      this.localPlayerId = data.playerId;
      
      console.log(`Team assignment received: ${data.team} (was: ${this.player.team})`);
      
      // Update player team
      this.player.team = data.team;
      
      // Get the team texture using centralized manager
      const textureKey = PlayerTextureManager.getPlayerTexture(this, data.team);
      
      // Force texture update
      this.player.setTexture(textureKey);
      this.player.setFrame(0); // Force frame refresh
      
      console.log(`Texture updated to: ${textureKey}`);
      
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
        this.gameHUD.updateScores(this.redScore, this.blueScore);
      }
    });
    
    // Listen for kill events
    this.networkManager.on("player-killed", (data: { killerId: string; victimId: string; killerName?: string; victimName?: string }) => {
      // Add to kill feed
      const killerName = data.killerName || "Player";
      const victimName = data.victimName || "Player";
      this.killFeed.addKillMessage(killerName, victimName);
      
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
        this.gameHUD.updateHealth(this.currentHealth);
        
        // Trigger hit effect if we took damage
        if (previousHealth > this.currentHealth && this.currentHealth > 0) {
          this.effectsSystem.createHitEffect(this.player.x, this.player.y);
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
          this.effectsSystem.createDeathEffect(this.player.x, this.player.y, team);
          this.soundManager.playDeath();
        } else if (!this.isDead && wasDead) {
          // Player respawned
          this.player.setAlpha(1);
          this.gameHUD.setRespawnTimer(0);
        }
      }
      
      // Update respawn timer
      if (this.isDead && serverData.respawnTimer !== undefined) {
        const seconds = Math.ceil(serverData.respawnTimer / 1000);
        this.gameHUD.setRespawnTimer(seconds);
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
      console.log("Already assigned to team:", team);
      
      // Update the player's team and texture
      this.player.team = team;
      
      // Get the team texture using centralized manager
      const textureKey = PlayerTextureManager.getPlayerTexture(this, team);
      
      // Force texture update
      this.player.setTexture(textureKey);
      console.log(`Updated texture to ${textureKey} for already assigned team ${team}`);
      
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
    // Get team
    const team = this.networkManager?.getPlayerTeam() || 'unknown';
    
    // Create multiplayer-specific UI elements
    this.gameHUD.createMultiplayerUI(team, () => this.leaveMultiplayer());
    
    // Toggle network quality visualization with F4
    this.input.keyboard?.on('keydown-F4', () => {
      this.showNetworkQuality = !this.showNetworkQuality;
      this.networkQualityIndicators.forEach(indicator => {
        indicator.setVisible(this.showNetworkQuality);
      });
    });
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
    
    // Reset player to red team and texture
    this.player.team = 'red';
    const textureKey = PlayerTextureManager.getPlayerTexture(this, 'red');
    this.player.setTexture(textureKey);
    
    // Destroy multiplayer UI
    this.gameHUD.destroy();
    this.killFeed.destroy();
    
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
    if (this.gameHUD.isDebugVisible()) {
      const playerBody = this.player.body as Phaser.Physics.Arcade.Body;
      const errorMag = Math.sqrt(this.predictionError.x * this.predictionError.x + this.predictionError.y * this.predictionError.y);
      this.gameHUD.updateDebugText([
        `Network Debug (F3 to hide)`,
        `Player ID: ${this.localPlayerId}`,
        `Position: ${Math.round(this.player.x)}, ${Math.round(this.player.y)}`,
        `Velocity: ${Math.round(playerBody.velocity.x)}, ${Math.round(playerBody.velocity.y)}`,
        `Prediction Error: ${errorMag.toFixed(1)}px`,
        `Dash State: ${this.player.isDashing ? 'DASHING' : 'Ready'}`, // TODO: Fix getDashCooldown
        `Remote Players: ${this.remotePlayers.size}`,
        `FPS: ${Math.round(this.game.loop.actualFps)}`
      ]);
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
      const snapThreshold = this.player.isDashing ? 300 : 100; // TODO: Fix getDashCooldown
      
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
              const dx = 0; // TODO: Fix getTargetX
        const dy = 0; // TODO: Fix getTargetY
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
              indicator.lineTo(remotePlayer.x, remotePlayer.y); // TODO: Fix getTargetX/Y
      indicator.strokePath();
    });
  }

}