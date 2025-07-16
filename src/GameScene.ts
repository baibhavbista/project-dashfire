import Phaser from 'phaser';

// Custom interfaces for better type safety
interface PlayerSprite extends Phaser.Physics.Arcade.Sprite {
  dustParticles?: Phaser.GameObjects.Particles.ParticleEmitter;
}

interface WASDKeys {
  left: Phaser.Input.Keyboard.Key;
}

export class GameScene extends Phaser.Scene {
  private player!: PlayerSprite;
  private platforms!: Phaser.Physics.Arcade.StaticGroup;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: WASDKeys;
  private jumpKey!: Phaser.Input.Keyboard.Key; // This will be D key
  private dashKey!: Phaser.Input.Keyboard.Key; // This will be S key
  private coyoteTime: number = 0;
  private readonly COYOTE_TIME_MS: number = 150; // 150ms window after leaving platform
  private canDash: boolean = true;
  private isDashing: boolean = false;
  private dashCooldown: number = 0;
  private readonly DASH_COOLDOWN_MS: number = 100; // Brief cooldown after dash
  private dashTrails: Phaser.GameObjects.Image[] = [];
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

  constructor() {
    super({ key: 'GameScene' });
  }

  preload() {
    // Create colored rectangles for platforms and player
    this.load.image('ground', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAI9jzgwTQAAAABJRU5ErkJggg==');
    this.load.image('player', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAI9jzgwTQAAAABJRU5ErkJggg==');
  }

  create() {
    // Create platforms group
    this.platforms = this.physics.add.staticGroup();

    // Create the main wide platform (arena floor)
    const arenaWidth = 3000; // 3x wider than screen width
    const arenaHeight = 100;
    const arenaY = 700;
    
    // Main arena floor
    const mainPlatform = this.add.rectangle(arenaWidth / 2, arenaY, arenaWidth, arenaHeight, 0x228B22);
    this.platforms.add(mainPlatform);

    // Create multiple elevated platforms for jumping
    this.createElevatedPlatforms();

    // Create player
    this.player = this.physics.add.sprite(100, 500, 'player');
    this.player.setDisplaySize(32, 48);
    this.player.setTint(0xFF6B6B);
    this.player.setBounce(0.1);
    this.player.setCollideWorldBounds(true); // Keep player within world bounds

    // Player physics
    (this.player.body as Phaser.Physics.Arcade.Body).setGravityY(0);
    this.physics.add.collider(this.player, this.platforms);

    // Camera setup - follow player but constrain to world bounds
    this.cameras.main.setBounds(0, 0, arenaWidth, 768);
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this.cameras.main.setDeadzone(200, 100);

    // Set world bounds
    this.physics.world.setBounds(0, 0, arenaWidth, 768);

    // Create input handlers
    if (!this.input.keyboard) {
      throw new Error('Keyboard input not available');
    }
    
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = {
      left: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A)
    };
    this.jumpKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D); // D key for jump
    this.dashKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S); // S key for dash

    // Add some visual flair
    this.createBackground();
    this.createParticles();
  }

  createElevatedPlatforms() {
    const platformData = [
      // Left side platforms
      { x: 300, y: 550, width: 200, height: 16 },
      { x: 150, y: 400, width: 150, height: 16 },
      { x: 400, y: 350, width: 180, height: 16 },
      
      // Center area - multi-level structure
      { x: 800, y: 600, width: 250, height: 16 },
      { x: 900, y: 500, width: 200, height: 16 },
      { x: 750, y: 400, width: 150, height: 16 },
      { x: 1000, y: 300, width: 180, height: 16 },
      
      // Right side platforms
      { x: 1400, y: 550, width: 200, height: 16 },
      { x: 1600, y: 450, width: 150, height: 16 },
      { x: 1350, y: 350, width: 180, height: 16 },
      
      // Far right area
      { x: 1900, y: 600, width: 220, height: 16 },
      { x: 2100, y: 500, width: 180, height: 16 },
      { x: 1800, y: 400, width: 160, height: 16 },
      
      // High platforms for advanced movement
      { x: 2300, y: 450, width: 150, height: 16 },
      { x: 2500, y: 350, width: 200, height: 16 },
      { x: 2700, y: 250, width: 180, height: 16 },
      
      // Connecting platforms
      { x: 1200, y: 450, width: 120, height: 16 },
      { x: 1700, y: 300, width: 140, height: 16 },
      { x: 2000, y: 200, width: 160, height: 16 },
    ];

    platformData.forEach(platform => {
      const rect = this.add.rectangle(platform.x, platform.y, platform.width, platform.height, 0x8B4513);
      rect.setStrokeStyle(4, 0x654321);
      this.platforms.add(rect);
    });
  }

  createBackground() {
    // Add some background elements for depth
    const cloudColors = [0xFFFFFF, 0xF0F0F0, 0xE8E8E8];
    
    for (let i = 0; i < 15; i++) {
      const cloud = this.add.circle(
        Phaser.Math.Between(0, 3000),
        Phaser.Math.Between(50, 200),
        Phaser.Math.Between(30, 60),
        cloudColors[Math.floor(Math.random() * cloudColors.length)],
        0.6
      );
      cloud.setScrollFactor(0.3); // Parallax effect
    }

    // Add distant mountains
    for (let i = 0; i < 8; i++) {
      const mountain = this.add.triangle(
        i * 400 + Phaser.Math.Between(-50, 50),
        600,
        0, 0,
        Phaser.Math.Between(150, 250), Phaser.Math.Between(150, 250),
        Phaser.Math.Between(150, 250), Phaser.Math.Between(150, 250),
        0x6B8E23,
        0.4
      );
      mountain.setScrollFactor(0.2);
    }
  }

  createParticles() {
    // Create dust particles for landing effects
    const particles = this.add.particles(0, 0, 'ground', {
      scale: { start: 0.1, end: 0.3 },
      speed: { min: 50, max: 100 },
      lifespan: 500,
      quantity: 0,
      tint: 0x8B4513,
      alpha: { start: 0.7, end: 0 }
    });

    // Store particles for later use
    this.player.dustParticles = particles;
  }

  update() {
    const maxSpeed = 300;
    const acceleration = 1200; // High acceleration for snappy movement
    const friction = 800; // Quick deceleration when not moving
    const dashPower = 800; // 2x more powerful
    
    const playerBody = this.player.body as Phaser.Physics.Arcade.Body;
    const currentVelX = playerBody.velocity.x;

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
    this.dashCooldown = 100; // Brief cooldown

    // Change player color during dash
    this.player.setTint(0x00FFFF); // Cyan color during dash

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
    this.player.setTint(0xFF6B6B); // Return to normal color
    
    // Reduce velocity slightly after dash
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    const currentVelX = body.velocity.x;
    const currentVelY = body.velocity.y;
    this.player.setVelocity(currentVelX * 0.7, currentVelY * 0.7);
    
    // Re-enable gravity after dash
    body.allowGravity = true;
    // The dynamic gravity system will take over in the next update cycle
    
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

    // Create new trail
    const trail = this.add.image(this.player.x, this.player.y, 'player');
    trail.setDisplaySize(32, 48);
    trail.setTint(0x00FFFF);
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
}