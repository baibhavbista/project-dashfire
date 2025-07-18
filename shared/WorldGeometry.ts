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
  height: 80 // Reduced thickness
};

// Denser, more connected level design with thinner platforms
export const ELEVATED_PLATFORMS: Platform[] = [
  // --- Ground Structures (Thinner and more intricate) ---
  { x: 300, y: 1370, width: 80, height: 160 },  // Left wall
  { x: 500, y: 1300, width: 350, height: 40 },  // Left "U" base
  { x: 700, y: 1370, width: 80, height: 160 },   // Right wall of "U"
  { x: 950, y: 1250, width: 200, height: 30 },  // Step-up platform

  { x: 2700, y: 1370, width: 80, height: 160 }, // Right wall
  { x: 2500, y: 1300, width: 350, height: 40 }, // Right "L" base
  { x: 2250, y: 1390, width: 60, height: 120 },  // Lower step of "L"
  { x: 2050, y: 1250, width: 200, height: 30 }, // Step-up platform

  // --- Dense Floating Platforms ---
  // Central combat super-structure
  { x: 1500, y: 950, width: 800, height: 40 }, // Main central bridge
  { x: 1200, y: 910, width: 40, height: 120 },  // Left cover on bridge
  { x: 1800, y: 910, width: 40, height: 120 },  // Right cover on bridge
  { x: 1500, y: 1100, width: 500, height: 30 }, // Lower central platform

  // Mid-tier side platforms (more frequent)
  { x: 450, y: 750, width: 400, height: 30 },
  { x: 2550, y: 750, width: 400, height: 30 },
  { x: 800, y: 1000, width: 150, height: 25 },
  { x: 2200, y: 1000, width: 150, height: 25 },
  
  // Smaller connecting "dots" and steps
  { x: 100, y: 1150, width: 100, height: 25 },
  { x: 2900, y: 1150, width: 100, height: 25 },
  { x: 600, y: 880, width: 100, height: 25 },
  { x: 2400, y: 880, width: 100, height: 25 },
  { x: 1200, y: 650, width: 150, height: 30 },
  { x: 1800, y: 650, width: 150, height: 30 },

  // --- High-Tier Perches & Cover (thinner and more connected) ---
  { x: 200, y: 550, width: 40, height: 250 },   // Tall side cover
  { x: 2800, y: 550, width: 40, height: 250 },  // Tall side cover
  { x: 500, y: 400, width: 250, height: 30 },
  { x: 2500, y: 400, width: 250, height: 30 },

  // Top-most platforms
  { x: 800, y: 250, width: 200, height: 30 },
  { x: 2200, y: 250, width: 200, height: 30 },
  { x: 1500, y: 150, width: 400, height: 40 }, // Top central arena
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