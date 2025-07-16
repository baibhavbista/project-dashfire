import * as Colyseus from "colyseus.js";
import Phaser from "phaser";
import type { RoomListing } from "../scenes/LobbyScene";

export interface PlayerData {
  id: string;
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  health: number;
  team: "red" | "blue";
  isDashing: boolean;
  flipX: boolean;
  isDead: boolean;
}

export interface BulletData {
  id: string;
  x: number;
  y: number;
  velocityX: number;
  ownerId: string;
  ownerTeam: "red" | "blue";
}

interface GameState {
  players: any;
  bullets: any;
  gameState: string;
  scores: { red: number; blue: number };
  gameTime: number;
}

export class NetworkManager extends Phaser.Events.EventEmitter {
  private client: Colyseus.Client;
  private room?: Colyseus.Room;
  private playerId?: string;
  private playerTeam?: "red" | "blue";
  private listenersSetup: boolean = false;
  
  constructor() {
    super();
    
    // Initialize Colyseus client
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const host = window.location.hostname;
    const port = 3000; // Your server port
    
    this.client = new Colyseus.Client(`${protocol}://${host}:${port}`);
  }

  async connect(method: string = 'joinOrCreate', options: Record<string, any> = {}): Promise<void> {
    try {
      // Connect using specified method
      if (method === 'create') {
        this.room = await this.client.create("team-battle", options);
      } else if (method === 'joinById') {
        this.room = await this.client.joinById(options.roomId, options);
      } else {
        this.room = await this.client.joinOrCreate("team-battle", options);
      }
      
      console.log("Connected! Session ID:", this.room.sessionId);
      
      // Listen for team assignment
      this.room.onMessage("team-assigned", (data) => {
        this.playerId = data.playerId;
        this.playerTeam = data.team;
        this.emit("team-assigned", data);
        console.log(`Connected to room ${data.roomId}. Assigned to team ${data.team} with ID ${data.playerId}`);
      });

      // Listen for match end
      this.room.onMessage("match-ended", (data) => {
        this.emit("match-ended", data);
      });
      
      // Listen for kill events
      this.room.onMessage("player-killed", (data) => {
        this.emit("player-killed", data);
      });

      // Listen for state changes
      this.room.onStateChange((state) => {
        this.emit("state-changed", state);
        
        // Set up listeners only after state is available AND we have our player ID
        if (!this.listenersSetup && state.players && state.bullets) {
          this.setupStateListeners(state);
          this.listenersSetup = true;
          
          // Process existing players after a delay to ensure we have our player ID
          if (this.playerId) {
            // Process existing players immediately if we already have our ID
            state.players.forEach((player: any, key: string) => {
              console.log("Initial player found:", key, player);
              // Add the player ID to the player data
              player.id = key;
              this.emit("player-added", player as PlayerData);
            });
          } else {
            // Wait for player ID before processing existing players
            const checkInterval = setInterval(() => {
              if (this.playerId) {
                clearInterval(checkInterval);
                state.players.forEach((player: any, key: string) => {
                  console.log("Initial player found after waiting:", key, player);
                  // Add the player ID to the player data
                  player.id = key;
                  this.emit("player-added", player as PlayerData);
                });
              }
            }, 50);
            
            // Timeout after 2 seconds
            setTimeout(() => clearInterval(checkInterval), 2000);
          }
        }
        
        // Process player position updates on every state change (after listeners are set up)
        if (state.players && this.listenersSetup) {
          try {
            state.players.forEach((player: any, key: string) => {
              // Add the player ID to the player data
              player.id = key;
              
              if (key === this.playerId) {
                // Emit our own position for reconciliation
                this.emit("local-player-server-update", { 
                  x: player.x, 
                  y: player.y,
                  health: player.health,
                  isDead: player.isDead,
                  respawnTimer: player.respawnTimer
                });
              } else {
                // Emit other players' updates
                this.emit("player-updated", player as PlayerData);
              }
            });
          } catch (error) {
            console.warn("Error processing player updates:", error);
          }
        }
      });

    } catch (error) {
      console.error("Failed to connect:", error);
      throw error;
    }
  }

  private setupStateListeners(state: GameState): void {
    // Track removed players to prevent updates after removal
    const removedPlayers = new Set<string>();
    
    // Listen for player updates
    state.players.onAdd = (player: any, key: string) => {
      console.log("Player joined:", key, player);
      // Add the player ID to the player data
      player.id = key;
      // Clear from removed set if they're rejoining
      removedPlayers.delete(key);
      this.emit("player-added", player as PlayerData);
    };

    state.players.onRemove = (player: PlayerData, key: string) => {
      console.log("Player left:", key);
      removedPlayers.add(key);
      this.emit("player-removed", key);
    };

    // Listen for bullet updates
    state.bullets.onAdd = (bullet: BulletData) => {
      this.emit("bullet-added", bullet);
    };

    state.bullets.onRemove = (bullet: BulletData) => {
      this.emit("bullet-removed", bullet);
    };
  }

  sendMovement(data: { x: number; y: number; velocityX: number; velocityY: number; flipX: boolean }): void {
    if (!this.room) return;
    this.room.send("move", data);
  }

  sendDash(isDashing: boolean): void {
    if (!this.room) return;
    this.room.send("dash", { isDashing });
  }

  sendShoot(data: { x: number; y: number; velocityX: number }): void {
    if (!this.room) return;
    this.room.send("shoot", data);
  }

  disconnect(): void {
    if (this.room) {
      this.room.leave();
      this.room = undefined;
    }
  }

  getPlayerId(): string | undefined {
    return this.playerId;
  }

  getPlayerTeam(): "red" | "blue" | undefined {
    return this.playerTeam;
  }

  getRoom(): Colyseus.Room | undefined {
    return this.room;
  }
  
  // No longer needed - existing players are processed in onStateChange
  /*
  processExistingPlayers(): void {
    if (!this.room?.state?.players) return;
    
    const state = this.room.state as GameState;
    console.log("Processing existing players in room...");
    
    // Check if state.players is a MapSchema with forEach
    if (state.players && typeof state.players.forEach === 'function') {
      state.players.forEach((player: any, key: string) => {
        console.log("Found existing player:", key, player);
        // Add the player ID to the player data
        player.id = key;
        this.emit("player-added", player as PlayerData);
      });
    } else {
      console.log("No forEach method available on players");
    }
  }
  */

  async getAvailableRooms(roomName: string = "team-battle"): Promise<RoomListing[]> {
    try {
      // Construct the URL for fetching available rooms
      const protocol = window.location.protocol;
      const host = window.location.hostname;
      const port = 3000;
      
      const response = await fetch(`${protocol}//${host}:${port}/api/rooms/${roomName}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const rooms = await response.json();
      return rooms;
    } catch (error) {
      console.error("Failed to fetch available rooms:", error);
      return [];
    }
  }
} 