import Phaser from 'phaser';
import { NetworkManager } from '../network/NetworkManager';

export interface RoomListing {
  roomId: string;
  clients: number;
  maxClients: number;
  metadata?: {
    redCount?: number;
    blueCount?: number;
    gameState?: string;
  };
}

export class LobbyScene extends Phaser.Scene {
  private networkManager?: NetworkManager;
  private roomListText?: Phaser.GameObjects.Text;
  private statusText?: Phaser.GameObjects.Text;
  private availableRooms: RoomListing[] = [];
  private selectedRoomIndex: number = -1;
  private roomButtons: Phaser.GameObjects.Rectangle[] = [];
  private roomTexts: Phaser.GameObjects.Text[] = [];
  private roomListContainer?: Phaser.GameObjects.Container;
  private refreshButton?: Phaser.GameObjects.Rectangle;
  private createButton?: Phaser.GameObjects.Rectangle;
  private rooms: RoomListing[] = [];
  private playerNameInput?: Phaser.GameObjects.DOMElement;
  private playerName: string = "";
  
  constructor() {
    super({ key: 'LobbyScene' });
  }
  
  create() {
    // Title
    this.add.text(512, 50, 'Multiplayer Lobby', { 
      fontSize: '32px', 
      color: '#ffffff' 
    }).setOrigin(0.5);
    
    // Instructions
    this.add.text(512, 100, 'Select a room to join or create a new one', { 
      fontSize: '16px',
      color: '#cccccc' 
    }).setOrigin(0.5);
    
    // Status text
    this.statusText = this.add.text(512, 140, 'Connecting to server...', { 
      fontSize: '14px', 
      color: '#ffff00' 
    }).setOrigin(0.5);
    
    // Player name input
    this.add.text(512, 170, 'Your Name:', {
      fontSize: '16px',
      color: '#ffffff'
    }).setOrigin(0.5);
    
    // Generate random default name
    this.playerName = `Player${Math.floor(Math.random() * 10000)}`;
    
    // Name display (acts as input field)
    const nameText = this.add.text(512, 195, this.playerName, {
      fontSize: '20px',
      color: '#00ff00',
      backgroundColor: '#333333',
      padding: { x: 20, y: 10 }
    }).setOrigin(0.5)
      .setInteractive()
      .on('pointerdown', () => {
        // Simple name input using browser prompt
        const newName = prompt('Enter your name:', this.playerName);
        if (newName && newName.trim().length > 0) {
          this.playerName = newName.trim().substring(0, 20); // Limit to 20 chars
          nameText.setText(this.playerName);
        }
      });
    
    // Room list header
    this.add.text(300, 240, 'Available Rooms:', { 
      fontSize: '20px',
      color: '#ffffff'
    });
    
    // Create new room button
    const createButton = this.add.rectangle(512, 600, 200, 50, 0x00ff00)
      .setInteractive()
      .on('pointerover', () => createButton.setFillStyle(0x00dd00))
      .on('pointerout', () => createButton.setFillStyle(0x00ff00))
      .on('pointerdown', () => this.createNewRoom());
      
    this.add.text(512, 600, 'Create New Room', { 
      fontSize: '18px', 
      color: '#000000' 
    }).setOrigin(0.5);
    
    // Back button
    const backButton = this.add.rectangle(512, 660, 200, 50, 0xff0000)
      .setInteractive()
      .on('pointerover', () => backButton.setFillStyle(0xdd0000))
      .on('pointerout', () => backButton.setFillStyle(0xff0000))
      .on('pointerdown', () => this.scene.start('MainMenuScene'));
      
    this.add.text(512, 660, 'Back to Menu', { 
      fontSize: '18px', 
      color: '#ffffff' 
    }).setOrigin(0.5);
    
    // Initialize network manager and fetch rooms
    this.initializeNetwork();
  }
  
