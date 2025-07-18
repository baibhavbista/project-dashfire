# GameScene Refactoring Plan

## Overview
This document outlines the plan to refactor the monolithic 1433-line `GameScene.ts` into a modular, maintainable architecture. The primary goal is to make the codebase easier to understand, modify, and extend through proper separation of concerns.

## Current Issues
1. **Monolithic GameScene**: 1433 lines handling 15+ responsibilities
2. **Scattered Configuration**: Colors and constants hardcoded throughout
3. **Code Duplication**: Remote players duplicate animation/effect logic
4. **Tight Coupling**: Systems directly manipulate each other's state
5. **Poor Separation of Concerns**: UI, physics, networking, and rendering intertwined

## Refactoring Goals
- **Create logical modules** with clear, single responsibilities
- **Centralize all configuration** (colors, physics constants)
- **Eliminate duplication** between local and remote players
- **Improve maintainability** through better organization
- **Maintain current functionality** with no regressions
- **Keep game playable** throughout refactoring
- **GameScene as orchestrator** - coordinates modules, doesn't implement details

## Target Architecture

```
src/
├── config/
│   ├── Colors.ts               # All color constants
│   ├── GameConfig.ts          # Physics, speeds, cooldowns
│   └── InputConfig.ts         # Key bindings
│
├── systems/
│   ├── PlayerSystem.ts        # Manages all player entities
│   ├── MovementSystem.ts      # Physics, jumping, dashing
│   ├── AnimationSystem.ts     # Breathing, squash/stretch, lean
│   ├── CombatSystem.ts        # Weapons, shooting, damage
│   └── EffectsSystem.ts       # Particles, trails, visual feedback
│
├── entities/
│   ├── BasePlayer.ts          # Shared player functionality
│   ├── LocalPlayer.ts         # Input handling
│   └── RemotePlayer.ts        # Interpolation (updated)
│
├── ui/
│   ├── GameHUD.ts            # Health, scores, team indicator
│   ├── KillFeed.ts           # Kill notifications
│   └── DebugOverlay.ts       # F3 network stats
│
├── scenes/
│   └── GameScene.ts          # Slim orchestrator (~200 lines)
│
└── network/
    ├── StateReconciler.ts     # Position reconciliation
    └── Interpolator.ts        # Smooth remote movement
```

## Implementation Phases

*Total estimated time: 23 hours*
*Note: Focus is on logical module boundaries, not arbitrary line count targets*

### ✅ Refactoring Complete! (All 9 Phases Done)
- **Original GameScene**: 1433 lines (monolithic)
- **Final GameScene**: 276 lines (80.7% reduction!)
- **Modules Created**: 13 focused systems
- **Architecture**: Clean separation of concerns fully achieved

- **Current GameScene**: 332 lines (76.8% reduction!)
- **Modules Created**: 12 focused systems
- **Architecture**: Clear separation of concerns fully established

### Phase 1: Configuration Extraction (2 hours) ✅ COMPLETE
**Goal**: Centralize all hardcoded values

1. **Create `Colors.ts`**:
   ```typescript
   export const COLORS = {
     BACKGROUND: { MAIN: 0x0A0A0A, VIGNETTE: 0x000000 },
     PLATFORMS: { MAIN: 0x2B2B2B, ELEVATED: 0x3A3A3A, EDGE: 0x4A4A4A },
     TEAMS: {
       RED: { PRIMARY: 0xE74C3C, GLOW: 0xFF6B6B },
       BLUE: { PRIMARY: 0x3498DB, GLOW: 0x5DADE2 }
     },
     UI: { /* ... */ },
     EFFECTS: { /* ... */ }
   };
   ```

2. **Create `GameConfig.ts`**:
   ```typescript
   export const PLAYER_CONFIG = {
     MAX_SPEED: 300,
     ACCELERATION: 1200,
     JUMP_POWER: 550,
     DASH_POWER: 800,
     DASH_DURATION: 150,
     DASH_COOLDOWN: 300,
     // ... etc
   };
   ```

3. **Update all references** throughout GameScene
4. **Test**: Ensure no visual or gameplay changes

### Phase 2: Player Entity Refactor (3 hours)
**Goal**: Create reusable player base class

