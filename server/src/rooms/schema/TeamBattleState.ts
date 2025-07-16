import { Schema, MapSchema, ArraySchema, type } from "@colyseus/schema";
import { Player } from "./Player";
import { Bullet } from "./Bullet";

export class TeamScore extends Schema {
  @type("number") red: number = 0;
  @type("number") blue: number = 0;
}

export class TeamBattleState extends Schema {
  @type({ map: Player }) players = new MapSchema<Player>();
  @type([Bullet]) bullets = new ArraySchema<Bullet>();
  @type("string") gameState: "waiting" | "playing" | "ended" = "waiting";
  @type(TeamScore) scores = new TeamScore();
  @type("number") gameTime: number = 0;
  @type("string") winningTeam: string = "";

  // Helper methods
  getPlayersInTeam(team: "red" | "blue"): Player[] {
    const teamPlayers: Player[] = [];
    this.players.forEach(player => {
      if (player.team === team) {
        teamPlayers.push(player);
      }
    });
    return teamPlayers;
  }

  getTeamCount(team: "red" | "blue"): number {
    return this.getPlayersInTeam(team).length;
  }

  addPlayer(id: string): Player {
    // Auto-balance teams
    const redCount = this.getTeamCount("red");
    const blueCount = this.getTeamCount("blue");
    const team = redCount <= blueCount ? "red" : "blue";
    
    const player = new Player(id, team);
    this.players.set(id, player);
    
    // Start game if we have enough players
    if (this.players.size >= 2 && this.gameState === "waiting") {
      this.gameState = "playing";
    }
    
    return player;
  }

  removePlayer(id: string): void {
    this.players.delete(id);
    
    // Check if game should end
    if (this.gameState === "playing") {
      const redCount = this.getTeamCount("red");
      const blueCount = this.getTeamCount("blue");
      
      if (redCount === 0 || blueCount === 0) {
        this.gameState = "ended";
        this.winningTeam = redCount > 0 ? "red" : "blue";
      }
    }
  }
} 