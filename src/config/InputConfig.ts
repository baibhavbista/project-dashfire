/**
 * Centralized input configuration for Project SlingFire
 * All key bindings and input settings
 */

import Phaser from 'phaser';

export const INPUT_CONFIG = {
  // Movement keys
  MOVEMENT: {
    LEFT: Phaser.Input.Keyboard.KeyCodes.LEFT,
    RIGHT: Phaser.Input.Keyboard.KeyCodes.RIGHT,
    UP: Phaser.Input.Keyboard.KeyCodes.UP,
    DOWN: Phaser.Input.Keyboard.KeyCodes.DOWN,
  },
  
  // Action keys
  ACTIONS: {
    JUMP: Phaser.Input.Keyboard.KeyCodes.D,
    DASH: Phaser.Input.Keyboard.KeyCodes.S,
    SHOOT_PRIMARY: Phaser.Input.Keyboard.KeyCodes.SPACE,
    SHOOT_SECONDARY: Phaser.Input.Keyboard.KeyCodes.A,
  },
  
  // UI keys
  UI: {
    DEBUG_TOGGLE: Phaser.Input.Keyboard.KeyCodes.F3,
  },
  
  // Alternative keys (for future use)
  ALTERNATIVES: {
    JUMP_ALT: Phaser.Input.Keyboard.KeyCodes.W,
    LEFT_ALT: Phaser.Input.Keyboard.KeyCodes.A,
  },
} as const;

// Type exports
export type ActionKey = keyof typeof INPUT_CONFIG.ACTIONS;
export type MovementKey = keyof typeof INPUT_CONFIG.MOVEMENT; 