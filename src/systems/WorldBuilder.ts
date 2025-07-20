import Phaser from 'phaser';
import { ARENA_WIDTH, ARENA_HEIGHT, MAIN_PLATFORM, ELEVATED_PLATFORMS } from '../../shared/WorldGeometry';
import { COLORS } from '../config/Colors';
import { GAME_CONFIG } from '../config/GameConfig';

/**
 * WorldBuilder - Responsible for creating and managing the game world
 * 
 * Handles:
 * - Platform creation (main floor and elevated platforms)
 * - Atmospheric background elements
 * - Vignette effects
 * - World bounds configuration
 * - Camera setup
 */
export class WorldBuilder {
  private scene: Phaser.Scene;
  private platforms: Phaser.Physics.Arcade.StaticGroup;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.platforms = this.scene.physics.add.staticGroup();
  }

  /**
   * Builds the complete game world
   * @returns The platforms group for collision detection
   */
  buildWorld(): Phaser.Physics.Arcade.StaticGroup {
    this.createPlatforms();
    this.createAtmosphericBackground();
    this.createZoneLighting(); // Add the new lighting
    this.setupWorldBounds();
    
    return this.platforms;
  }

  /**
   * Creates all platforms in the world
   */
  private createPlatforms(): void {
    // Main arena floor using shared geometry - now solid black
    const mainPlatform = this.scene.add.rectangle(
      MAIN_PLATFORM.x, 
      MAIN_PLATFORM.y, 
      MAIN_PLATFORM.width, 
      MAIN_PLATFORM.height, 
      0x000000 // Solid black
    );
    this.platforms.add(mainPlatform);

    // Set all platforms to use the lighting pipeline
    mainPlatform.setPipeline('Light2D');

    // Create elevated platforms for jumping
    this.createElevatedPlatforms();
  }

  /**
   * Creates the elevated platforms using shared geometry
   */
  private createElevatedPlatforms(): void {
    // Use shared platform definitions with solid black color
    ELEVATED_PLATFORMS.forEach(platform => {
      const rect = this.scene.add.rectangle(
        platform.x, 
        platform.y, 
        platform.width, 
        platform.height, 
        0x000000 // Solid black
      );
      rect.setPipeline('Light2D');
      this.platforms.add(rect);
    });
  }

  /**
   * Creates colored zone lighting to match the reference image
   */
  private createZoneLighting(): void {
    // A single, bright, off-screen "sun" to cast long shadows
    this.scene.lights.addLight(ARENA_WIDTH / 2, -500, 1500, 0xffffff, 3.0);
  }

  /**
   * Creates atmospheric background elements
   */
  private createAtmosphericBackground(): void {
    // Add subtle geometric patterns in the far background
    for (let i = 0; i < 10; i++) {
      const size = Phaser.Math.Between(100, 200);
      const shape = this.scene.add.rectangle(
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
      const particle = this.scene.add.circle(
        Phaser.Math.Between(0, ARENA_WIDTH),
        Phaser.Math.Between(0, ARENA_HEIGHT),
        Phaser.Math.Between(1, 3),
        COLORS.EFFECTS.PARTICLE,
        0.3
      );
      particle.setScrollFactor(0.5); // Mid parallax
      
      // Animate floating
      this.scene.tweens.add({
        targets: particle,
        y: particle.y + Phaser.Math.Between(50, 100),
        duration: Phaser.Math.Between(5000, 8000),
        ease: 'Sine.easeInOut',
        yoyo: true,
        repeat: -1,
        delay: Phaser.Math.Between(0, 2000)
      });
    }
    
    // Add vignette effect (dark edges) - DISABLED: Causes visual issues with camera
    // this.createVignetteEffect();
  }

  /**
   * Creates a vignette effect at the edges of the screen
   */
  private createVignetteEffect(): void {
    const vignette = this.scene.add.graphics();
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

  /**
   * Sets up world bounds for physics
   */
  private setupWorldBounds(): void {
    this.scene.physics.world.setBounds(0, 0, ARENA_WIDTH, ARENA_HEIGHT);
  }

  /**
   * Sets up camera bounds and following
   * @param target The game object for the camera to follow
   */
  setupCamera(target: Phaser.GameObjects.GameObject): void {
    const camera = this.scene.cameras.main;
    camera.setBounds(0, 0, ARENA_WIDTH, ARENA_HEIGHT);
    camera.startFollow(target, true, 0.1, 0.1);
    camera.setDeadzone(
      GAME_CONFIG.WORLD.CAMERA_DEADZONE.WIDTH, 
      GAME_CONFIG.WORLD.CAMERA_DEADZONE.HEIGHT
    );
  }

  /**
   * Gets a random spawn position on a platform
   * @param preferElevated Whether to prefer elevated platforms
   * @returns The spawn position
   */
  getRandomSpawnPosition(preferElevated: boolean = false): { x: number, y: number } {
    const platformChoice = Math.random();
    
    if (!preferElevated && platformChoice < 0.4) {
      // Main platform
      return {
        x: Phaser.Math.Between(100, ARENA_WIDTH - 100),
        y: MAIN_PLATFORM.y - 50
      };
    } else {
      // Pick a random elevated platform
      const randomPlatform = ELEVATED_PLATFORMS[Math.floor(Math.random() * ELEVATED_PLATFORMS.length)];
      return {
        x: Phaser.Math.Between(
          randomPlatform.x - randomPlatform.width/2 + 50,
          randomPlatform.x + randomPlatform.width/2 - 50
        ),
        y: randomPlatform.y - 50
      };
    }
  }

  /**
   * Gets the platforms group for collision detection
   */
  getPlatforms(): Phaser.Physics.Arcade.StaticGroup {
    return this.platforms;
  }
} 