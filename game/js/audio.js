// VELVET SHADOW — synthesized sound: WebAudio only, no audio files.
export class SoundBank {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.musicNodes = null;
    this.alarmNodes = null;
  }
  ensure() {
    if (!this.ctx) {
      try {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) { this.ctx = null; }
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }
  toggleMute() { this.muted = !this.muted; return this.muted; }
  tone(freq, dur, type = 'sine', vol = 0.12, when = 0, slideTo = null) {
    const ctx = this.ensure();
    if (!ctx || this.muted) return;
    const t0 = ctx.currentTime + when;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(ctx.destination);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }
  noiseBurst(dur = 0.06, vol = 0.05, freq = 800) {
    const ctx = this.ensure();
    if (!ctx || this.muted) return;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = freq;
    const g = ctx.createGain(); g.gain.value = vol;
    src.connect(f).connect(g).connect(ctx.destination);
    src.start();
  }
  step(run) { this.noiseBurst(0.05, run ? 0.09 : 0.045, run ? 500 : 900); }
  pickup(value) {
    this.tone(660, 0.12, 'triangle', 0.12);
    this.tone(880, 0.14, 'triangle', 0.12, 0.07);
    this.tone(value >= 800 ? 1320 : 1108, 0.2, 'triangle', 0.1, 0.14);
  }
  hackTick(p) { this.tone(900 + p * 500, 0.06, 'square', 0.05); }
  hackDone() { this.tone(523, 0.1, 'square', 0.08); this.tone(784, 0.18, 'square', 0.08, 0.09); }
  spotted() { this.tone(220, 0.25, 'sawtooth', 0.14, 0, 440); this.noiseBurst(0.15, 0.08, 300); }
  caught() {
    [392, 311, 233, 175].forEach((f, i) => this.tone(f, 0.3, 'sawtooth', 0.12, i * 0.16));
  }
  levelDone() {
    [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.22, 'triangle', 0.12, i * 0.1));
  }
  win() {
    [523, 659, 784, 1046, 1318, 1568].forEach((f, i) => this.tone(f, 0.35, 'triangle', 0.11, i * 0.12));
  }
  click() { this.tone(740, 0.06, 'square', 0.06); }
  laserZap() { this.tone(1800, 0.12, 'sawtooth', 0.08, 0, 300); }
  startMusic() {
    const ctx = this.ensure();
    if (!ctx || this.musicNodes || this.muted) return;
    const master = ctx.createGain();
    master.gain.value = 0.05;
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass'; filt.frequency.value = 420;
    master.connect(filt).connect(ctx.destination);
    const notes = [110, 130.8, 98, 146.8];
    const oscs = notes.map((f, i) => {
      const o = ctx.createOscillator();
      o.type = i % 2 ? 'triangle' : 'sine';
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.value = i < 2 ? 0.5 : 0.28;
      o.connect(g).connect(master);
      o.start();
      return o;
    });
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lg = ctx.createGain(); lg.gain.value = 160;
    lfo.connect(lg).connect(filt.frequency);
    lfo.start();
    this.musicNodes = { oscs, lfo, master };
  }
  stopMusic() {
    if (!this.musicNodes) return;
    try {
      this.musicNodes.oscs.forEach((o) => o.stop());
      this.musicNodes.lfo.stop();
    } catch (e) {}
    this.musicNodes = null;
  }
  startAlarm() {
    const ctx = this.ensure();
    if (!ctx || this.alarmNodes || this.muted) return;
    const o = ctx.createOscillator();
    o.type = 'square'; o.frequency.value = 620;
    const g = ctx.createGain(); g.gain.value = 0.035;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 1.6;
    const lg = ctx.createGain(); lg.gain.value = 260;
    lfo.connect(lg).connect(o.frequency);
    o.connect(g).connect(ctx.destination);
    o.start(); lfo.start();
    this.alarmNodes = { o, lfo };
  }
  stopAlarm() {
    if (!this.alarmNodes) return;
    try { this.alarmNodes.o.stop(); this.alarmNodes.lfo.stop(); } catch (e) {}
    this.alarmNodes = null;
  }
}
