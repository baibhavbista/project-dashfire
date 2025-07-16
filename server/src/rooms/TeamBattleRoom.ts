import { Room, Client } from "colyseus";
import { TeamBattleState } from "./schema/TeamBattleState";
import { Bullet } from "./schema/Bullet";

export class TeamBattleRoom extends Room<TeamBattleState> {
  maxClients = 8; // 4v4 maximum
  patchRate = 60; // 60 FPS

  onCreate(_options: any) {
    this.setState(new TeamBattleState());
    
    // Set initial metadata
    this.setMetadata({
      redCount: 0,
      blueCount: 0,
      gameState: "waiting"
    });
    
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
        // Create bullet
        const bulletId = `${client.sessionId}-${Date.now()}`;
        const bullet = new Bullet(
          bulletId,
          data.x,
          data.y,
          data.velocityX,
          client.sessionId,
          player.team
        );
        this.state.bullets.push(bullet);
        
        // Remove bullet after 3 seconds
        this.clock.setTimeout(() => {
          const index = this.state.bullets.findIndex(b => b.id === bulletId);
          if (index !== -1) {
            this.state.bullets.splice(index, 1);
          }
        }, 3000);
      }
    });

    // Set up game loop (60 FPS)
    this.setSimulationInterval((deltaTime) => {
      this.update(deltaTime);
    }, 1000 / 60);

    console.log(`TeamBattleRoom created with ID: ${this.roomId}`);
  }

  onJoin(client: Client, options: any) {
    console.log(`Room ${this.roomId}: Player ${client.sessionId} joined!`);
    
    const player = this.state.addPlayer(client.sessionId);
    
    // Log current state
    console.log(`Room ${this.roomId}: Current players count: ${this.state.players.size}`);
    this.state.players.forEach((p, id) => {
      console.log(`  - Player ${id}: team ${p.team}, pos (${p.x}, ${p.y})`);
    });
    
    // Notify client of their team
    client.send("team-assigned", { 
      team: player.team,
      playerId: client.sessionId,
      roomId: this.roomId
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
      // Update bullet position
      bullet.x += bullet.velocityX * (deltaTime / 1000);
      
      // Remove bullets that are off-screen
      if (bullet.x < -100 || bullet.x > 3100) {
        bulletsToRemove.push(index);
        return;
      }
      
      // Check collision with players
      this.state.players.forEach(player => {
        if (player.id !== bullet.ownerId && 
            player.team !== bullet.ownerTeam && 
            !player.isDead &&
            Math.abs(player.x - bullet.x) < 20 &&
            Math.abs(player.y - bullet.y) < 24) {
          
          // Hit detected
          player.health -= 10; // 10 damage per bullet
          
          if (player.health <= 0) {
            player.isDead = true;
            player.health = 0;
            player.respawnTimer = 3000; // 3 seconds
            
            // Broadcast kill event
            this.broadcast("player-killed", {
              killerId: bullet.ownerId,
              victimId: player.id,
              killerName: `Player ${bullet.ownerId.substring(0, 4)}`,
              victimName: `Player ${player.id.substring(0, 4)}`
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
          
          // Mark bullet for removal
          bulletsToRemove.push(index);
        }
      });
    });
    
    // Remove bullets that hit or went off-screen
    bulletsToRemove.sort((a, b) => b - a); // Sort in reverse order
    bulletsToRemove.forEach(index => {
      this.state.bullets.splice(index, 1);
    });
  }
} 