  async initializeNetwork() {
    this.networkManager = new NetworkManager();
    
    try {
      // Get available rooms
      await this.refreshRoomList();
      this.statusText?.setText('Connected! Select a room or create a new one.');
      this.statusText?.setColor('#00ff00');
      
      // Refresh room list every 2 seconds
      this.time.addEvent({
        delay: 2000,
        callback: () => this.refreshRoomList(),
        loop: true
      });
    } catch (error) {
      console.error('Failed to connect to lobby:', error);
      this.statusText?.setText('Failed to connect to server!');
      this.statusText?.setColor('#ff0000');
    }
  }
  
  async refreshRoomList() {
    if (!this.networkManager) return;
    
    try {
      // Get available rooms from the server
      this.availableRooms = await this.networkManager.getAvailableRooms("team-battle");
      
      // Clear existing room displays
      this.roomButtons.forEach(btn => btn.destroy());
      this.roomTexts.forEach(txt => txt.destroy());
      this.roomButtons = [];
      this.roomTexts = [];
      
      // Display rooms
      this.availableRooms.forEach((room, index) => {
        const y = 280 + (index * 60);
        
        // Room button
        const button = this.add.rectangle(512, y, 600, 50, 0x333333)
          .setInteractive()
          .on('pointerover', () => {
            button.setFillStyle(0x555555);
            this.selectedRoomIndex = index;
          })
          .on('pointerout', () => {
            button.setFillStyle(0x333333);
            if (this.selectedRoomIndex === index) this.selectedRoomIndex = -1;
          })
          .on('pointerdown', () => this.joinRoom(room.roomId));
          
        // Room info text
        const redCount = room.metadata?.redCount || 0;
        const blueCount = room.metadata?.blueCount || 0;
        const gameState = room.metadata?.gameState || 'waiting';
        
        const roomText = this.add.text(512, y, 
          `Room ${room.roomId.substring(0, 8)}... | Players: ${room.clients}/${room.maxClients} | Red: ${redCount} Blue: ${blueCount} | Status: ${gameState}`, 
          { 
            fontSize: '16px', 
            color: '#ffffff' 
          }
        ).setOrigin(0.5);
        
        this.roomButtons.push(button);
        this.roomTexts.push(roomText);
      });
      
      if (this.availableRooms.length === 0) {
        this.add.text(512, 250, 'No rooms available. Create a new one!', { 
          fontSize: '18px', 
          color: '#aaaaaa' 
        }).setOrigin(0.5);
      }
    } catch (error) {
      console.error('Failed to fetch room list:', error);
    }
  }
  
  async createNewRoom() {
    if (!this.networkManager) return;
    
    this.statusText?.setText('Creating new room...');
    this.statusText?.setColor('#ffff00');
    
    try {
      await this.networkManager.connect('create', { name: this.playerName });
      this.transitionToGame();
    } catch (error) {
      console.error('Failed to create room:', error);
      this.statusText?.setText('Failed to create room!');
      this.statusText?.setColor('#ff0000');
    }
  }
  
  async joinRoom(roomId: string) {
    if (!this.networkManager) return;
    
    this.statusText?.setText(`Joining room ${roomId.substring(0, 8)}...`);
    this.statusText?.setColor('#ffff00');
    
    try {
      await this.networkManager.connect('joinById', { roomId, name: this.playerName });
      this.transitionToGame();
    } catch (error) {
      console.error('Failed to join room:', error);
      this.statusText?.setText('Failed to join room! It might be full.');
      this.statusText?.setColor('#ff0000');
    }
  }
  
  transitionToGame() {
    // Store network manager in game registry for GameScene to access
    this.game.registry.set('networkManager', this.networkManager);
    this.game.registry.set('isMultiplayer', true);
    
    this.scene.start('GameScene');
  }
  
  shutdown() {
    // Clean up if we leave the lobby without connecting
    if (this.networkManager && !this.networkManager.getRoom()) {
      this.networkManager = undefined;
    }
  }
} 