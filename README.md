# Platformer Arena

A Celeste-inspired 2D platformer game built with Phaser 3, React, and TypeScript. Features precise movement mechanics, air dashing, and a sprawling arena to explore.

## 🎮 Game Features

### Movement System
- **Responsive Controls**: Snappy acceleration and deceleration for precise platforming
- **Coyote Time**: 150ms grace period for jumping after leaving a platform
- **Variable Jump Height**: Hold jump longer for higher jumps
- **Fast Fall**: Press down while airborne for quick descent
- **Dynamic Gravity**: Adaptive gravity system for better jump feel

### Dash Mechanics (Celeste-inspired)
- **Air Dash Only**: Can only dash while airborne (not on ground)
- **8-Directional Dashing**: Dash in any of 8 directions using arrow keys
- **Single Use**: One dash per air time (resets when touching ground)
- **Fixed Distance**: Consistent dash distance regardless of button hold duration
- **Zero Gravity**: No gravity during dash for perfect trajectory control
- **Visual Trails**: Cyan dash trails that fade over time
- **Cooldown System**: Brief cooldown to prevent dash spam

### Level Design
- **Large Arena**: 3000px wide explorable area (3x screen width)
- **Multi-level Platforms**: Various elevated platforms for complex navigation
- **Camera System**: Smooth following camera with deadzone
- **Parallax Background**: Clouds and mountains for depth
- **Particle Effects**: Dust particles for landing and movement feedback

## 🎯 Controls

| Key | Action |
|-----|--------|
| **A** / **Left Arrow** | Move Left |
| **Right Arrow** | Move Right |
| **D** | Jump |
| **S** | Dash (midair only) |
| **Down Arrow** | Fast Fall (midair only) |

### Dash Controls
- **S + Arrow Keys**: Dash in the direction of arrow keys
- **S + No Direction**: Dash horizontally in facing direction
- **S + Two Arrows**: Dash diagonally (e.g., up+right)

## 🛠️ Technical Details

### Built With
- **Phaser 3**: Game engine for 2D physics and rendering
- **React**: UI framework for game container and controls display
- **TypeScript**: Type-safe development
- **Vite**: Fast build tool and dev server
- **Tailwind CSS**: Styling for UI elements

### Game Architecture
- **GameScene.ts**: Main game logic and physics
- **App.tsx**: React wrapper and UI
- **Modular Design**: Clean separation between game logic and UI

### Physics System
- **Arcade Physics**: Phaser's built-in physics engine
- **Custom Gravity**: Dynamic gravity based on jump state
- **Collision Detection**: Platform collision with proper bounce
- **Velocity Management**: Precise control over player movement

## 🚀 Getting Started

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn

### Installation
```bash
# Clone the repository
git clone <repository-url>

# Install dependencies
npm install

# Start development server
npm run dev
```

### Build for Production
```bash
npm run build
```

## 🎨 Visual Features

- **Player Character**: Red-tinted sprite with flip animations
- **Dash Effects**: Cyan color change and trailing effects during dash
- **Environmental Art**: Parallax clouds and mountain silhouettes
- **Particle Systems**: Dust effects for jumps and movement
- **Smooth Animations**: Tweened effects for visual polish

## 🎯 Game Mechanics Deep Dive

### Movement Physics
- **Max Speed**: 300 pixels/second
- **Acceleration**: 1200 pixels/second²
- **Friction**: 800 pixels/second² (quick stops)
- **Jump Power**: 550 pixels/second upward velocity
- **Gravity**: Variable (200-900) based on jump phase

### Dash System
- **Dash Power**: 800 pixels/second
- **Duration**: 150ms
- **Cooldown**: 100ms
- **Trail Count**: Up to 8 simultaneous trails
- **Direction**: 8-way directional with diagonal normalization

## 🔮 Future Enhancements

Potential features for future development:
- Enemy AI and combat system
- Collectible items and power-ups
- Multiple levels/areas
- Sound effects and music
- Save system and progression
- Advanced movement mechanics (wall jumping, etc.)
- Multiplayer support

## 📝 Development Notes

The game emphasizes tight, responsive controls similar to modern indie platformers like Celeste. The dash system is particularly inspired by Celeste's air dash mechanics, providing players with precise aerial control and encouraging skillful movement through the environment.

The codebase is structured for easy expansion, with clear separation between game logic, physics, and presentation layers.
</parameter>