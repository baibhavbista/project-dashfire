// Shared world geometry definitions
// This file is used by both client and server for consistent world physics

export interface Platform {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Rectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Main arena dimensions
export const ARENA_WIDTH = 3000;
export const ARENA_HEIGHT = 768;

// Main floor platform
export const MAIN_PLATFORM: Platform = {
  x: ARENA_WIDTH / 2,
  y: 700,
  width: ARENA_WIDTH,
  height: 100
};

// Elevated platforms
export const ELEVATED_PLATFORMS: Platform[] = [
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

// All platforms combined
export const ALL_PLATFORMS: Platform[] = [MAIN_PLATFORM, ...ELEVATED_PLATFORMS];

// Utility function for AABB collision detection
export function checkAABBCollision(
  rect1: Rectangle,
  rect2: Rectangle
): boolean {
  const rect1Left = rect1.x - rect1.width / 2;
  const rect1Right = rect1.x + rect1.width / 2;
  const rect1Top = rect1.y - rect1.height / 2;
  const rect1Bottom = rect1.y + rect1.height / 2;
  
  const rect2Left = rect2.x - rect2.width / 2;
  const rect2Right = rect2.x + rect2.width / 2;
  const rect2Top = rect2.y - rect2.height / 2;
  const rect2Bottom = rect2.y + rect2.height / 2;
  
  return rect1Left < rect2Right &&
         rect1Right > rect2Left &&
         rect1Top < rect2Bottom &&
         rect1Bottom > rect2Top;
}

// Check if a point collides with any platform
export function checkPointPlatformCollision(
  x: number,
  y: number,
  platforms: Platform[] = ALL_PLATFORMS
): Platform | null {
  for (const platform of platforms) {
    const halfWidth = platform.width / 2;
    const halfHeight = platform.height / 2;
    
    if (x >= platform.x - halfWidth &&
        x <= platform.x + halfWidth &&
        y >= platform.y - halfHeight &&
        y <= platform.y + halfHeight) {
      return platform;
    }
  }
  return null;
}

// Check if a bullet path intersects with any platform
export function checkBulletPlatformCollision(
  bullet: { x: number; y: number; width?: number; height?: number },
  platforms: Platform[] = ALL_PLATFORMS
): Platform | null {
  const bulletRect: Rectangle = {
    x: bullet.x,
    y: bullet.y,
    width: bullet.width || 10,
    height: bullet.height || 6
  };
  
  for (const platform of platforms) {
    if (checkAABBCollision(bulletRect, platform)) {
      return platform;
    }
  }
  return null;
} 