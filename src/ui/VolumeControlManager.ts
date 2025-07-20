import Phaser from 'phaser';
import { COLORS } from '../config/Colors';
import { GAME_CONFIG } from '../config/GameConfig';

/**
 * Reusable volume control manager for sound settings
 * Can be used in any scene to add volume controls
 */
export class VolumeControlManager {
  private scene: Phaser.Scene;
  private soundButton?: Phaser.GameObjects.Container;
  private volumeModal?: Phaser.GameObjects.Container;
  
  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }
  
  /**
   * Create sound button at specified position
   */
  createSoundButton(x?: number, y?: number): void {
    const { width, height } = this.scene.cameras.main;
    const buttonX = x ?? width - 60;
    const buttonY = y ?? height - 60;
    
    // Create container for sound button
    this.soundButton = this.scene.add.container(buttonX, buttonY);
    this.soundButton.setScrollFactor(0);
    this.soundButton.setDepth(100);
    
    // Create button background
    const buttonBg = this.scene.add.circle(0, 0, 25, 0x2A3F5F);
    buttonBg.setInteractive();
    buttonBg.setAlpha(0.8);
    
    // Create speaker icon using graphics
    const iconGraphics = this.scene.add.graphics();
    
    // Draw speaker shape
    iconGraphics.fillStyle(0xffffff, 1);
    
    // Speaker body (trapezoid) - moved left by 3 pixels
    iconGraphics.beginPath();
    iconGraphics.moveTo(-11, -4);
    iconGraphics.lineTo(-7, -4);
    iconGraphics.lineTo(-7, 4);
    iconGraphics.lineTo(-11, 4);
    iconGraphics.closePath();
    iconGraphics.fillPath();
    
    // Speaker cone - moved left by 3 pixels
    iconGraphics.beginPath();
    iconGraphics.moveTo(-7, -6);
    iconGraphics.lineTo(1, -10);
    iconGraphics.lineTo(1, 10);
    iconGraphics.lineTo(-7, 6);
    iconGraphics.closePath();
    iconGraphics.fillPath();
    
    // Sound waves - moved left by 3 pixels
    iconGraphics.lineStyle(2, 0xffffff, 0.8);
    iconGraphics.beginPath();
    iconGraphics.arc(3, 0, 4, -Math.PI/3, Math.PI/3, false);
    iconGraphics.strokePath();
    
    iconGraphics.beginPath();
    iconGraphics.arc(3, 0, 8, -Math.PI/3, Math.PI/3, false);
    iconGraphics.strokePath();
    
    this.soundButton.add([buttonBg, iconGraphics]);
    
    // Add hover effects
    buttonBg.on('pointerover', () => {
      buttonBg.setScale(1.1);
      buttonBg.setAlpha(1);
    });
    
    buttonBg.on('pointerout', () => {
      buttonBg.setScale(1);
      buttonBg.setAlpha(0.8);
    });
    
    buttonBg.on('pointerdown', () => {
      this.showVolumeModal();
    });
    
    // Handle screen resize
    this.scene.scale.on('resize', (gameSize: Phaser.Structs.Size) => {
      const newX = x ?? gameSize.width - 60;
      const newY = y ?? gameSize.height - 60;
      this.soundButton?.setPosition(newX, newY);
      if (this.volumeModal) {
        this.volumeModal.setPosition(gameSize.width / 2, gameSize.height / 2);
      }
    });
  }
  
  /**
   * Show volume control modal
   */
  private showVolumeModal(): void {
    if (this.volumeModal) return; // Already open
    
    const { width, height } = this.scene.cameras.main;
    const centerX = width / 2;
    const centerY = height / 2;
    
    // Create modal container
    this.volumeModal = this.scene.add.container(centerX, centerY);
    this.volumeModal.setScrollFactor(0);
    this.volumeModal.setDepth(1001);
    
    // Create dark overlay
    const overlay = this.scene.add.rectangle(0, 0, width * 2, height * 2, 0x000000, 0.7);
    overlay.setInteractive();
    overlay.on('pointerdown', () => this.closeVolumeModal());
    
    // Create modal background
    const modalBg = this.scene.add.rectangle(0, 0, 400, 300, 0x2A3F5F);
    modalBg.setStrokeStyle(2, 0xffffff);
    
    // Modal title
    const title = this.scene.add.text(0, -100, 'SOUND SETTINGS', {
      fontSize: '24px',
      fontFamily: GAME_CONFIG.UI.FONT.FAMILY,
      color: COLORS.UI.TEXT_PRIMARY,
      fontStyle: 'bold'
    });
    title.setOrigin(0.5);
    
    // Get current volumes from localStorage
    const musicVolume = parseFloat(localStorage.getItem('musicVolume') || '0.25');
    const sfxVolume = parseFloat(localStorage.getItem('sfxVolume') || '1.0');
    
    // Music volume controls
    const musicLabel = this.scene.add.text(-150, -30, 'Music Volume:', {
      fontSize: '18px',
      fontFamily: GAME_CONFIG.UI.FONT.FAMILY,
      color: COLORS.UI.TEXT_PRIMARY
    });
    
    const musicVolumeText = this.scene.add.text(150, -30, `${Math.round(musicVolume * 100)}%`, {
      fontSize: '18px',
      fontFamily: GAME_CONFIG.UI.FONT.FAMILY,
      color: COLORS.UI.TEXT_PRIMARY
    });
    musicVolumeText.setOrigin(1, 0);
    
    // Music slider
    const musicSlider = this.createVolumeSlider(-150, 0, 300, musicVolume, (value) => {
      musicVolumeText.setText(`${Math.round(value * 100)}%`);
      this.setMusicVolume(value);
    });
    
    // SFX volume controls
    const sfxLabel = this.scene.add.text(-150, 40, 'SFX Volume:', {
      fontSize: '18px',
      fontFamily: GAME_CONFIG.UI.FONT.FAMILY,
      color: COLORS.UI.TEXT_PRIMARY
    });
    
    const sfxVolumeText = this.scene.add.text(150, 40, `${Math.round(sfxVolume * 100)}%`, {
      fontSize: '18px',
      fontFamily: GAME_CONFIG.UI.FONT.FAMILY,
      color: COLORS.UI.TEXT_PRIMARY
    });
    sfxVolumeText.setOrigin(1, 0);
    
    // SFX slider
    const sfxSlider = this.createVolumeSlider(-150, 70, 300, sfxVolume, (value) => {
      sfxVolumeText.setText(`${Math.round(value * 100)}%`);
      this.setSfxVolume(value);
    });
    
    // Close button
    const closeButton = this.scene.add.rectangle(0, 120, 100, 40, 0x3A5578);
    closeButton.setInteractive();
    closeButton.setStrokeStyle(2, 0xffffff);
    
    const closeText = this.scene.add.text(0, 120, 'CLOSE', {
      fontSize: '18px',
      fontFamily: GAME_CONFIG.UI.FONT.FAMILY,
      color: COLORS.UI.TEXT_PRIMARY,
      fontStyle: 'bold'
    });
    closeText.setOrigin(0.5);
    
    // Close button interactions
    closeButton.on('pointerover', () => {
      closeButton.setFillStyle(0x4A6588);
      closeButton.setScale(1.05);
      closeText.setScale(1.05);
    });
    
    closeButton.on('pointerout', () => {
      closeButton.setFillStyle(0x3A5578);
      closeButton.setScale(1);
      closeText.setScale(1);
    });
    
    closeButton.on('pointerdown', () => this.closeVolumeModal());
    
    // Add all elements to modal
    this.volumeModal.add([
      overlay, modalBg, title,
      musicLabel, musicVolumeText,
      sfxLabel, sfxVolumeText,
      closeButton, closeText,
      musicSlider, sfxSlider
    ]);
    
    // Fade in animation
    this.volumeModal.setAlpha(0);
    this.scene.tweens.add({
      targets: this.volumeModal,
      alpha: 1,
      duration: 200,
      ease: 'Power2'
    });
  }
  
  /**
   * Create a volume slider
   */
  private createVolumeSlider(x: number, y: number, width: number, initialValue: number, onChange: (value: number) => void): Phaser.GameObjects.Container {
    const container = this.scene.add.container(x, y);
    
    // Slider track
    const track = this.scene.add.rectangle(width / 2, 0, width, 8, 0x1a1a1a);
    
    // Slider fill
    const fill = this.scene.add.rectangle(0, 0, width * initialValue, 8, 0x4A6588);
    fill.setOrigin(0, 0.5);
    
    // Slider handle
    const handle = this.scene.add.circle(width * initialValue, 0, 12, 0xffffff);
    handle.setInteractive({ draggable: true });
    
    container.add([track, fill, handle]);
    
    // Handle dragging
    handle.on('drag', (pointer: Phaser.Input.Pointer, dragX: number) => {
      // Clamp to track bounds
      const clampedX = Phaser.Math.Clamp(dragX, 0, width);
      handle.x = clampedX;
      
      // Update fill
      fill.width = clampedX;
      
      // Calculate value (0 to 1)
      const value = clampedX / width;
      onChange(value);
    });
    
    return container;
  }
  
  /**
   * Set music volume globally
   */
  private setMusicVolume(value: number): void {
    // Store in localStorage
    localStorage.setItem('musicVolume', value.toString());
    
    // Store in registry for global access
    this.scene.game.registry.set('musicVolume', value);
    
    // Apply to all playing music
    const sounds = this.scene.sound.getAllPlaying();
    sounds.forEach(sound => {
      if (sound.key.includes('music') && 'setVolume' in sound) {
        (sound as Phaser.Sound.WebAudioSound | Phaser.Sound.HTML5AudioSound).setVolume(value);
      }
    });
  }
  
  /**
   * Set SFX volume globally
   */
  private setSfxVolume(value: number): void {
    // Store in localStorage
    localStorage.setItem('sfxVolume', value.toString());
    
    // Store in registry for global access
    this.scene.game.registry.set('sfxVolume', value);
    
    // Emit event for SoundManager to update its volumes
    // The SoundManager will handle updating all SFX with their proper base volumes
    this.scene.game.events.emit('sfxVolumeChanged', value);
  }
  
  /**
   * Close volume modal
   */
  private closeVolumeModal(): void {
    if (!this.volumeModal) return;
    
    this.scene.tweens.add({
      targets: this.volumeModal,
      alpha: 0,
      duration: 200,
      ease: 'Power2',
      onComplete: () => {
        this.volumeModal?.destroy();
        this.volumeModal = undefined;
      }
    });
  }
  
  /**
   * Clean up
   */
  destroy(): void {
    this.soundButton?.destroy();
    this.volumeModal?.destroy();
  }
} 