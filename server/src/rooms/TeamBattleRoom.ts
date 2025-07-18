import { Room, Client } from "@colyseus/core";
import { TeamBattleState } from "./schema/TeamBattleState";
import { Player } from "./schema/Player";
import { Bullet } from "./schema/Bullet";
import { checkBulletPlatformCollision } from "../../../shared/WorldGeometry";
import { SHARED_CONFIG } from "../../../shared/GameConstants";

export class TeamBattleRoom extends Room<TeamBattleState> {
  maxClients = 8; // 4v4

  onCreate(_options: any) {
    this.setState(new TeamBattleState());
    
    // Set up message handlers
    this.onMessage("move", (client, data) => {
      const player = this.state.players.get(client.sessionId);
      if (player && !player.isDead) {
        player.x = data.x;
        player.y = data.y;
        player.velocityX = data.velocityX;
        player.velocityY = data.velocityY;
        player.flipX = data.flipX;
      }
    });

    this.onMessage("dash", (client, data) => {
      const player = this.state.players.get(client.sessionId);
      if (player && !player.isDead) {
        player.isDashing = data.isDashing;
      }
    });

    this.onMessage("shoot", (client, data) => {
      const player = this.state.players.get(client.sessionId);
      if (player && !player.isDead && this.state.gameState === "playing") {
        // Validate basic bullet position data
        if (!data || isNaN(data.x) || isNaN(data.y)) {
          console.error(`Invalid shoot data from ${client.sessionId}:`, data);
          return;
        }
        
        // Server calculates velocity based on player direction
        const direction = player.flipX ? -1 : 1;
        const velocityX = SHARED_CONFIG.BULLET.SPEED * direction;
        
        // Create bullet
        const bulletId = `${client.sessionId}-${Date.now()}`;
        const bullet = new Bullet(
          bulletId,
          data.x,
          data.y,
          velocityX,  // Server-calculated velocity
          client.sessionId,
          player.team
        );
        
        // Final validation before adding
        if (isNaN(bullet.x) || isNaN(bullet.y) || isNaN(bullet.velocityX)) {
          console.error(`Bullet creation resulted in NaN values:`, {
            x: bullet.x,
            y: bullet.y,
            velocityX: bullet.velocityX,
            id: bullet.id
          });
          return;
        }
        
        this.state.bullets.push(bullet);
        
        // Remove bullet after lifetime expires
        this.clock.setTimeout(() => {
          const index = this.state.bullets.findIndex(b => b.id === bulletId);
          if (index !== -1) {
            this.state.bullets.splice(index, 1);
          }
        }, SHARED_CONFIG.BULLET.LIFETIME_MS);
      }
    });
    
    // Set up tick rate (60 FPS)
    this.setSimulationInterval((deltaTime) => this.update(deltaTime), 1000 / 60);
    
    // Update room metadata
    this.updateRoomMetadata();
    
    console.log(`TeamBattleRoom created with ID: ${this.roomId}`);
  }

  onJoin(client: Client, options: any) {
    console.log(`Room ${this.roomId}: Player ${client.sessionId} joined!`);
    
    const playerName = options?.name || `Player${client.sessionId.substring(0, 4)}`;
    const player = this.state.addPlayer(client.sessionId, playerName);
    
    // Log current state
    console.log(`Room ${this.roomId}: Current players count: ${this.state.players.size}`);
    this.state.players.forEach((p, id) => {
      console.log(`  - Player ${id}: team ${p.team}, pos (${p.x}, ${p.y}), name: ${p.name}`);
    });
    
    // Notify client of their team
    client.send("team-assigned", { 
      team: player.team,
      playerId: client.sessionId,
      roomId: this.roomId,
      playerName: player.name
    });
    
    // Update metadata (including potential game state change)
    this.updateRoomMetadata();
  }

  onLeave(client: Client, consented: boolean) {
    console.log(`Room ${this.roomId}: Player ${client.sessionId} left!`);
    
    this.state.removePlayer(client.sessionId);
    
    // Update metadata
    this.updateRoomMetadata();
  }

  onDispose() {
    console.log(`Room ${this.roomId} disposing...`);
  }
  
  updateRoomMetadata() {
    const redCount = this.state.getTeamCount("red");
    const blueCount = this.state.getTeamCount("blue");
    
    this.setMetadata({
      redCount,
      blueCount,
      gameState: this.state.gameState
    });
  }

