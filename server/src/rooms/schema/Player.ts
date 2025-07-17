import { Schema, type } from "@colyseus/schema";

export class Player extends Schema {
  @type("string") id: string;
  @type("string") name: string = "Unknown";
  @type("number") x: number = 0;
  @type("number") y: number = 0;
  @type("number") velocityX: number = 0;
  @type("number") velocityY: number = 0;
  @type("number") health: number = 100;
  @type("string") team: "red" | "blue" = "red";
  @type("boolean") isDashing: boolean = false;
  @type("boolean") flipX: boolean = false;
  @type("number") respawnTimer: number = 0;
  @type("boolean") isDead: boolean = false;

  constructor(id: string, team: "red" | "blue", name?: string) {
    super();
    this.id = id;
    this.team = team;
    this.name = name || `Player${id.substring(0, 4)}`;
    
    // Set initial spawn position based on team
    if (team === "red") {
      this.x = 200;
      this.y = 500;
    } else {
      this.x = 2800; // Near the right side of the arena
      this.y = 500;
    }
  }
} 