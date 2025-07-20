import Phaser from 'phaser';
import { COLORS } from '../config/Colors';
import { GAME_CONFIG } from '../config/GameConfig';
import { PlayerTextureManager } from '../entities/PlayerTextureManager';
import { AnimationController } from '../systems/AnimationController';
import { getTeamColors } from '../config/Colors';
import { VolumeControlManager } from '../ui/VolumeControlManager';

// Demo player class for menu animations
class DemoPlayer extends Phaser.Physics.Arcade.Sprite {
  public animationController: AnimationController;
  public team: 'red' | 'blue';
  private baseOriginX: number = 0.5;
  
  constructor(scene: Phaser.Scene, x: number, y: number, team: 'red' | 'blue') {
    const textureKey = PlayerTextureManager.getPlayerTexture(scene, team);
    super(scene, x, y, textureKey);
    
    this.team = team;
    
    scene.add.existing(this);
    scene.physics.add.existing(this);
    
    // Calculate origin for player body center
    const textureWidth = PlayerTextureManager.getTextureWidth();
    const playerBodyCenter = GAME_CONFIG.PLAYER.WIDTH / 2;
    this.baseOriginX = playerBodyCenter / textureWidth;
    
    this.setOrigin(this.baseOriginX, 1);
    this.setBounce(GAME_CONFIG.PLAYER.BOUNCE);
    
    // Configure physics body
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(GAME_CONFIG.PLAYER.WIDTH, GAME_CONFIG.PLAYER.HEIGHT);
    body.setOffset(0, 0);
    
    // Initialize animation controller
    this.animationController = new AnimationController(scene, this);
  }
  
  setFlipX(value: boolean): this {
    super.setFlipX(value);
    this.updateDynamicOrigin();
    return this;
  }
  
  private updateDynamicOrigin(): void {
    const textureWidth = PlayerTextureManager.getTextureWidth();
    const gunWidth = textureWidth - GAME_CONFIG.PLAYER.WIDTH;
    const body = this.body as Phaser.Physics.Arcade.Body;
    
    if (this.flipX) {
      const originX = this.baseOriginX + (gunWidth / textureWidth);
      this.setOrigin(originX, 1);
      body.setOffset(gunWidth, 0);
    } else {
      this.setOrigin(this.baseOriginX, 1);
      body.setOffset(0, 0);
    }
  }
}

export class MainMenuScene extends Phaser.Scene {
  private projectText!: Phaser.GameObjects.Text;
  private dashfireText!: Phaser.GameObjects.Text;
  private practiceButton!: Phaser.GameObjects.Rectangle;
  private practiceButtonText!: Phaser.GameObjects.Text;
  private multiplayerButton!: Phaser.GameObjects.Rectangle;
  private multiplayerButtonText!: Phaser.GameObjects.Text;
  private aboutButton!: Phaser.GameObjects.Rectangle;
  private aboutButtonText!: Phaser.GameObjects.Text;
  private demoPlayers: DemoPlayer[] = [];
  private platforms: Phaser.Physics.Arcade.StaticGroup;
  private modalContainer?: Phaser.GameObjects.Container;
  private volumeControlManager!: VolumeControlManager;
  private musicStarted: boolean = false;
  private clickToStartText?: Phaser.GameObjects.Text;
  
  constructor() {
    super({ key: 'MainMenuScene' });
    this.platforms = null!;
  }
  
  init() {
    // Reset music state
    this.musicStarted = false;
  }
  
