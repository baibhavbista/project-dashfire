import Phaser from 'phaser';

export class SoundManager {
  private scene: Phaser.Scene;
  private jumpSound?: Phaser.Sound.BaseSound;
  private dashSound?: Phaser.Sound.BaseSound;
  private shootSound?: Phaser.Sound.BaseSound;
  
  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.createSounds();
  }

  private createSounds(): void {
    // Create jump sound (short rising tone)
    this.jumpSound = this.scene.sound.add('jump', { 
      volume: 0.3,
      rate: 1.2
    });

    // Create dash sound (whoosh effect)
    this.dashSound = this.scene.sound.add('dash', {
      volume: 0.4,
      rate: 1.0
    });

    // Create shoot sound (laser pew)
    this.shootSound = this.scene.sound.add('shoot', {
      volume: 0.6,
      rate: 1.3
    });
  }

  playJump(): void {
    this.jumpSound?.play();
  }

  playDash(): void {
    this.dashSound?.play();
  }

  playShoot(): void {
    this.shootSound?.play();
  }

  // Generate simple sound data URIs
  static generateSoundDataURIs(): { [key: string]: string } {
    return {
      jump: this.generateJumpSound(),
      dash: this.generateDashSound(),
      shoot: this.generateShootSound()
    };
  }

  // Generate a bouncy jump sound with two-tone blip
  private static generateJumpSound(): string {
    const sampleRate = 22050;
    const duration = 0.12;
    const samples = sampleRate * duration;
    const data = new Uint8Array(44 + samples);
    
    // WAV header
    const setString = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) {
        data[offset + i] = str.charCodeAt(i);
      }
    };
    
    setString(0, 'RIFF');
    data[4] = (36 + samples) & 0xff;
    data[5] = ((36 + samples) >> 8) & 0xff;
    setString(8, 'WAVEfmt ');
    data[16] = 16; // fmt chunk size
    data[20] = 1; // PCM
    data[22] = 1; // mono
    data[24] = sampleRate & 0xff;
    data[25] = (sampleRate >> 8) & 0xff;
    data[28] = sampleRate & 0xff;
    data[29] = (sampleRate >> 8) & 0xff;
    data[32] = 1; // block align
    data[34] = 8; // bits per sample
    setString(36, 'data');
    data[40] = samples & 0xff;
    data[41] = (samples >> 8) & 0xff;
    
    // Generate a two-tone jump sound (like Mario coin but for jumping)
    for (let i = 0; i < samples; i++) {
      const t = i / sampleRate;
      
      // Two distinct tones
      const firstTone = t < 0.05;
      const secondTone = t >= 0.05 && t < 0.12;
      
      let frequency = 0;
      let amplitude = 0;
      
      if (firstTone) {
        // First tone: 400Hz with quick attack
        frequency = 400;
        amplitude = (t / 0.05) * Math.exp(-t * 20);
      } else if (secondTone) {
        // Second tone: Jump to 800Hz
        frequency = 800;
        const localT = (t - 0.05) / 0.07;
        amplitude = Math.exp(-localT * 8) * 0.8;
      }
      
      // Add a slight pitch bend upward
      frequency += (t * 200);
      
      // Generate a triangle wave for retro feel
      const phase = (frequency * t) % 1;
      const triangleWave = phase < 0.5 ? (phase * 4 - 1) : (3 - phase * 4);
      
      data[44 + i] = 128 + triangleWave * amplitude * 70;
    }
    
    // Convert to base64
    let binary = '';
    for (let i = 0; i < data.length; i++) {
      binary += String.fromCharCode(data[i]);
    }
    return 'data:audio/wav;base64,' + btoa(binary);
  }

  // Generate a dash/zip sound with frequency sweep
  private static generateDashSound(): string {
    const sampleRate = 22050;
    const duration = 0.15;
    const samples = sampleRate * duration;
    const data = new Uint8Array(44 + samples);
    
    // WAV header (same as above)
    const setString = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) {
        data[offset + i] = str.charCodeAt(i);
      }
    };
    
    setString(0, 'RIFF');
    data[4] = (36 + samples) & 0xff;
    data[5] = ((36 + samples) >> 8) & 0xff;
    setString(8, 'WAVEfmt ');
    data[16] = 16;
    data[20] = 1;
    data[22] = 1;
    data[24] = sampleRate & 0xff;
    data[25] = (sampleRate >> 8) & 0xff;
    data[28] = sampleRate & 0xff;
    data[29] = (sampleRate >> 8) & 0xff;
    data[32] = 1;
    data[34] = 8;
    setString(36, 'data');
    data[40] = samples & 0xff;
    data[41] = (samples >> 8) & 0xff;
    
    // Generate a frequency sweep with resonance
    for (let i = 0; i < samples; i++) {
      const t = i / sampleRate;
      
      // Fast exponential sweep from high to low
      const startFreq = 2000;
      const endFreq = 100;
      const frequency = startFreq * Math.pow(endFreq / startFreq, t / duration);
      
      // Quick attack, sustained release envelope
      const envelope = t < 0.01 ? t / 0.01 : Math.pow(1 - (t - 0.01) / (duration - 0.01), 0.3);
      
      // Generate the wave with some harmonics for richness
      const fundamental = Math.sin(2 * Math.PI * frequency * t);
      const harmonic = Math.sin(4 * Math.PI * frequency * t) * 0.3;
      const subharmonic = Math.sin(Math.PI * frequency * t) * 0.2;
      
      const wave = (fundamental + harmonic + subharmonic) / 1.5;
      
      data[44 + i] = 128 + wave * envelope * 60;
    }
    
    let binary = '';
    for (let i = 0; i < data.length; i++) {
      binary += String.fromCharCode(data[i]);
    }
    return 'data:audio/wav;base64,' + btoa(binary);
  }

  // Generate a punchy mechanical gun sound
  private static generateShootSound(): string {
    const sampleRate = 22050;
    const duration = 0.08;
    const samples = sampleRate * duration;
    const data = new Uint8Array(44 + samples);
    
    // WAV header
    const setString = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) {
        data[offset + i] = str.charCodeAt(i);
      }
    };
    
    setString(0, 'RIFF');
    data[4] = (36 + samples) & 0xff;
    data[5] = ((36 + samples) >> 8) & 0xff;
    setString(8, 'WAVEfmt ');
    data[16] = 16;
    data[20] = 1;
    data[22] = 1;
    data[24] = sampleRate & 0xff;
    data[25] = (sampleRate >> 8) & 0xff;
    data[28] = sampleRate & 0xff;
    data[29] = (sampleRate >> 8) & 0xff;
    data[32] = 1;
    data[34] = 8;
    setString(36, 'data');
    data[40] = samples & 0xff;
    data[41] = (samples >> 8) & 0xff;
    
    // Generate a punchy "pop" sound with noise burst
    for (let i = 0; i < samples; i++) {
      const t = i / sampleRate;
      
      // Three phases: click, burst, tail
      let sound = 0;
      
      if (t < 0.005) {
        // Initial click/impact
        const clickEnv = 1 - (t / 0.005);
        sound = (Math.random() - 0.5) * clickEnv;
      } else if (t < 0.03) {
        // Main burst - filtered noise
        const burstT = (t - 0.005) / 0.025;
        const burstEnv = Math.exp(-burstT * 15);
        
        // Low-passed noise for body
        const noise = (Math.random() - 0.5);
        const filtered = noise * 0.7 + sound * 0.3; // Simple low-pass
        
        // Add some tonal element
        const tone = Math.sin(2 * Math.PI * 150 * t);
        
        sound = (filtered * 0.8 + tone * 0.2) * burstEnv;
      } else {
        // Quick tail/echo
        const tailT = (t - 0.03) / 0.05;
        const tailEnv = Math.exp(-tailT * 20);
        sound = (Math.random() - 0.5) * 0.3 * tailEnv;
      }
      
      data[44 + i] = 128 + sound * 120;
    }
    
    let binary = '';
    for (let i = 0; i < data.length; i++) {
      binary += String.fromCharCode(data[i]);
    }
    return 'data:audio/wav;base64,' + btoa(binary);
  }
} 