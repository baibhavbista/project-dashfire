import Phaser from 'phaser';
import { BasePlayer } from '../entities/BasePlayer';
import { PlayerTextureManager } from '../entities/PlayerTextureManager';
import { MovementState } from './MovementSystem';
import { AnimationState } from './AnimationSystem';

/**
 * Debug visualization system for showing bounding boxes, origins, and other debug info
 */
export class DebugVisualization {
  private scene: Phaser.Scene;
  private graphics: Phaser.GameObjects.Graphics;
  private enabled: boolean = false;
  private debugTexts: Map<string, Phaser.GameObjects.Text> = new Map();
  
  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.graphics = scene.add.graphics();
    
    // Set depth to render on top of everything
    this.graphics.setDepth(9999);
    
    // Add keyboard toggle
    const debugKey = scene.input.keyboard?.addKey('B');
    debugKey?.on('down', () => this.toggle());
  }
  
  /**
   * Toggle debug visualization on/off
   */
  toggle(): void {
    this.enabled = !this.enabled;
    this.graphics.setVisible(this.enabled);
    
    // Toggle all debug texts
    this.debugTexts.forEach(text => text.setVisible(this.enabled));
    
    if (!this.enabled) {
      this.graphics.clear();
    }
  }
  
  /**
   * Clear all debug graphics (call once per frame before drawing)
   */
  clear(): void {
    if (!this.enabled) return;
    this.graphics.clear();
  }
  
  /**
   * Update debug visualization for a player
   */
  updatePlayer(player: BasePlayer, movementState?: MovementState, animationState?: AnimationState): void {
    if (!this.enabled) return;
    
    const body = player.body as Phaser.Physics.Arcade.Body;
    if (!body) return;
    
    // 1. Draw physics body (green box)
    this.graphics.lineStyle(2, 0x00ff00, 1);
    this.graphics.strokeRect(
      body.x,
      body.y,
      body.width,
      body.height
    );
    
    // 2. Draw sprite bounds (blue box) - this shows the actual texture size
    this.graphics.lineStyle(2, 0x0099ff, 1);
    const spriteBounds = player.getBounds();
    this.graphics.strokeRect(
      spriteBounds.x,
      spriteBounds.y,
      spriteBounds.width,
      spriteBounds.height
    );
    
    // 3. Draw origin point (red cross)
    this.graphics.lineStyle(3, 0xff0000, 1);
    const originX = player.x;
    const originY = player.y;
    this.graphics.strokeCircle(originX, originY, 5);
    this.graphics.beginPath();
    this.graphics.moveTo(originX - 10, originY);
    this.graphics.lineTo(originX + 10, originY);
    this.graphics.moveTo(originX, originY - 10);
    this.graphics.lineTo(originX, originY + 10);
    this.graphics.strokePath();
    
    // 4. Draw center of mass (yellow dot)
    const centerX = body.x + body.width / 2;
    const centerY = body.y + body.height / 2;
    this.graphics.fillStyle(0xffff00, 1);
    this.graphics.fillCircle(centerX, centerY, 4);
    
    // 5. Draw gun tip position (purple dot)
    const gunTipOffset = PlayerTextureManager.getGunTipOffset();
    const gunYOffset = PlayerTextureManager.getGunYOffset();
    const gunTipX = player.x + (player.flipX ? -gunTipOffset : gunTipOffset);
    const gunTipY = player.y - gunYOffset;
    this.graphics.fillStyle(0xff00ff, 1);
    this.graphics.fillCircle(gunTipX, gunTipY, 4);
    
    // 6. Draw velocity vector (cyan arrow)
    if (body.velocity.x !== 0 || body.velocity.y !== 0) {
      this.graphics.lineStyle(2, 0x00ffff, 1);
      const velocityScale = 0.1;
      const velocityEndX = centerX + body.velocity.x * velocityScale;
      const velocityEndY = centerY + body.velocity.y * velocityScale;
      
      this.graphics.beginPath();
      this.graphics.moveTo(centerX, centerY);
      this.graphics.lineTo(velocityEndX, velocityEndY);
      this.graphics.strokePath();
      
      // Arrow head
      const angle = Math.atan2(body.velocity.y, body.velocity.x);
      const arrowSize = 8;
      this.graphics.beginPath();
      this.graphics.moveTo(velocityEndX, velocityEndY);
      this.graphics.lineTo(
        velocityEndX - arrowSize * Math.cos(angle - Math.PI / 6),
        velocityEndY - arrowSize * Math.sin(angle - Math.PI / 6)
      );
      this.graphics.moveTo(velocityEndX, velocityEndY);
      this.graphics.lineTo(
        velocityEndX - arrowSize * Math.cos(angle + Math.PI / 6),
        velocityEndY - arrowSize * Math.sin(angle + Math.PI / 6)
      );
      this.graphics.strokePath();
    }
    
    // 7. Update or create debug text
    let debugText = this.debugTexts.get(player.id);
    if (!debugText) {
      debugText = this.scene.add.text(0, 0, '', {
        fontSize: '12px',
        color: '#ffffff',
        backgroundColor: '#000000',
        padding: { x: 4, y: 2 }
      });
      debugText.setDepth(10000);
      this.debugTexts.set(player.id, debugText);
    }
    
    // Position text above player with more spacing
    debugText.setPosition(player.x - 50, player.y - 150);
    debugText.setVisible(this.enabled);
    
    // Update text content
    const textContent = [
      `Pos: ${Math.round(player.x)}, ${Math.round(player.y)}`,
      `Vel: ${Math.round(body.velocity.x)}, ${Math.round(body.velocity.y)}`,
      `Grounded: ${body.blocked.down}`,
      `Scale: ${player.scaleX.toFixed(2)}, ${player.scaleY.toFixed(2)}`
    ];
    
    // Add movement state info if available
    if (movementState) {
      textContent.push('--- Movement State ---');
      textContent.push(`isJumping: ${movementState.isJumping}`);
      textContent.push(`wasJumpPressed: ${movementState.wasJumpPressed}`);
      textContent.push(`coyoteTime: ${movementState.coyoteTime.toFixed(0)}ms`);
      textContent.push(`isDashing: ${movementState.isDashing}`);
      textContent.push(`isCrouching: ${movementState.isCrouching}`);
      textContent.push(`canDash: ${movementState.canDash}`);
    }
    
    // Add animation state info if available
    if (animationState) {
      textContent.push('--- Animation State ---');
      textContent.push(`isJumping: ${animationState.isJumping}`);
      textContent.push(`isFalling: ${animationState.isFalling}`);
      textContent.push(`isLanding: ${animationState.isLanding}`);
      textContent.push(`isDashing: ${animationState.isDashing}`);
      textContent.push(`wasDashing: ${animationState.wasDashing}`);
      textContent.push(`isCrouching: ${animationState.isCrouching}`);
    }
    
    debugText.setText(textContent.join('\n'));
  }
  
  /**
   * Draw a legend explaining the colors
   */
  drawLegend(): void {
    if (!this.enabled) return;
    
    // Position legend in top-right corner instead of top-left
    const legendX = this.scene.cameras.main.width - 170;
    const legendY = 10;
    const lineHeight = 20;
    const legendWidth = 160;
    
    const legendItems = [
      { color: 0x00ff00, label: 'Physics Body' },
      { color: 0x0099ff, label: 'Sprite Bounds' },
      { color: 0xff0000, label: 'Origin Point' },
      { color: 0xffff00, label: 'Center of Mass' },
      { color: 0xff00ff, label: 'Gun Tip' },
      { color: 0x00ffff, label: 'Velocity Vector' }
    ];
    
    // Background with border
    this.graphics.fillStyle(0x000000, 0.8);
    this.graphics.fillRect(legendX - 5, legendY - 5, legendWidth, legendItems.length * lineHeight + 10);
    this.graphics.lineStyle(1, 0xffffff, 0.3);
    this.graphics.strokeRect(legendX - 5, legendY - 5, legendWidth, legendItems.length * lineHeight + 10);
    
    // Legend items
    legendItems.forEach((item, index) => {
      const y = legendY + index * lineHeight + 5;
      
      // Color box
      this.graphics.fillStyle(item.color, 1);
      this.graphics.fillRect(legendX, y, 12, 12);
      
      // Label - create or update
      const legendKey = `legend_${index}`;
      let legendText = this.debugTexts.get(legendKey);
      
      if (!legendText) {
        legendText = this.scene.add.text(legendX + 20, y - 2, item.label, {
          fontSize: '12px',
          color: '#ffffff'
        });
        legendText.setDepth(10001);
        legendText.setScrollFactor(0); // Keep legend fixed on screen
        this.debugTexts.set(legendKey, legendText);
      } else {
        // Update position in case screen was resized
        legendText.setPosition(legendX + 20, y - 2);
      }
      
      legendText.setVisible(this.enabled);
    });
    
    // Add title
    const titleKey = 'legend_title';
    let titleText = this.debugTexts.get(titleKey);
    
    if (!titleText) {
      titleText = this.scene.add.text(legendX + 5, legendY - 3, 'Debug Legend', {
        fontSize: '14px',
        color: '#ffffff',
        fontStyle: 'bold'
      });
      titleText.setDepth(10001);
      titleText.setScrollFactor(0);
      this.debugTexts.set(titleKey, titleText);
    } else {
      titleText.setPosition(legendX + 5, legendY - 3);
    }
    
    titleText.setVisible(this.enabled);
  }
  
  /**
   * Clean up resources
   */
  destroy(): void {
    this.graphics.destroy();
    this.debugTexts.forEach(text => text.destroy());
    this.debugTexts.clear();
  }
} 