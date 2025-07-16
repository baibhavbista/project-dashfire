import React, { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { GameScene } from './GameScene';

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
      scene: GameScene
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
          <p><strong>Controls:</strong> Arrow Keys to move, D to jump, S to dash (midair only), A or Space to shoot</p>
          <p>Explore the arena and prepare for battle!</p>
        </div>
      </div>
    </div>
  );
}

export default App;