1. **Create `BasePlayer.ts`**:
   - Extends Phaser.Physics.Arcade.Sprite
   - Common properties (health, team, animations)
   - Shared methods (setTeam, updateHealth)

2. **Update `LocalPlayer.ts`**:
   - Extend BasePlayer
   - Add input handling
   - Move local-specific code

3. **Update `RemotePlayer.ts`**:
   - Extend BasePlayer
   - Remove duplicated animation code
   - Keep interpolation logic

4. **Test**: Both player types work identically

### Phase 2.5: Network Interpolation & Prediction (2 hours)
**Goal**: Implement predictive animations for remote players

1. **Create `Interpolator.ts`**:
   - Position interpolation between server updates
   - Predictive animation triggers
   - Smooth correction when predictions differ from server

2. **Update `RemotePlayer.ts`**:
   - Add predictive animation support
   - Implement conservative prediction for:
     - Jump animations (stretch immediately on jump event)
     - Dash effects (start trail immediately)
     - Landing animations (squash on predicted landing)
   - Keep server-authoritative for:
     - Death animations
     - Hit reactions
     - Final positions

3. **Add to `NetworkManager.ts`**:
   - Emit animation events separately from position updates
   - Handle "player-jumped", "player-dashed" events

4. **Test**: Remote players feel as responsive as local player

### Phase 3: Movement System Extraction (3 hours)
**Goal**: Centralize all movement physics

1. **Create `MovementSystem.ts`**:
   ```typescript
   export class MovementSystem {
     static updatePhysics(player: BasePlayer, delta: number) { }
     static applyJump(player: BasePlayer) { }
     static startDash(player: BasePlayer, direction: Vector2) { }
     static updateDash(player: BasePlayer, delta: number) { }
   }
   ```

2. **Extract from GameScene**:
   - Jump logic with coyote time
   - Dash mechanics
   - Gravity management
   - Platform collisions

3. **Apply to both** LocalPlayer and RemotePlayer
4. **Test**: Movement feels identical

### Phase 4: Animation System (2 hours)
**Goal**: Unified animation logic for all players

1. **Create `AnimationSystem.ts`**:
   - Breathing animation
   - Jump stretch/squash
   - Landing impact
   - Movement lean
   - Direction indicator

2. **Remove duplication** between local/remote
3. **Test**: Animations work for all players

### Phase 5: UI Separation (2 hours)
**Goal**: Clean UI management

1. **Create `GameHUD.ts`**:
   - Health bar
   - Team scores
   - Team indicator
   - Respawn timer

2. **Create `KillFeed.ts`**:
   - Message queue
   - Auto-fade logic
   - Position management

3. **Wire up events** from GameScene
4. **Test**: UI updates correctly

### Phase 6: Effects System (2 hours) ✅ COMPLETE
**Goal**: Centralized particle management

1. **Create `EffectsSystem.ts`**: ✅
   - Particle pools ✅
   - Dash trails (handled by AnimationSystem)
   - Death effects ✅
   - Bullet impacts ✅
   - Landing dust ✅

2. **Add cleanup methods** ✅
3. **Test**: Effects trigger correctly ✅

**Result**: GameScene reduced from 896 to 790 lines (106 lines removed)

### Phase 7: World Builder (2 hours) ✅ COMPLETE
**Goal**: Extract world creation into dedicated module

1. **Create `WorldBuilder.ts`**: ✅
   - Platform creation (main + elevated) ✅
   - Atmospheric background elements ✅
   - Vignette effects ✅
   - World bounds configuration ✅
   - Collision group setup ✅

2. **Benefits**:
   - Easier to add new level layouts
   - Reusable for different game modes
   - Clear separation of world data from game logic

3. **Test**: World renders correctly ✅

**Result**: GameScene reduced from 790 to 867 lines (temporarily increased due to multiplayer code duplication that was removed in Phase 8)

### Phase 8: Multiplayer Coordinator (3 hours) ✅ COMPLETE
**Goal**: Extract massive multiplayer setup into its own module

1. **Create `MultiplayerCoordinator.ts`**: ✅
   - All network event handlers (~250 lines) ✅
   - Team assignment logic ✅
   - Player spawn/despawn ✅
   - Score tracking ✅
   - Network quality indicators ✅

