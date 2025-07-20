import React, { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { MainMenuScene } from './scenes/MainMenuScene';
import { GameScene } from './GameScene';
import { LobbyScene } from './scenes/LobbyScene';

function App() {
  const gameRef = useRef<Phaser.Game | null>(null);
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mountRef.current) return;

    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      parent: mountRef.current,
      backgroundColor: '#1B2C59',
      physics: {
        default: 'arcade',
        arcade: {
          gravity: { y: 800, x: 0 },
          debug: false
        }
      },
      scale: {
        mode: Phaser.Scale.RESIZE,
        parent: mountRef.current,
        width: '100%',
        height: '100%'
      },
      scene: [MainMenuScene, GameScene, LobbyScene]
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
    <div ref={mountRef} className="w-screen h-screen" style={{ backgroundColor: '#1B2C59' }} />
  );
}

export default App;