  preload() {
    // Create white texture for effects
    this.load.image('white-pixel', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==');
    
    // Load menu music - try without streaming to see if it loads faster
    this.load.audio('menu-music', 'audio/music/main-menu.mp3');
    

  }
  
  create() {
    // Get screen dimensions
    const { width, height } = this.cameras.main;
    const centerX = width / 2;
    const centerY = height / 2;
    
    // Handle audio unlock - browser requires interaction every session
    if (this.sound.locked) {
      
      // Create "Click to Start" text
      this.clickToStartText = this.add.text(centerX, height - 50, 'Click anywhere for music', {
        fontSize: '24px',
        fontFamily: GAME_CONFIG.UI.FONT.FAMILY,
        color: '#ffffff',
        backgroundColor: '#000000',
        padding: { x: 20, y: 10 }
      });
      this.clickToStartText.setOrigin(0.5);
      this.clickToStartText.setAlpha(0.8);
      this.clickToStartText.setDepth(1000);
      
      // Pulse animation
      this.tweens.add({
        targets: this.clickToStartText,
        alpha: 0.4,
        duration: 1000,
        ease: 'Sine.easeInOut',
        yoyo: true,
        repeat: -1
      });
      
      // Wait for user interaction
      this.input.once('pointerdown', () => {
        
        // Unlock audio
        if (this.sound.locked) {
          this.sound.unlock();
        }
        
        // Remove click to start text
        if (this.clickToStartText) {
          this.tweens.killTweensOf(this.clickToStartText);
          this.clickToStartText.destroy();
          this.clickToStartText = undefined;
        }
        
        // Start music
        this.startMenuMusic();
      });
    } else {
      // Audio already unlocked, start music immediately
      this.startMenuMusic();
    }
    
    // Set deep blue background
    this.cameras.main.setBackgroundColor(0x1B2C59);
    
    // Set physics to match game settings
    this.physics.world.gravity.y = 1800;
    
    // Create atmospheric background elements first
    this.createAtmosphericBackground();
    
    // Create platforms for demo players
    this.platforms = this.physics.add.staticGroup();
    
    // Create white texture for effects
    const graphics = this.add.graphics();
    graphics.fillStyle(0xFFFFFF, 1);
    graphics.fillRect(0, 0, 1, 1);
    graphics.generateTexture('white-rect', 1, 1);
    graphics.destroy();
    
    // Create title split into two lines - reduced gap and larger DASHFIRE
    this.projectText = this.add.text(centerX, centerY - height * 0.15, 'PROJECT', {
      fontSize: '56px',
      fontFamily: GAME_CONFIG.UI.FONT.FAMILY,
      color: COLORS.UI.TEXT_PRIMARY,
      fontStyle: 'bold'
    }).setOrigin(0.5);
    
    this.dashfireText = this.add.text(centerX, centerY - height * 0.07, 'DASHFIRE', {
      fontSize: '96px',  // Larger than PROJECT
      fontFamily: GAME_CONFIG.UI.FONT.FAMILY,
      color: '#E74C3C', // Red color for DASHFIRE
      fontStyle: 'bold'
    }).setOrigin(0.5);
    
    // Create buttons with styling
    const buttonWidth = Math.min(350, width * 0.35);
    const buttonHeight = 60;
    const buttonSpacing = 20;
    const buttonsY = centerY + height * 0.05;
    const buttonColor = 0x2A3F5F; // Darker blue-gray for better contrast
    
    // Practice button
    this.practiceButton = this.add.rectangle(
      centerX,
      buttonsY,
      buttonWidth,
      buttonHeight,
      buttonColor
    ).setInteractive();
    
    this.practiceButtonText = this.add.text(centerX, buttonsY, 'PRACTICE', {
      fontSize: '28px',
      fontFamily: GAME_CONFIG.UI.FONT.FAMILY,
      color: COLORS.UI.TEXT_PRIMARY,
      fontStyle: 'bold'
    }).setOrigin(0.5);
    
    // Play with friends button
    this.multiplayerButton = this.add.rectangle(
      centerX,
      buttonsY + buttonHeight + buttonSpacing,
      buttonWidth,
      buttonHeight,
      buttonColor
    ).setInteractive();
    
    this.multiplayerButtonText = this.add.text(
      centerX,
      buttonsY + buttonHeight + buttonSpacing,
      'PLAY WITH FRIENDS',
      {
        fontSize: '28px',
        fontFamily: GAME_CONFIG.UI.FONT.FAMILY,
        color: COLORS.UI.TEXT_PRIMARY,
        fontStyle: 'bold'
      }
    ).setOrigin(0.5);
    
    // About game button
    this.aboutButton = this.add.rectangle(
      centerX,
      buttonsY + (buttonHeight + buttonSpacing) * 2,
      buttonWidth,
      buttonHeight,
      buttonColor
    ).setInteractive();
    
    this.aboutButtonText = this.add.text(
      centerX,
      buttonsY + (buttonHeight + buttonSpacing) * 2,
      'ABOUT GAME',
      {
        fontSize: '28px',
        fontFamily: GAME_CONFIG.UI.FONT.FAMILY,
        color: COLORS.UI.TEXT_PRIMARY,
        fontStyle: 'bold'
      }
    ).setOrigin(0.5);
    
    // Add hover effects
    this.setupButtonInteractions();
    
    // Add demo players performing various actions
    this.createDemoPlayers();
    
    // Handle resize events
    this.scale.on('resize', this.resize, this);
    
    // Initialize volume control manager
    this.volumeControlManager = new VolumeControlManager(this);
    this.volumeControlManager.createSoundButton();
  }
  
  private resize(gameSize: Phaser.Structs.Size): void {
    const width = gameSize.width;
    const height = gameSize.height;
    
    this.cameras.resize(width, height);
  }
  
  private startMenuMusic(): void {
    // Prevent multiple attempts to start music
    if (this.musicStarted) {
      return;
    }
    
    // Check if we already have music playing
    const currentMusic = this.sound.getAllPlaying();
    const isMenuMusicPlaying = currentMusic.some(sound => sound.key === 'menu-music');
    
    if (!isMenuMusicPlaying && this.cache.audio.exists('menu-music')) {
      this.musicStarted = true;
      
      // Stop any other music that might be playing
      this.sound.stopAll();
      
      // Get volume from localStorage
      const musicVolume = parseFloat(localStorage.getItem('musicVolume') || '0.25');
      
      // Try to play menu music
      try {
        const music = this.sound.play('menu-music', {
          loop: true,
          volume: musicVolume
        });
        
        if (!music) {
          console.error('Failed to play menu music');
          this.musicStarted = false;
        }
      } catch (error) {
        console.error('Error playing menu music:', error);
        this.musicStarted = false;
      }
          }
  }
  
  private setupButtonInteractions(): void {
    // Practice button interactions
    this.practiceButton
      .on('pointerover', () => {
        this.practiceButton.setFillStyle(0x3A5578);
        this.practiceButton.setScale(1.02);
        this.practiceButtonText.setScale(1.02);
      })
      .on('pointerout', () => {
        this.practiceButton.setFillStyle(0x2A3F5F);
        this.practiceButton.setScale(1);
        this.practiceButtonText.setScale(1);
      })
      .on('pointerdown', () => {
        this.startSoloGame();
      });
    
    // Multiplayer button interactions
    this.multiplayerButton
      .on('pointerover', () => {
        this.multiplayerButton.setFillStyle(0x3A5578);
        this.multiplayerButton.setScale(1.02);
        this.multiplayerButtonText.setScale(1.02);
      })
      .on('pointerout', () => {
        this.multiplayerButton.setFillStyle(0x2A3F5F);
        this.multiplayerButton.setScale(1);
        this.multiplayerButtonText.setScale(1);
      })
      .on('pointerdown', () => {
        this.startMultiplayerLobby();
      });
    
    // About button interactions
    this.aboutButton
      .on('pointerover', () => {
        this.aboutButton.setFillStyle(0x3A5578);
        this.aboutButton.setScale(1.02);
        this.aboutButtonText.setScale(1.02);
      })
      .on('pointerout', () => {
        this.aboutButton.setFillStyle(0x2A3F5F);
        this.aboutButton.setScale(1);
        this.aboutButtonText.setScale(1);
      })
      .on('pointerdown', () => {
        this.showAboutModal();
      });
  }
  
  private createDemoPlayers(): void {
    const { width, height } = this.cameras.main;
    
    // Create platforms at different positions
    const platformY = height * 0.85;

    const platformLeftY = height * 0.45;

    const platformHeight = 20;
    const platformColor = 0x2A3F5F;
    
    // Left area - jumping player
    const leftX = width * 0.15;
    this.platforms.create(leftX, platformLeftY, 'white-rect')
      .setDisplaySize(150, platformHeight)
      .setTint(platformColor)
      .refreshBody();
    
    // Mid-left area - running player
    const midLeftX = width * 0.3;
    this.platforms.create(midLeftX, platformY, 'white-rect')
      .setDisplaySize(250, platformHeight)
      .setTint(platformColor)
      .refreshBody();
    
    // Mid-right area - dashing player platforms
    const midRightX = width * 0.6;
    this.platforms.create(midRightX, platformY, 'white-rect')
      .setDisplaySize(100, platformHeight)
      .setTint(platformColor)
      .refreshBody();
    
    this.platforms.create(midRightX + 350, platformY - 400, 'white-rect')
      .setDisplaySize(250, platformHeight)
      .setTint(platformColor)
      .refreshBody();
    
    // Right area - shooting player
    const rightX = width * 0.85;
    this.platforms.create(rightX, platformY, 'white-rect')
      .setDisplaySize(150, platformHeight)
      .setTint(platformColor)
      .refreshBody();
    
    // Create demo players
    this.createJumpingPlayer(leftX, platformLeftY - 30);
    this.createRunningPlayer(midLeftX, platformY - 30);
    this.createDashingPlayer(midRightX, platformY - 30);
    this.createShootingPlayer(rightX, platformLeftY - 30);
  }
  
  private createJumpingPlayer(x: number, y: number): void {
    const player = new DemoPlayer(this, x, y, 'blue');
    this.physics.add.collider(player, this.platforms);
    this.demoPlayers.push(player);
    
    // Jump repeatedly
    this.time.addEvent({
      delay: 3000,
      callback: () => {
        const body = player.body as Phaser.Physics.Arcade.Body;
        if (body.blocked.down) {
          // Create jump animation with anticipation
          const animSystem = player.animationController.getAnimationSystem();
          animSystem.createAnticipatedJump(
            player,
            body,
            player.animationController.getState(),
            () => {
              // Jump happened
            }
          );
        }
      },
      loop: true
    });
  }
  
  private createRunningPlayer(x: number, y: number): void {
    const player = new DemoPlayer(this, x, y, 'red');
    this.physics.add.collider(player, this.platforms);
    this.demoPlayers.push(player);
    
    let direction = 1;
    const speed = 150;
    
    // Run back and forth
    this.time.addEvent({
      delay: 30,
      callback: () => {
        const body = player.body as Phaser.Physics.Arcade.Body;
        
        // Change direction at edges
        if (player.x > x + 80) {
          direction = -1;
          player.setFlipX(true);
        } else if (player.x < x - 80) {
          direction = 1;
          player.setFlipX(false);
        }
        
        body.setVelocityX(speed * direction);
      },
      loop: true
    });
  }
  
  private createDashingPlayer(x: number, y: number): void {
    const player = new DemoPlayer(this, x, y, 'blue');
    this.physics.add.collider(player, this.platforms);
    this.demoPlayers.push(player);
    
    let phase = 0;
    
    // Complex jump and dash sequence
    this.time.addEvent({
      delay: 4000,
      callback: () => {
        const body = player.body as Phaser.Physics.Arcade.Body;
        
        if (phase === 0 && body.blocked.down) {
          // Jump
          body.setVelocityY(-GAME_CONFIG.PLAYER.JUMP_POWER);
          player.setFlipX(false);
          phase = 1;
          
          // Wait then dash
          this.time.delayedCall(600, () => {
            if (phase === 1) {
              // Dash right and up
              const dashPower = GAME_CONFIG.PLAYER.DASH.POWER;
              body.setVelocity(dashPower * 0.707, -dashPower * 0.707); // 45 degree angle
              body.setAllowGravity(false);
              
              // Create dash effect
              player.animationController.getState().isDashing = true;
              this.createDashTrailEffect(player);
              
              phase = 2;
              
              // End dash
              this.time.delayedCall(GAME_CONFIG.PLAYER.DASH.DURATION, () => {
                // Reduce velocity like the actual game does
                body.setVelocity(body.velocity.x * 0.9, body.velocity.y * 0.9);
                body.setAllowGravity(true);
                player.animationController.getState().isDashing = false;
              });
            }
          });
        } else if (phase === 2 && body.blocked.down && player.x > x + 150) {
          // Return jump (smaller jump, just enough to get back)
          body.setVelocityY(-GAME_CONFIG.PLAYER.JUMP_POWER);
          body.setVelocityX(-250); // Add some leftward velocity
          player.setFlipX(true);
          phase = 3;
          
          // Wait for landing then reset
          this.time.addEvent({
            delay: 100,
            callback: () => {
              if (phase === 3 && body.blocked.down) {
                phase = 0;
                // Reset position after a short delay
                this.time.delayedCall(500, () => {
                  player.setX(x);
                  player.setFlipX(false);
                });
              }
            },
            repeat: 20 // Check for landing for up to 2 seconds
          });
        }
      },
      loop: true
    });
  }
  
  private createShootingPlayer(x: number, y: number): void {
    const player = new DemoPlayer(this, x, y, 'red');
    this.physics.add.collider(player, this.platforms);
    this.demoPlayers.push(player);
    
    // Shoot periodically
    this.time.addEvent({
      delay: 1500,
      callback: () => {
        this.createBulletEffect(player);
      },
      loop: true
    });
  }
  
  private createBulletEffect(player: DemoPlayer): void {
    const direction = player.flipX ? -1 : 1;
    const gunXOffset = PlayerTextureManager.getGunTipOffset();
    const gunYOffset = PlayerTextureManager.getGunYOffset();
    
    const bulletX = direction < 0 
      ? player.x - gunXOffset
      : player.x + gunXOffset;
    
    const bulletY = player.y - gunYOffset;
    
    const teamColors = getTeamColors(player.team);
    const bullet = this.add.rectangle(bulletX, bulletY, 10, 6, teamColors.GLOW);
    
    // Animate bullet
    this.tweens.add({
      targets: bullet,
      x: bullet.x + (direction * 400),
      duration: 800,
      onComplete: () => bullet.destroy()
    });
  }
  
  private createDashTrailEffect(player: DemoPlayer): void {
    // Create multiple trails during dash
    let trailCount = 0;
    const trailInterval = this.time.addEvent({
      delay: 20,
      callback: () => {
        if (trailCount < 5) {
          player.animationController.createDashTrail();
          trailCount++;
        } else {
          trailInterval.remove();
        }
      },
      loop: true
    });
  }
  
  update(_time: number, delta: number): void {
    // Try to start music if it hasn't started yet
    if (!this.musicStarted && !this.sound.locked && this.cache.audio.exists('menu-music')) {
      this.startMenuMusic();
    }
    
    // Update all demo players
    this.demoPlayers.forEach(player => {
      const body = player.body as Phaser.Physics.Arcade.Body;
      
      // Apply basic friction when on ground and not dashing
      if (body.blocked.down && !player.animationController.getState().isDashing) {
        const friction = GAME_CONFIG.PLAYER.FRICTION;
        const currentVelX = body.velocity.x;
        const dt = delta / 1000;
        
        if (Math.abs(currentVelX) > 10) {
          const frictionForce = friction * dt;
          if (currentVelX > 0) {
            body.setVelocityX(Math.max(0, currentVelX - frictionForce));
          } else {
            body.setVelocityX(Math.min(0, currentVelX + frictionForce));
          }
        } else {
          body.setVelocityX(0);
        }
      }
      
      player.animationController.update(
        body.velocity.x,
        body.velocity.y,
        body.blocked.down,
        player.animationController.getState().isDashing,
        delta
      );
    });
  }
  
  /**
   * Creates atmospheric background elements similar to the game
   */
  private createAtmosphericBackground(): void {
    const { width, height } = this.cameras.main;
    
    // Add subtle geometric patterns in the far background
    for (let i = 0; i < 10; i++) {
      const size = Phaser.Math.Between(100, 200);
      const shape = this.add.rectangle(
        Phaser.Math.Between(0, width),
        Phaser.Math.Between(100, height - 200),
        size,
        size,
        0xffffff,
        0.05
      );
      shape.setScrollFactor(0.2); // Far parallax
      shape.setAngle(Phaser.Math.Between(0, 45));
      shape.setDepth(-1); // Ensure it's above background but below everything else
    }

    // Add floating ambient particles
    for (let i = 0; i < 20; i++) {
      const particle = this.add.circle(
        Phaser.Math.Between(0, width),
        Phaser.Math.Between(0, height),
        Phaser.Math.Between(10, 20),
        0xffffff,
        0.05
      );
      particle.setScrollFactor(0.5); // Mid parallax
      particle.setDepth(-1); // Ensure it's above background but below everything else
      
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
  }
  
  private startSoloGame(): void {
    // Clear multiplayer settings
    this.game.registry.set('networkManager', null);
    this.game.registry.set('isMultiplayer', false);
    
    // Transition to game
    this.cameras.main.fadeOut(250, 0, 0, 0);
    this.time.delayedCall(250, () => {
      this.scene.start('GameScene');
    });
  }
  
  private startMultiplayerLobby(): void {
    // Transition to lobby
    this.cameras.main.fadeOut(250, 0, 0, 0);
    this.time.delayedCall(250, () => {
      this.scene.start('LobbyScene');
    });
  }
  
  private showAboutModal(): void {
    const { width, height } = this.cameras.main;
    const centerX = width / 2;
    const centerY = height / 2;
    
    // Create modal container
    this.modalContainer = this.add.container(0, 0);
    this.modalContainer.setDepth(1000);
    
    // Create dark overlay
    const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.7);
    overlay.setOrigin(0);
    overlay.setInteractive();
    overlay.on('pointerdown', () => this.closeModal());
    
    // Create modal background
    const modalWidth = Math.min(650, width * 0.8);
    const modalHeight = Math.min(500, height * 0.8);
    const modalBg = this.add.rectangle(centerX, centerY, modalWidth, modalHeight, 0x2A3F5F);
    modalBg.setStrokeStyle(2, 0xffffff);
    
    // Modal title
    const title = this.add.text(centerX, centerY - modalHeight/2 + 50, 'ABOUT DASHFIRE', {
      fontSize: '36px',
      fontFamily: GAME_CONFIG.UI.FONT.FAMILY,
      color: COLORS.UI.TEXT_PRIMARY,
      fontStyle: 'bold'
    }).setOrigin(0.5);
    
    // Lorem ipsum content
    const loremText = `A game (mostly) vibe-coded by @baibhavbista during 
    GauntletAI Week 5
    
    The character and visual style were heavily inspired by the game "Thomas Was Alone"
    
    Platform mechanics (and dash!) inspired by the game "Celeste"
    
    All music in the game was AI-generated using suno.com`;
    
    const content = this.add.text(centerX, centerY, loremText, {
      fontSize: '18px',
      fontFamily: GAME_CONFIG.UI.FONT.FAMILY,
      color: COLORS.UI.TEXT_PRIMARY,
      wordWrap: { width: modalWidth - 80 },
      align: 'center',
      lineSpacing: 8
    }).setOrigin(0.5);
    
    // Close button
    const closeButton = this.add.rectangle(centerX, centerY + modalHeight/2 - 60, 120, 40, 0x3A5578);
    closeButton.setInteractive();
    closeButton.setStrokeStyle(2, 0xffffff);
    
    const closeText = this.add.text(centerX, centerY + modalHeight/2 - 60, 'CLOSE', {
      fontSize: '20px',
      fontFamily: GAME_CONFIG.UI.FONT.FAMILY,
      color: COLORS.UI.TEXT_PRIMARY,
      fontStyle: 'bold'
    }).setOrigin(0.5);
    
    // Close button interactions
    closeButton
      .on('pointerover', () => {
        closeButton.setFillStyle(0x4A6588);
        closeButton.setScale(1.05);
        closeText.setScale(1.05);
      })
      .on('pointerout', () => {
        closeButton.setFillStyle(0x3A5578);
        closeButton.setScale(1);
        closeText.setScale(1);
      })
      .on('pointerdown', () => this.closeModal());
    
    // Add all elements to container
    this.modalContainer.add([overlay, modalBg, title, content, closeButton, closeText]);
    
    // Fade in animation
    this.modalContainer.setAlpha(0);
    this.tweens.add({
      targets: this.modalContainer,
      alpha: 1,
      duration: 200,
      ease: 'Power2'
    });
  }
  
  private closeModal(): void {
    if (this.modalContainer) {
      this.tweens.add({
        targets: this.modalContainer,
        alpha: 0,
        duration: 200,
        ease: 'Power2',
        onComplete: () => {
          this.modalContainer?.destroy();
          this.modalContainer = undefined;
        }
      });
    }
  }
  
  shutdown() {
    // Clean up demo players
    this.demoPlayers.forEach(player => {
      player.animationController.destroy();
      player.destroy();
    });
    this.demoPlayers = [];
    
    // Clean up UI elements
    this.volumeControlManager?.destroy();
    this.clickToStartText?.destroy();
    
    // Remove resize listener
    this.scale.off('resize', this.resize, this);
  }
} 