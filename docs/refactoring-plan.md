# GameScene Refactoring Plan

## Overview
This document outlines the plan to refactor the monolithic 1433-line `GameScene.ts` into a modular, maintainable architecture. The primary goal is to make the codebase easier to understand, modify, and extend.

## Current Issues
1. **Monolithic GameScene**: 1433 lines handling 15+ responsibilities
2. **Scattered Configuration**: Colors and constants hardcoded throughout
3. **Code Duplication**: Remote players duplicate animation/effect logic
4. **Tight Coupling**: Systems directly manipulate each other's state
5. **Poor Separation of Concerns**: UI, physics, networking, and rendering intertwined

## Refactoring Goals
- **Break up GameScene** from 1433 lines to ~200 lines
- **Centralize all configuration** (colors, physics constants)
- **Eliminate duplication** between local and remote players
- **Create focused modules** with single responsibilities
- **Maintain current functionality** with no regressions
- **Keep game playable** throughout refactoring

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

*Total estimated time: 21 hours*

### Phase 1: Configuration Extraction (2 hours)
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

### Phase 6: Effects System (2 hours)
**Goal**: Centralized particle management

1. **Create `EffectsSystem.ts`**:
   - Particle pools
   - Dash trails
   - Death effects
   - Bullet impacts
   - Landing dust

2. **Add cleanup methods**
3. **Test**: Effects trigger correctly

### Phase 7: Combat System (2 hours)
**Goal**: Extract combat logic

1. **Create `CombatSystem.ts`**:
   - Bullet management
   - Hit detection
   - Damage calculation
   - Death/respawn logic

2. **Integrate with** existing WeaponSystem
3. **Test**: Combat works as before

### Phase 8: GameScene Cleanup (2 hours)
**Goal**: Minimal orchestrator

1. **Remove all extracted code**
2. **Wire up system communication**:
   ```typescript
   create() {
     this.playerSystem = new PlayerSystem(this);
     this.movementSystem = new MovementSystem(this);
     // ... etc
     
     // Wire events
     this.events.on('player:jump', this.handleJump, this);
   }
   ```

3. **Final size**: ~200 lines
4. **Test**: Everything works together

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
- [ ] GameScene < 250 lines
- [ ] No color/constant duplication
- [ ] Remote players use same systems as local
- [ ] All current features work
- [ ] Code is modular and focused
- [ ] Easy to add new weapons/features

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