  update(deltaTime: number) {
    // Only update if game is playing
    if (this.state.gameState !== "playing") return;
    
    // Defensive check for deltaTime
    if (!deltaTime || isNaN(deltaTime)) {
      console.error("Invalid deltaTime:", deltaTime);
      return;
    }

    // Update game time
    this.state.gameTime += deltaTime;

    // Update respawn timers
    this.state.players.forEach(player => {
      if (player.isDead && player.respawnTimer > 0) {
        player.respawnTimer -= deltaTime;
        if (player.respawnTimer <= 0) {
          // Respawn player
          player.isDead = false;
          player.health = 100;
          
          // Reset position to team spawn
          if (player.team === "red") {
            player.x = 200;
            player.y = 500;
          } else {
            player.x = 2800;
            player.y = 500;
          }
        }
      }
    });

    // Simple bullet collision (will be improved later)
    const bulletsToRemove: number[] = [];
    
    this.state.bullets.forEach((bullet, index) => {
      // Defensive checks for bullet data
      if (isNaN(bullet.x) || isNaN(bullet.velocityX)) {
        console.error(`Invalid bullet data: x=${bullet.x}, velocityX=${bullet.velocityX}, id=${bullet.id}`);
        bulletsToRemove.push(index);
        return;
      }
      
      // First check collision with players at current position
      let bulletHit = false;
      for (const player of this.state.players.values()) {
        if (player.id !== bullet.ownerId && 
            player.team !== bullet.ownerTeam && 
            !player.isDead &&
            Math.abs(player.x - bullet.x) < 20 &&
            Math.abs(player.y - bullet.y) < 24) {
          
          // Hit detected
          player.health -= SHARED_CONFIG.BULLET.DAMAGE;
          
          if (player.health <= 0) {
            player.isDead = true;
            player.health = 0;
            player.respawnTimer = 3000; // 3 seconds
            
            // Get killer player for the name
            const killer = this.state.players.get(bullet.ownerId);
            
            // Broadcast kill event
            this.broadcast("player-killed", {
              killerId: bullet.ownerId,
              victimId: player.id,
              killerName: killer?.name || "Unknown",
              victimName: player.name
            });
            
            // Update score
            if (bullet.ownerTeam === "red") {
              this.state.scores.red++;
            } else {
              this.state.scores.blue++;
            }
            
            // Check win condition
            if (this.state.scores.red >= 30 || this.state.scores.blue >= 30) {
              this.state.gameState = "ended";
              this.state.winningTeam = this.state.scores.red >= 30 ? "red" : "blue";
              this.updateRoomMetadata();
              this.broadcast("match-ended", {
                winningTeam: this.state.winningTeam,
                scores: this.state.scores
              });
            }
          }
          
          // Mark bullet for removal and stop checking other players
          bulletsToRemove.push(index);
          bulletHit = true;
          break;
        }
      }
      
      // If bullet didn't hit anyone, update its position
      if (!bulletHit) {
        // Update bullet position
        const deltaSeconds = deltaTime / 1000;
        const movement = bullet.velocityX * deltaSeconds;
        
        if (isNaN(movement)) {
          console.error(`NaN movement for bullet ${bullet.id}: velocityX=${bullet.velocityX}, deltaSeconds=${deltaSeconds}`);
          bulletsToRemove.push(index);
          return;
        }
        
        bullet.x += movement;
        
        // Check collision with platforms
        const platformHit = checkBulletPlatformCollision({
          x: bullet.x,
          y: bullet.y,
          width: SHARED_CONFIG.BULLET.WIDTH,
          height: SHARED_CONFIG.BULLET.HEIGHT
        });
        
        if (platformHit) {
          // Bullet hit a platform, mark for removal
          bulletsToRemove.push(index);
        } else if (bullet.x < -100 || bullet.x > 3100) {
          // Remove bullets that are off-screen
          bulletsToRemove.push(index);
        }
      }
    });
    
    // Remove bullets that hit or went off-screen
    bulletsToRemove.sort((a, b) => b - a); // Sort in reverse order
    const uniqueIndices = [...new Set(bulletsToRemove)]; // Remove duplicates
    uniqueIndices.forEach(index => {
      if (index >= 0 && index < this.state.bullets.length) {
        this.state.bullets.splice(index, 1);
      }
    });
  }
} 