let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let musicBus: GainNode | null = null;
let sfxBus: GainNode | null = null;
let ambientNodes: AudioNode[] = [];
let volume = 0.7;
let unlocked = false;

function ac(): AudioContext | null {
  return ctx;
}

function ramp(g: GainNode, v: number, t = 0.04) {
  if (!ctx) return;
  g.gain.setTargetAtTime(v, ctx.currentTime, t);
}

export function unlockAudio() {
  if (!ctx) {
    const C = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new C({ latencyHint: "interactive" });
    master = ctx.createGain();
    musicBus = ctx.createGain();
    sfxBus = ctx.createGain();
    musicBus.gain.value = 0.45;
    sfxBus.gain.value = 0.8;
    musicBus.connect(master);
    sfxBus.connect(master);
    master.connect(ctx.destination);
    master.gain.value = volume * volume;
  }
  if (ctx.state === "suspended") void ctx.resume();
  unlocked = true;
}

export function setVolume(v: number) {
  volume = Math.max(0, Math.min(1, v));
  if (master && ctx) ramp(master, volume * volume, 0.08);
}

export function isUnlocked() {
  return unlocked && !!ctx;
}

function envGain(bus: GainNode, peak: number, attack: number, release: number): GainNode {
  const g = ctx!.createGain();
  g.gain.value = 0;
  g.connect(bus);
  const t = ctx!.currentTime;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + release);
  return g;
}

export function playTone(freq: number, dur: number, type: OscillatorType = "sine", peak = 0.12, detune = 0) {
  if (!ctx || !sfxBus) return;
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.value = freq;
  o.detune.value = detune;
  const g = envGain(sfxBus, peak, 0.01, dur);
  o.connect(g);
  o.start();
  o.stop(ctx.currentTime + dur + 0.05);
  o.onended = () => {
    o.disconnect();
    g.disconnect();
  };
}

export function playNoise(dur: number, peak = 0.1, hp = 400) {
  if (!ctx || !sfxBus) return;
  const n = ctx.createBufferSource();
  const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  n.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = "highpass";
  f.frequency.value = hp;
  const g = envGain(sfxBus, peak, 0.005, dur);
  n.connect(f);
  f.connect(g);
  n.start();
  n.stop(ctx.currentTime + dur);
  n.onended = () => {
    n.disconnect();
    f.disconnect();
    g.disconnect();
  };
}

export function sfxFootstep(crouch: boolean) {
  playNoise(crouch ? 0.06 : 0.05, crouch ? 0.03 : 0.05, 180);
  playTone(crouch ? 90 : 110 + Math.random() * 20, 0.07, "sine", 0.04);
}

export function sfxDoor() {
  playTone(180, 0.18, "triangle", 0.08);
  playTone(90, 0.28, "sine", 0.06);
  playNoise(0.2, 0.06, 200);
}

export function sfxPickup() {
  playTone(520, 0.12, "sine", 0.08);
  playTone(780, 0.16, "sine", 0.05);
}

export function sfxHurt() {
  playTone(140, 0.2, "sawtooth", 0.1);
  playNoise(0.15, 0.08, 300);
}

export function sfxDeath() {
  playTone(80, 0.8, "sawtooth", 0.12);
  playTone(50, 1.1, "sine", 0.1);
  playNoise(0.5, 0.1, 120);
}

export function sfxWarn() {
  playTone(880, 0.12, "square", 0.07);
  playTone(660, 0.18, "square", 0.05);
}

export function sfxBloodza() {
  playNoise(0.7, 0.16, 250);
  playTone(40, 0.8, "sawtooth", 0.14);
  playTone(220, 0.4, "square", 0.06);
}

export function sfxXillie() {
  playTone(1400, 0.25, "square", 0.08);
  playTone(180, 0.6, "sawtooth", 0.1);
  playNoise(0.5, 0.14, 800);
}

export function sfxHide() {
  playTone(200, 0.1, "triangle", 0.05);
  playNoise(0.12, 0.04, 400);
}

export function sfxClick() {
  playTone(420, 0.05, "square", 0.04);
}

export function sfxWin() {
  playTone(392, 0.25, "sine", 0.08);
  setTimeout(() => playTone(523, 0.3, "sine", 0.08), 180);
  setTimeout(() => playTone(659, 0.5, "sine", 0.09), 360);
}

function clearAmbient() {
  for (const n of ambientNodes) {
    try {
      (n as OscillatorNode).stop?.();
    } catch {
      /* already stopped */
    }
    try {
      n.disconnect();
    } catch {
      /* noop */
    }
  }
  ambientNodes = [];
}

export function startAmbient(kind: "theater" | "park" | "roof" | "light" | "dark" | "electric") {
  if (!ctx || !musicBus) return;
  clearAmbient();
  const t = ctx.currentTime;
  const g = ctx.createGain();
  g.gain.value = 0;
  g.connect(musicBus);
  g.gain.setTargetAtTime(0.55, t, 0.4);
  ambientNodes.push(g);

  const o1 = ctx.createOscillator();
  o1.type = "sine";
  o1.frequency.value = kind === "light" ? 196 : kind === "park" ? 55 : 48;
  const o2 = ctx.createOscillator();
  o2.type = "triangle";
  o2.frequency.value = kind === "electric" ? 90 : 72;
  o1.connect(g);
  o2.connect(g);
  o1.start();
  o2.start();
  ambientNodes.push(o1, o2);

  if (kind === "roof" || kind === "park") {
    const n = ctx.createBufferSource();
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    n.buffer = buf;
    n.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = kind === "roof" ? "lowpass" : "bandpass";
    f.frequency.value = kind === "roof" ? 900 : 400;
    const ng = ctx.createGain();
    ng.gain.value = kind === "roof" ? 0.18 : 0.08;
    n.connect(f);
    f.connect(ng);
    ng.connect(musicBus);
    n.start();
    ambientNodes.push(n, f, ng);
  }

  if (kind === "electric") {
    const o3 = ctx.createOscillator();
    o3.type = "square";
    o3.frequency.value = 60;
    const g3 = ctx.createGain();
    g3.gain.value = 0.03;
    o3.connect(g3);
    g3.connect(musicBus);
    o3.start();
    ambientNodes.push(o3, g3);
  }
}

export function stopAmbient() {
  if (!ctx) {
    clearAmbient();
    return;
  }
  for (const n of ambientNodes) {
    if (n instanceof GainNode) ramp(n, 0, 0.12);
  }
  const snapshot = ambientNodes.slice();
  setTimeout(() => {
    for (const n of snapshot) {
      try {
        (n as OscillatorNode).stop?.();
      } catch {
        /* noop */
      }
      try {
        n.disconnect();
      } catch {
        /* noop */
      }
    }
  }, 400);
  ambientNodes = [];
}

export function resumeIfNeeded() {
  if (ctx && ctx.state === "suspended") void ctx.resume();
}
