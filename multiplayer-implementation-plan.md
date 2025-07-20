# Team Battle Multiplayer Implementation Plan

## 🎯 Overview
Implementation plan for adding team-based multiplayer to Project DashFire using Colyseus and Node.js.

## 📋 Phases

### Phase 1: Foundation (Day 1)

#### Server Setup
- [x] Initialize Node.js server project
- [x] Install Colyseus and dependencies
- [x] Create basic server structure
- [x] Set up TeamBattleRoom with state schema
- [x] Implement basic player join/leave logic

#### Client Integration
- [x] Add Colyseus client to existing project
- [x] Create NetworkManager module
- [x] Connect to server on game start
- [x] Test basic connection/disconnection

### Issues Fixed:
- Fixed state synchronization timing issue where listeners were set before state was available
- Fixed communication between LobbyScene and GameScene using game registry
- Added proper TypeScript types to reduce type errors

### Phase 2: State Synchronization (Day 2) ✅ COMPLETE

#### Shared State Schema
```typescript
TeamBattleState
├── players: Map<string, Player>
│   ├── id: string
│   ├── x, y: number
│   ├── velocityX, velocityY: number
│   ├── health: number (100 max)
│   ├── team: "red" | "blue"
│   ├── isDashing: boolean
│   ├── flipX: boolean
│   └── respawnTimer: number
├── bullets: Array<Bullet>
│   ├── id: string
│   ├── x, y: number
│   ├── velocityX: number
│   └── ownerId: string
├── gameState: "waiting" | "playing" | "ended"
├── scores: { red: number, blue: number }
└── gameTime: number
```

#### Implementation Tasks
- [x] Define Colyseus schemas
- [x] Sync player movement (60Hz tick rate)
- [x] Implement client-side prediction
- [x] Add interpolation for remote players
- [x] Handle state reconciliation

### Phase 3: Combat & Game Logic (Day 3)

#### Server Authority
- [x] Server-side hit detection
- [x] Damage calculation
- [x] Death/respawn system
- [x] Team spawn points
- [x] Prevent friendly fire

#### Client Updates
- [x] Show remote players with team colors
- [x] Display health bars above players
- [ ] Add hit/death effects
- [ ] Implement kill feed
- [ ] Show respawn timer

### Phase 4: Team Features (Day 4)

#### Team Management
- [ ] Auto-balance teams on join
- [ ] Team selection screen (if not full)
- [ ] Spectator mode for full games
- [ ] Team chat system

#### UI Elements
- [ ] Team score display
- [ ] Player list by team
- [ ] Mini-map with team positions
- [ ] Victory/defeat screens

### Phase 5: Polish & Optimization (Day 5)

#### Performance
- [ ] Implement area of interest (only sync nearby players)
- [ ] Optimize message frequency
- [ ] Add lag compensation for shooting
- [ ] Client-side extrapolation

#### Quality of Life
- [ ] Reconnection handling
- [ ] AFK detection
- [ ] Match history
- [ ] Player statistics

## 🏗️ Technical Architecture

### Directory Structure
```
project-dashfire/
├── client/ (existing game)
│   ├── src/
│   │   ├── network/
│   │   │   ├── NetworkManager.ts
│   │   │   ├── RemotePlayer.ts
│   │   │   ├── NetworkBullet.ts
│   │   │   └── TeamHUD.ts
│   │   ├── scenes/
│   │   │   ├── GameScene.ts (modified)
│   │   │   ├── LobbyScene.ts (new)
│   │   │   └── TeamSelectScene.ts (new)
│   │   └── types/
│   │       └── colyseus-schema.ts
├── server/
│   ├── src/
│   │   ├── rooms/
│   │   │   ├── TeamBattleRoom.ts
│   │   │   └── schema/
│   │   │       ├── TeamBattleState.ts
│   │   │       ├── Player.ts
│   │   │       └── Bullet.ts
│   │   ├── index.ts
│   │   └── config.ts
│   ├── package.json
│   └── tsconfig.json
└── shared/
    └── constants.ts (shared between client/server)
```

### Network Flow
```
1. Client connects → LobbyScene
2. Player selects "Find Match"
3. Server assigns to room & team
4. Client transitions to GameScene
5. Continuous state sync begins
6. Player actions → Server validation → Broadcast
7. Match ends → Show results → Return to lobby
```

## 🎮 Game Configuration

### Match Settings
- **Tick Rate**: 60Hz for smooth gameplay
- **Max Players**: 8 (4v4) for balanced matches
- **Respawn Time**: 3 seconds
- **Match Duration**: 5 minutes or first to 30 kills
- **Physics**: Client-side with server validation

### Team Configuration
- **Team Colors**: Red (#FF6B6B) vs Blue (#4ECDC4)
- **Spawn Points**: Opposite sides of the arena
- **Friendly Fire**: Disabled
- **Team Balance**: Auto-balance on join

## 📡 Network Protocol

### Client → Server Messages
```typescript
interface ClientMessages {
  move: { x: number, y: number, velocityX: number, velocityY: number }
  shoot: { angle: number }
  dash: { directionX: number, directionY: number }
  respawn: {}
}
```

### Server → Client Messages
```typescript
interface ServerMessages {
  playerJoined: { player: Player }
  playerLeft: { playerId: string }
  playerHit: { playerId: string, damage: number }
  playerDied: { playerId: string, killerId: string }
  matchEnd: { winningTeam: string, stats: MatchStats }
}
```

## 🚀 Development Order

1. **Start Simple**: Get two players moving in sync
2. **Add Teams**: Colors and spawn points
3. **Add Combat**: Shooting and health
4. **Add Polish**: UI, effects, and optimizations

## 📊 Success Metrics

- [ ] < 100ms latency for smooth gameplay
- [ ] 60 FPS maintained with 8 players
- [ ] < 5 second matchmaking time
- [ ] Zero desync issues in 95% of matches
- [ ] Reconnection success rate > 90%

## 🔧 Tools & Dependencies

### Server
- Colyseus 0.15.x
- Node.js 18+
- TypeScript
- PM2 (production)

### Client
- Colyseus.js client
- Existing Phaser 3 setup
- TypeScript

### Development
- Colyseus Monitor (debugging)
- Chrome DevTools (network tab)
- Local testing with multiple clients

## 📝 Notes

- Start with local development, deploy to cloud later
- Use Colyseus Monitor for debugging room state
- Test with simulated latency (Chrome DevTools)
- Consider Docker for easy deployment
- Plan for horizontal scaling with multiple servers 