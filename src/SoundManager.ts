import Phaser from 'phaser';

export class SoundManager {
  private scene: Phaser.Scene;
  private jumpSound?: Phaser.Sound.BaseSound;
  private dashSound?: Phaser.Sound.BaseSound;
  private shootSound?: Phaser.Sound.BaseSound;
  private hitSound?: Phaser.Sound.BaseSound;
  private deathSound?: Phaser.Sound.BaseSound;
  
  // Base volumes for each sound effect
  private baseVolumes = {
    jump: 0.6,
    dash: 0.6,
    shoot: 0.8,
    hit: 0.8,
    death: 0.8
  };
  
  private currentSfxVolume: number = 0.5;
  
  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.createSounds();
    this.setupVolumeListener();
  }

  private createSounds(): void {
    // Get SFX volume from localStorage
    this.currentSfxVolume = parseFloat(localStorage.getItem('sfxVolume') || '1.0');
    
    // Create jump sound (short rising tone)
    this.jumpSound = this.scene.sound.add('jump', { 
      volume: this.baseVolumes.jump * this.currentSfxVolume,
      rate: 1.2
    });

    // Create dash sound (whoosh effect)
    this.dashSound = this.scene.sound.add('dash', {
      volume: this.baseVolumes.dash * this.currentSfxVolume,
      rate: 1.0
    });

    // Create shoot sound (laser pew)
    this.shootSound = this.scene.sound.add('shoot', {
      volume: this.baseVolumes.shoot * this.currentSfxVolume,
      rate: 1.3
    });
    
    // Create hit sound
    this.hitSound = this.scene.sound.add('hit', {
      volume: this.baseVolumes.hit * this.currentSfxVolume,
      rate: 1.0
    });
    
    // Create death sound
    this.deathSound = this.scene.sound.add('death', {
      volume: this.baseVolumes.death * this.currentSfxVolume,
      rate: 0.8
    });
  }
  
  private setupVolumeListener(): void {
    // Listen for volume changes from the VolumeControlManager
    this.scene.game.events.on('sfxVolumeChanged', (volume: number) => {
      this.currentSfxVolume = volume;
      this.updateVolumes();
    });
    
    // Clean up listener when scene shuts down
    this.scene.events.once('shutdown', () => {
      this.scene.game.events.off('sfxVolumeChanged');
    });
  }
  
  private updateVolumes(): void {
    // Update all sound volumes based on new SFX volume
    if (this.jumpSound && 'setVolume' in this.jumpSound) {
      (this.jumpSound as Phaser.Sound.WebAudioSound | Phaser.Sound.HTML5AudioSound)
        .setVolume(this.baseVolumes.jump * this.currentSfxVolume);
    }
    
    if (this.dashSound && 'setVolume' in this.dashSound) {
      (this.dashSound as Phaser.Sound.WebAudioSound | Phaser.Sound.HTML5AudioSound)
        .setVolume(this.baseVolumes.dash * this.currentSfxVolume);
    }
    
    if (this.shootSound && 'setVolume' in this.shootSound) {
      (this.shootSound as Phaser.Sound.WebAudioSound | Phaser.Sound.HTML5AudioSound)
        .setVolume(this.baseVolumes.shoot * this.currentSfxVolume);
    }
    
    if (this.hitSound && 'setVolume' in this.hitSound) {
      (this.hitSound as Phaser.Sound.WebAudioSound | Phaser.Sound.HTML5AudioSound)
        .setVolume(this.baseVolumes.hit * this.currentSfxVolume);
    }
    
    if (this.deathSound && 'setVolume' in this.deathSound) {
      (this.deathSound as Phaser.Sound.WebAudioSound | Phaser.Sound.HTML5AudioSound)
        .setVolume(this.baseVolumes.death * this.currentSfxVolume);
    }
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
  
  playHit(): void {
    this.hitSound?.play();
  }
  
  playDeath(): void {
    this.deathSound?.play();
  }

  static generateSoundDataURIs() {
    return {
      jump: SoundManager.generateJumpSound(),
      dash: SoundManager.generateDashSound(),
      shoot: SoundManager.generateShootSound(),
      hit: SoundManager.generateHitSound(),
      death: SoundManager.generateDeathSound()
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
  
  // Generate hit sound - sharp impact
  private static generateHitSound(): string {
    const sampleRate = 22050;
    const duration = 0.1;
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
    
    // Generate a sharp thud/impact sound
    for (let i = 0; i < samples; i++) {
      const t = i / sampleRate;
      
      // Quick impact with low frequency thud
      const envelope = Math.exp(-t * 30);
      const freq1 = 80 + Math.random() * 20;
      const freq2 = 200 + Math.random() * 50;
      
      const wave1 = Math.sin(2 * Math.PI * freq1 * t);
      const wave2 = Math.sin(2 * Math.PI * freq2 * t) * 0.3;
      const noise = (Math.random() - 0.5) * 0.5;
      
      const sound = (wave1 + wave2 + noise) * envelope;
      
      data[44 + i] = 128 + sound * 100;
    }
    
    let binary = '';
    for (let i = 0; i < data.length; i++) {
      binary += String.fromCharCode(data[i]);
    }
    return 'data:audio/wav;base64,' + btoa(binary);
  }
  
  // Generate death sound - longer, descending tone
  private static generateDeathSound(): string {
    const sampleRate = 22050;
    const duration = 0.5;
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
    
    // Generate a descending/fading sound
    for (let i = 0; i < samples; i++) {
      const t = i / sampleRate;
      
      // Descending frequency
      const startFreq = 400;
      const endFreq = 50;
      const frequency = startFreq * Math.pow(endFreq / startFreq, t / duration);
      
      // Fading envelope
      const envelope = Math.pow(1 - t / duration, 0.5);
      
      // Multiple harmonics for richness
      const fundamental = Math.sin(2 * Math.PI * frequency * t);
      const harmonic2 = Math.sin(2 * Math.PI * frequency * 2 * t) * 0.5;
      const harmonic3 = Math.sin(2 * Math.PI * frequency * 3 * t) * 0.3;
      
      const wave = (fundamental + harmonic2 + harmonic3) / 1.8;
      
      data[44 + i] = 128 + wave * envelope * 80;
    }
    
    let binary = '';
    for (let i = 0; i < data.length; i++) {
      binary += String.fromCharCode(data[i]);
    }
    return 'data:audio/wav;base64,' + btoa(binary);
  }
} 