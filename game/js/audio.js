// Gilded Heist — sound: WebAudio synthesis only, no audio files.
// One job: every beep, chime and the quiet heist groove, all made from oscillators.

// A tiny original groove: a low bass walk and a sparse music-box lead, in A minor.
const BASS_LINE = [55, 0, 55, 0, 65.41, 0, 49, 0, 55, 0, 82.41, 0, 73.42, 0, 65.41, 0];
const LEAD_LINE = [440, 0, 523.25, 0, 659.25, 0, 523.25, 0, 440, 0, 392, 0, 329.63, 0, 392, 0];
const STEP_SECONDS = 0.21;

class SoundBank {
  constructor() {
    this.ctx = null;
    this.musicOn = true;
    this.musicTimer = null;
    this.step = 0;
    this.nextStepTime = 0;
  }

  // Call from a user gesture (click / key) so the browser allows audio.
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.startMusic();
    } catch {
      this.ctx = null;
    }
  }

  tone(freq, dur, type, gain, when = 0, slideTo = null) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + when;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(this.ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  click() {
    this.tone(740, 0.07, 'triangle', 0.12);
  }

  pickup() {
    this.tone(880, 0.12, 'sine', 0.16);
    this.tone(1318.5, 0.22, 'sine', 0.14, 0.08);
  }

  hack() {
    this.tone(520, 0.08, 'square', 0.07);
    this.tone(660, 0.08, 'square', 0.07, 0.07);
    this.tone(990, 0.16, 'square', 0.07, 0.14);
  }

  dash() {
    this.tone(300, 0.18, 'sawtooth', 0.05, 0, 90);
  }

  spotted() {
    this.tone(220, 0.3, 'sawtooth', 0.12, 0, 440);
    this.tone(233, 0.3, 'sawtooth', 0.1, 0.02, 466);
  }

  caught() {
    this.tone(392, 0.25, 'sawtooth', 0.14, 0, 196);
    this.tone(311, 0.4, 'sawtooth', 0.14, 0.22, 155);
    this.tone(233, 0.7, 'sawtooth', 0.12, 0.45, 110);
  }

  levelClear() {
    this.tone(523.25, 0.15, 'triangle', 0.14);
    this.tone(659.25, 0.15, 'triangle', 0.14, 0.12);
    this.tone(783.99, 0.35, 'triangle', 0.16, 0.24);
  }

  win() {
    const notes = [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5];
    notes.forEach((f, i) => this.tone(f, 0.3, 'triangle', 0.15, i * 0.14));
  }

  startMusic() {
    if (this.musicTimer !== null || !this.ctx) return;
    this.nextStepTime = this.ctx.currentTime + 0.1;
    this.musicTimer = window.setInterval(() => this.scheduleMusic(), 90);
  }

  stopMusic() {
    if (this.musicTimer !== null) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }

  scheduleMusic() {
    if (!this.ctx || !this.musicOn) return;
    while (this.nextStepTime < this.ctx.currentTime + 0.25) {
      const when = this.nextStepTime - this.ctx.currentTime;
      const bass = BASS_LINE[this.step % BASS_LINE.length];
      if (bass > 0) this.tone(bass, STEP_SECONDS * 0.95, 'sine', 0.085, when);
      const lead = LEAD_LINE[this.step % LEAD_LINE.length];
      if (lead > 0 && this.step % 2 === 0) this.tone(lead, STEP_SECONDS * 0.9, 'triangle', 0.03, when);
      if (this.step % 4 === 2) this.tone(1200, 0.03, 'square', 0.012, when);
      this.step++;
      this.nextStepTime += STEP_SECONDS;
    }
  }

  toggleMusic() {
    this.musicOn = !this.musicOn;
    return this.musicOn;
  }
}

export const sounds = new SoundBank();
