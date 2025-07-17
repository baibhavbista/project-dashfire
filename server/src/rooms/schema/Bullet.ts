import { Schema, type } from "@colyseus/schema";

export class Bullet extends Schema {
  @type("string") id: string;
  @type("number") x: number = 0;
  @type("number") y: number = 0;
  @type("number") velocityX: number = 0;
  @type("string") ownerId: string;
  @type("string") ownerTeam: "red" | "blue";

  constructor(id: string, x: number, y: number, velocityX: number, ownerId: string, ownerTeam: "red" | "blue") {
    super();
    
    // Validate inputs
    if (isNaN(x) || isNaN(y) || isNaN(velocityX)) {
      console.error("Bullet constructor received NaN values:", { id, x, y, velocityX });
      // Set safe defaults
      x = isNaN(x) ? 0 : x;
      y = isNaN(y) ? 0 : y;
      velocityX = isNaN(velocityX) ? 0 : velocityX;
    }
    
    this.id = id;
    this.x = x;
    this.y = y;
    this.velocityX = velocityX;
    this.ownerId = ownerId;
    this.ownerTeam = ownerTeam;
  }
} 