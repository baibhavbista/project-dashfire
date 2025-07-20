import Phaser from 'phaser';
import { COLORS } from '../config/Colors';
import { GameScene } from '../GameScene';

export class InGameMenu extends Phaser.GameObjects.Container {
  private gameScene: GameScene;
  private overlay!: Phaser.GameObjects.Rectangle;
  private panel!: Phaser.GameObjects.Rectangle;
  private titleText!: Phaser.GameObjects.Text;
  private continueButtonBg!: Phaser.GameObjects.Rectangle;
  private continueButtonText!: Phaser.GameObjects.Text;
  private quitButtonBg!: Phaser.GameObjects.Rectangle;
  private quitButtonText!: Phaser.GameObjects.Text;
  private controlsContainer!: Phaser.GameObjects.Container;
  private isVisible: boolean = false;
  private escListener!: () => void;
  
  constructor(scene: GameScene) {
    super(scene, 0, 0);
    this.gameScene = scene;
    
    // Position the container at the center of the screen
    const { width, height } = this.gameScene.cameras.main;
    this.setPosition(width / 2, height / 2);
    
    // Create the menu elements in the correct order
    this.createOverlay();
    this.createPanel();
    this.createTitle();
    this.createButtons();
    this.createControlsDisplay();
    
    // Add to scene and set up
    this.gameScene.add.existing(this);
    this.setScrollFactor(0, 0); // Fixed to camera
    this.setDepth(1000); // Above everything else
    
    // Start hidden
    this.setVisible(false);
    this.isVisible = false;
    
    // Set up ESC key listener for closing
    this.escListener = () => {
      if (this.isVisible) {
        this.hide();
      }
    };
    this.gameScene.input.keyboard?.on('keydown-ESC', this.escListener);
  }
  
  private createOverlay(): void {
    // Semi-transparent dark overlay - positioned relative to container center
    const { width, height } = this.gameScene.cameras.main;
    this.overlay = this.gameScene.add.rectangle(
      0,  // Relative to container
      0,  // Relative to container
      width,
      height,
      0x000000,
      0.7
    );
    this.overlay.setScrollFactor(0, 0);
    // IMPORTANT: Make the overlay interactive to catch clicks, but don't add any handlers
    // This prevents clicks from going through to the game world
    this.overlay.setInteractive();
    this.add(this.overlay);
  }
  
  private createPanel(): void {
    const panelWidth = 400;
    const panelHeight = 450;
    
    // Main panel background - positioned at container center (0, 0)
    this.panel = this.gameScene.add.rectangle(
      0,  // Relative to container
      0,  // Relative to container
      panelWidth,
      panelHeight,
      COLORS.UI.PANEL_BG,
      0.95
    );
    this.panel.setStrokeStyle(2, COLORS.UI.PANEL_BORDER);
    this.panel.setScrollFactor(0, 0);
    this.add(this.panel);
  }
  
  private createTitle(): void {
    // Position relative to container center
    this.titleText = this.gameScene.add.text(
      0,  // Relative to container
      -180,  // Above the panel
      'GAME MENU',
      {
        fontFamily: 'Arial',
        fontSize: '32px',
        color: '#FFFFFF'
      }
    );
    this.titleText.setOrigin(0.5);
    this.titleText.setScrollFactor(0, 0);
    this.add(this.titleText);
  }
  
  private createButtons(): void {
    // Continue button
    this.continueButtonBg = this.gameScene.add.rectangle(0, -100, 200, 50, COLORS.UI.BUTTON_BG);
    this.continueButtonBg.setStrokeStyle(2, COLORS.UI.BUTTON_BORDER);
    this.continueButtonBg.setScrollFactor(0, 0);
    
    this.continueButtonText = this.gameScene.add.text(0, -100, 'CONTINUE', {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: '#FFFFFF'
    });
    this.continueButtonText.setOrigin(0.5);
    this.continueButtonText.setScrollFactor(0, 0);
    
    // Make continue button interactive
    this.continueButtonBg.setInteractive({ useHandCursor: true })
      .on('pointerover', () => {
        this.continueButtonBg.setFillStyle(COLORS.UI.BUTTON_HOVER);
      })
      .on('pointerout', () => {
        this.continueButtonBg.setFillStyle(COLORS.UI.BUTTON_BG);
      })
      .on('pointerdown', () => {
        this.hide();
      });
    
    this.add([this.continueButtonBg, this.continueButtonText]);
    
    // Quit button
    this.quitButtonBg = this.gameScene.add.rectangle(0, -40, 200, 50, COLORS.UI.BUTTON_BG);
    this.quitButtonBg.setStrokeStyle(2, COLORS.UI.BUTTON_BORDER);
    this.quitButtonBg.setScrollFactor(0, 0);
    
    this.quitButtonText = this.gameScene.add.text(0, -40, 'QUIT GAME', {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: '#FFFFFF'
    });
    this.quitButtonText.setOrigin(0.5);
    this.quitButtonText.setScrollFactor(0, 0);
    
    // Make quit button interactive
    this.quitButtonBg.setInteractive({ useHandCursor: true })
      .on('pointerover', () => {
        this.quitButtonBg.setFillStyle(COLORS.UI.BUTTON_HOVER);
      })
      .on('pointerout', () => {
        this.quitButtonBg.setFillStyle(COLORS.UI.BUTTON_BG);
      })
      .on('pointerdown', () => {
        this.quitToMenu();
      });
    
    this.add([this.quitButtonBg, this.quitButtonText]);
  }
  
