/**
 * CYBERPULSE // Acoustic Feedback System
 * Pure Web Audio API Synthesizer (Zero external dependencies)
 */

class CyberSoundSystem {
  constructor() {
    this.ctx = null;
    this.isMuted = localStorage.getItem('cyberpulse_muted') === 'true';
  }

  init() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
  }

  setMuted(muted) {
    this.isMuted = muted;
    localStorage.setItem('cyberpulse_muted', String(muted));
  }

  // Futuristic radar telemetry ping
  playRadarPing() {
    if (this.isMuted) return;
    try {
      this.init();
      if (!this.ctx || this.ctx.state === 'suspended') return;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, this.ctx.currentTime); // A5
      osc.frequency.exponentialRampToValueAtTime(1760, this.ctx.currentTime + 0.12);

      gain.gain.setValueAtTime(0.04, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.25);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.25);
    } catch (e) {
      // Audio autoplay policy catch
    }
  }

  // Tactical click chirp
  playClick() {
    if (this.isMuted) return;
    try {
      this.init();
      if (!this.ctx || this.ctx.state === 'suspended') return;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1200, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(600, this.ctx.currentTime + 0.04);

      gain.gain.setValueAtTime(0.03, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.04);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.04);
    } catch (e) {}
  }

  // Critical threat alarm tone
  playCriticalAlarm() {
    if (this.isMuted) return;
    try {
      this.init();
      if (!this.ctx || this.ctx.state === 'suspended') return;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(440, this.ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(880, this.ctx.currentTime + 0.08);
      osc.frequency.linearRampToValueAtTime(440, this.ctx.currentTime + 0.16);

      gain.gain.setValueAtTime(0.05, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.2);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.2);
    } catch (e) {}
  }
}

window.cyberSound = new CyberSoundSystem();