2. **Benefits**:
   - GameScene no longer needs to know network details
   - Easier to add new multiplayer features
   - Can be disabled cleanly for single-player

3. **Test**: Multiplayer functionality intact ✅

**Result**: GameScene reduced from 867 to 332 lines (535 lines removed! 61.7% reduction)

### Phase 9: Final Integration (1 hour)
**Goal**: GameScene as pure orchestrator

1. **GameScene responsibilities**:
   - Initialize all systems
   - Coordinate system communication
   - Handle scene lifecycle
   - Core update loop

2. **Communication patterns**:
   - Event-driven between systems
   - GameScene only orchestrates, doesn't implement

3. **Final architecture**:
   - Each system has clear boundaries
   - GameScene ~300-400 lines (appropriate for orchestrator)
   - Easy to understand data flow

## Technical Decisions

### Decisions Made
- **State Management**: Local state for responsiveness, server sync for critical events
- **Validation**: Client-authoritative movement, server validates combat
- **Architecture**: Phaser-friendly, minimal abstraction
- **Testing**: Not a priority for now

### Decisions Pending
- ~~**Remote Player Animations**: Should we predict animations before server confirmation?~~
  - **DECIDED**: Yes, using conservative prediction for better responsiveness
  - Only predict safe animations (jump stretch, dash start, landing squash)
  - Wait for server confirmation on critical events (deaths, hits)

## Success Criteria
- [x] **Clear Module Boundaries**: Each system has a single, well-defined responsibility ✅
- [x] **No Configuration Duplication**: All constants centralized ✅
- [x] **Shared Systems**: Local and remote players use same core systems ✅
- [x] **Functional Parity**: All features work as before ✅
- [x] **Easy Extension**: New features can be added to appropriate modules ✅
- [x] **GameScene as Orchestrator**: Scene only coordinates, doesn't implement ✅
- [x] **Logical Organization**: Related code grouped together ✅
- [x] **Reduced Cognitive Load**: Easier to understand and navigate ✅

## Migration Strategy
1. **Branch Strategy**: Create `refactor/gamescene` branch
2. **Phase Approach**: Complete one phase at a time
3. **Testing**: Manual testing after each phase
4. **Commits**: One commit per completed phase
5. **Review**: Self-review diff before merging

## Risks & Mitigations
- **Risk**: Breaking multiplayer sync
  - **Mitigation**: Test with multiple clients after each phase
- **Risk**: Performance regression
  - **Mitigation**: Monitor FPS throughout
- **Risk**: Losing game feel
  - **Mitigation**: Record before/after videos

## Future Steps

### Immediate Next Features
- **Weapon System Expansion**: Multiple weapons with switching
- **Spectator Mode**: Free camera for dead players
- **Match Flow**: Waiting room, even player enforcement

### Platform Enhancements
- Moving platforms
- Different platform types (ice, bounce)
- Environmental hazards

### Visual Polish (Phase 3 from design doc)
- Screen shake effects
- Enhanced particle systems
- Post-processing effects

### Network Improvements
- Better interpolation for remote players
- Lag compensation for shooting
- Connection quality indicators

### Audio System
- Positional audio for multiplayer
- Sound pooling for multiple players
- Volume controls

## Notes
- Focus is on refactoring, not new features
- Maintain backwards compatibility
- Keep changes reviewable (small PRs)
- Document any tricky logic

### Predictive Animation Implementation Details
Conservative prediction approach for remote players:
- **Immediately predict**: Jump stretch, dash trail start, landing squash
- **Wait for server**: Death animations, respawn effects, damage reactions
- **Smooth corrections**: Use easing when server position differs from prediction
- **Fallback**: If prediction error > 50px, snap to server position

## Ideal Final Architecture

GameScene should be a thin orchestrator that:
1. **Initializes** all systems with proper dependencies
2. **Coordinates** communication between systems via events
3. **Manages** scene lifecycle (create, update, destroy)
4. **Delegates** all implementation details to appropriate modules

The goal is NOT to minimize lines at all costs, but to achieve:
- **Clarity**: Easy to understand what happens where
- **Maintainability**: Changes isolated to relevant modules
- **Extensibility**: New features slot into existing architecture
- **Testability**: Each module can be tested independently 