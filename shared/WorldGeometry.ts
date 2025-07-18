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

// Main arena dimensions - full screen with 2x vertical height
export const ARENA_WIDTH = 3000;
export const ARENA_HEIGHT = 1536; // 2x screen height for vertical exploration

// Main floor platform - positioned at bottom of expanded arena
export const MAIN_PLATFORM: Platform = {
  x: ARENA_WIDTH / 2,
  y: 1450, // Near bottom of 1536 height arena
  width: ARENA_WIDTH,
  height: 120 // Slightly thicker floor
};

// Block-style platforms spread across full vertical space (2x height)
export const ELEVATED_PLATFORMS: Platform[] = [
  // Bottom tier blocks (just above ground level)
  { x: 200, y: 1250, width: 150, height: 80 },
  { x: 500, y: 1300, width: 180, height: 64 },
  { x: 800, y: 1200, width: 200, height: 96 },
  { x: 1200, y: 1280, width: 160, height: 72 },
  { x: 1600, y: 1220, width: 180, height: 88 },
  { x: 2000, y: 1300, width: 150, height: 64 },
  { x: 2400, y: 1240, width: 200, height: 80 },
  
  // Mid-low tier blocks
  { x: 150, y: 1000, width: 120, height: 96 },
  { x: 450, y: 1050, width: 160, height: 80 },
  { x: 750, y: 950, width: 140, height: 112 },
  { x: 1100, y: 1020, width: 180, height: 88 },
  { x: 1450, y: 980, width: 150, height: 104 },
  { x: 1850, y: 1080, width: 170, height: 72 },
  { x: 2250, y: 1000, width: 160, height: 96 },
  
  // Middle tier blocks
  { x: 300, y: 750, width: 140, height: 88 },
  { x: 650, y: 800, width: 160, height: 96 },
  { x: 950, y: 700, width: 180, height: 80 },
  { x: 1300, y: 780, width: 150, height: 104 },
  { x: 1700, y: 720, width: 170, height: 88 },
  { x: 2100, y: 800, width: 140, height: 96 },
  
  // Mid-high tier blocks
  { x: 100, y: 500, width: 130, height: 80 },
  { x: 400, y: 550, width: 150, height: 96 },
  { x: 700, y: 450, width: 160, height: 88 },
  { x: 1000, y: 520, width: 140, height: 104 },
  { x: 1400, y: 480, width: 180, height: 80 },
  { x: 1800, y: 560, width: 150, height: 96 },
  { x: 2200, y: 500, width: 160, height: 88 },
  
  // High tier blocks
  { x: 250, y: 250, width: 120, height: 96 },
  { x: 550, y: 300, width: 140, height: 88 },
  { x: 850, y: 200, width: 160, height: 104 },
  { x: 1150, y: 280, width: 150, height: 80 },
  { x: 1550, y: 220, width: 170, height: 96 },
  { x: 1950, y: 320, width: 140, height: 88 },
  
  // Top tier blocks (highest level)
  { x: 400, y: 100, width: 140, height: 80 },
  { x: 800, y: 50, width: 160, height: 96 },
  { x: 1200, y: 80, width: 150, height: 88 },
  { x: 1600, y: 120, width: 180, height: 80 },
  { x: 2000, y: 60, width: 140, height: 96 }
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

  // console.log("checkAABBCollision: rect1Left", rect1Left);
  // console.log("checkAABBCollision: rect1Right", rect1Right);
  // console.log("checkAABBCollision: rect1Top", rect1Top);
  // console.log("checkAABBCollision: rect1Bottom", rect1Bottom);
  
  const rect2Left = rect2.x - rect2.width / 2;
  const rect2Right = rect2.x + rect2.width / 2;
  const rect2Top = rect2.y - rect2.height / 2;
  const rect2Bottom = rect2.y + rect2.height / 2;
  
  // console.log("checkAABBCollision: rect2Left", rect2Left);
  // console.log("checkAABBCollision: rect2Right", rect2Right);
  // console.log("checkAABBCollision: rect2Top", rect2Top);
  // console.log("checkAABBCollision: rect2Bottom", rect2Bottom);
  
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
      console.log("checkBulletPlatformCollision: Bullet hit a platform", bullet.x, bullet.y, platform.x, platform.y);
      return platform;
    }
  }
  console.log("checkBulletPlatformCollision: Bullet did not hit a platform", bullet.x, bullet.y);
  return null;
} 