  private createControlsDisplay(): void {
    // Position relative to container center
    const startY = 40;  // Below the buttons
    
    this.controlsContainer = this.gameScene.add.container(0, startY);
    
    // Controls title
    const controlsTitle = this.gameScene.add.text(0, 0, 'CONTROLS', {
      fontFamily: 'Arial',
      fontSize: '24px',
      color: '#FFFFFF',
      fontStyle: 'bold'
    });
    controlsTitle.setOrigin(0.5);
    this.controlsContainer.add(controlsTitle);
    
    // Control entries
    const controls = [
      { key: 'Arrow Keys', action: 'Move' },
      { key: 'D', action: 'Jump' },
      { key: 'S', action: 'Dash (air & ground)' },
      { key: 'A', action: 'Shoot' },
      { key: 'ESC', action: 'Open/Close Menu' }
    ];
    
    let yOffset = 30;
    controls.forEach(control => {
      // Key label (left side)
      const keyText = this.gameScene.add.text(-100, yOffset, control.key, {
        fontFamily: 'Arial',
        fontSize: '16px',
        color: COLORS.UI.TEXT_SECONDARY
      });
      keyText.setOrigin(1, 0.5);
      this.controlsContainer.add(keyText);
      
      // Separator
      const separator = this.gameScene.add.text(-90, yOffset, ':', {
        fontFamily: 'Arial',
        fontSize: '16px',
        color: COLORS.UI.TEXT_SECONDARY
      });
      separator.setOrigin(0, 0.5);
      this.controlsContainer.add(separator);
      
      // Action label (right side)
      const actionText = this.gameScene.add.text(-80, yOffset, control.action, {
        fontFamily: 'Arial',
        fontSize: '16px',
        color: '#FFFFFF'
      });
      actionText.setOrigin(0, 0.5);
      this.controlsContainer.add(actionText);
      
      yOffset += 25;
    });
    
    this.controlsContainer.setScrollFactor(0, 0);
    this.add(this.controlsContainer);
  }
  
  public show(): void {
    this.isVisible = true;
    this.setVisible(true);
    
    // Ensure the scene input is active
    this.gameScene.input.enabled = true;
    
    // Bring this container to the top
    this.gameScene.children.bringToTop(this);
    
    // Force refresh the interactive objects
    this.gameScene.input.setTopOnly(false);
    
    // Fade in animation
    this.setAlpha(0);
    this.gameScene.tweens.add({
      targets: this,
      alpha: 1,
      duration: 200,
      ease: 'Power2'
    });
  }
  
  public hide(): void {
    // Update state immediately
    this.isVisible = false;
    this.gameScene.setInGameMenuOpen(false);
    
    // Fade out animation
    this.gameScene.tweens.add({
      targets: this,
      alpha: 0,
      duration: 200,
      ease: 'Power2',
      onComplete: () => {
        this.setVisible(false);
      }
    });
  }
  
  private quitToMenu(): void {
    // Disconnect from multiplayer if connected
    const networkManager = this.gameScene.game.registry.get('networkManager');
    if (networkManager && networkManager.getRoom()) {
      networkManager.disconnect();
    }
    
    // Clear registry
    this.gameScene.game.registry.set('networkManager', null);
    this.gameScene.game.registry.set('isMultiplayer', false);
    
    // Stop all sounds from the game scene
    this.gameScene.sound.stopAll();
    
    // Transition to main menu (scene.start automatically stops the current scene)
    this.gameScene.scene.start('MainMenuScene');
  }
  
  public getIsVisible(): boolean {
    return this.isVisible;
  }
  
  public destroy(): void {
    // Ensure menu state is reset
    if (this.isVisible) {
      this.gameScene.setInGameMenuOpen(false);
    }
    
    // Remove ESC listener
    if (this.escListener) {
      this.gameScene.input.keyboard?.off('keydown-ESC', this.escListener);
    }
    super.destroy();
  }
} 