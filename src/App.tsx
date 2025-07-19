import React, { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { GameScene } from './GameScene';
import { LobbyScene } from './scenes/LobbyScene';

function App() {
  const gameRef = useRef<Phaser.Game | null>(null);
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mountRef.current) return;

    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      width: 1024,
      height: 768,
      parent: mountRef.current,
      backgroundColor: '#87CEEB',
      physics: {
        default: 'arcade',
        arcade: {
          gravity: { y: 800, x: 0 },
          debug: false
        }
      },
      scene: [GameScene, LobbyScene]
    };

    gameRef.current = new Phaser.Game(config);

    return () => {
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="bg-white p-4 rounded-lg shadow-lg">
        <h1 className="text-2xl font-bold text-center mb-4 text-gray-800">
          Platformer Arena
        </h1>
        <div ref={mountRef} className="border-2 border-gray-300 rounded" />
        <div className="mt-4 text-sm text-gray-600 text-center">
          <p><strong>Controls:</strong> Arrow Keys to move, Down to crouch (hides gun), D to jump, S to dash (midair only), A or Space to shoot</p>
          {/* Comment out debug because don't want the user to see it */}
          {/* <p><strong>Debug:</strong> Press B to toggle bounding box visualization</p> */}
          <p>Explore the arena and prepare for battle!</p>
        </div>
        <div className="mt-4 text-center">
          <button 
            onClick={() => {
              // Switch to lobby scene
              const game = gameRef.current;
              if (game && game.scene) {
                game.scene.start('LobbyScene');
              }
            }}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            Join Multiplayer
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;