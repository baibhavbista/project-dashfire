import Phaser from 'phaser';
import { COLORS } from '../config/Colors';
import { GAME_CONFIG } from '../config/GameConfig';

interface KillMessage {
  text: Phaser.GameObjects.Text;
  timer: Phaser.Time.TimerEvent;
}

/**
 * Kill feed manager - displays elimination messages
 * Auto-fades messages and manages positioning
 */
export class KillFeed {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private messages: KillMessage[] = [];
  private maxMessages: number = GAME_CONFIG.UI.KILL_FEED.MAX_MESSAGES;
  
  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    
    // Create container at kill feed position
    this.container = scene.add.container(
      GAME_CONFIG.UI.KILL_FEED.POSITION.x,
      GAME_CONFIG.UI.KILL_FEED.POSITION.y
    );
    this.container.setScrollFactor(0);
  }
  
  /**
   * Add a kill message to the feed
   */
  addKillMessage(killerName: string, victimName: string): void {
    // Create message text
    const message = this.scene.add.text(0, 0, `${killerName} eliminated ${victimName}`, {
      fontSize: GAME_CONFIG.UI.FONT.SIZE.MEDIUM,
      color: COLORS.UI.TEXT_PRIMARY,
      backgroundColor: '#000000',
      padding: { x: 8, y: 4 }
    });
    message.setOrigin(1, 0);
    message.setAlpha(0.9);
    
    // Position message based on current messages
    const yOffset = this.messages.length * GAME_CONFIG.UI.KILL_FEED.MESSAGE_HEIGHT;
    message.setY(-yOffset);
    
    // Add to container
    this.container.add(message);
    
    // Set up fade timer
    const timer = this.scene.time.delayedCall(
      GAME_CONFIG.UI.KILL_FEED.FADE_DELAY,
      () => this.fadeAndRemoveMessage(message),
      [],
      this
    );
    
    // Store message reference
    this.messages.push({ text: message, timer });
    
    // Remove oldest message if we exceed max
    if (this.messages.length > this.maxMessages) {
      const oldest = this.messages.shift();
      if (oldest) {
        oldest.timer.destroy();
        this.fadeAndRemoveMessage(oldest.text);
      }
    }
  }
  
  /**
   * Fade out and remove a message
   */
  private fadeAndRemoveMessage(message: Phaser.GameObjects.Text): void {
    // Fade out
    this.scene.tweens.add({
      targets: message,
      alpha: 0,
      duration: GAME_CONFIG.UI.KILL_FEED.FADE_DURATION,
      onComplete: () => {
        // Find and remove from array
        const index = this.messages.findIndex(m => m.text === message);
        if (index > -1) {
          this.messages.splice(index, 1);
        }
        
        // Destroy the text object
        message.destroy();
        
        // Reposition remaining messages
        this.repositionMessages();
      }
    });
  }
  
  /**
   * Reposition all messages after one is removed
   */
  private repositionMessages(): void {
    this.messages.forEach((msg, index) => {
      const targetY = -index * GAME_CONFIG.UI.KILL_FEED.MESSAGE_HEIGHT;
      
      // Animate to new position
      this.scene.tweens.add({
        targets: msg.text,
        y: targetY,
        duration: 200,
        ease: 'Power2'
      });
    });
  }
  
  /**
   * Clear all messages
   */
  clear(): void {
    this.messages.forEach(msg => {
      msg.timer.destroy();
      msg.text.destroy();
    });
    this.messages = [];
  }
  
  /**
   * Clean up
   */
  destroy(): void {
    this.clear();
    this.container.destroy();
  }
} 