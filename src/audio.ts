import { AudioEventQueue, DEFAULT_AUDIO_SETTINGS, EVENT_PRIORITY, unit, vehicleAudioModel } from './audio-model';
import type { AudioEvent, AudioEventType, AudioScene, AudioSettings, VehicleAudioInput } from './audio-model';
export type { AudioEvent, AudioScene, AudioSettings, VehicleAudioInput } from './audio-model';
export { gearAudioEvent } from './audio-model';

const ASSETS: Record<AudioEventType | 'music', string> = {
  music: 'menu-music', 'ui-confirm': 'ui-confirm', 'ui-back': 'ui-back', 'ui-reject': 'ui-denied',
  startup: 'engine-start', gear: 'gear-shift', parking: 'parking-success', warning: 'timer-warning',
  penalty: 'penalty', pass: 'course-pass', fail: 'course-fail', complete: 'exam-complete',
};
interface Options {
  contextFactory?: () => AudioContext;
  fetchAudio?: (url: string) => Promise<ArrayBuffer>;
  baseUrl?: string;
  lifecycle?: boolean;
}
interface Voice { source: AudioBufferSourceNode; gain: GainNode; priority: number }

/** One lazy context and persistent vehicle graph. Audio failures never escape into driving. */
export function createAudioController(options: Options = {}) {
  let context: AudioContext | undefined;
  let master: GainNode, musicBus: GainNode, vehicleBus: GainNode, cueBus: GainNode;
  let settings = { ...DEFAULT_AUDIO_SETTINGS };
  let scene: AudioScene = 'menu';
  let generation = 0;
  let lifecycleGeneration = 0;
  const musicAllowed = () => scene !== 'exam' && scene !== 'paused';
  let disposed = false;
  let unlocked = false;
  let blocked = false;
  let flight: Promise<boolean> | undefined;
  let flightLifecycle = -1;
  let music: AudioBufferSourceNode | undefined;
  let resultUntil = 0;
  let duckUntil = 0;
  const buffers = new Map<string, AudioBuffer>();
  const loads = new Map<string, Promise<AudioBuffer | undefined>>();
  const voices = new Set<Voice>();
  const queue = new AudioEventQueue();
  const persistent: AudioScheduledSourceNode[] = [];
  const nodes: AudioNode[] = [];
  const harmonics: { source: OscillatorNode; gain: GainNode; multiple: number }[] = [];
  let mechanical: GainNode, rolling: GainNode, wind: GainNode, braking: GainNode, filter: BiquadFilterNode;
  let vehicle: VehicleAudioInput = { speed: 0, gear: 'N', throttle: 0, brake: 0, inside: false };
  const active = () => !disposed && !blocked && unlocked && settings.audioEnabled && context?.state === 'running';
  function smooth(param: AudioParam, value: number, time = 0.04) {
    if (!context) return;
    param.cancelScheduledValues(context.currentTime);
    param.setTargetAtTime(value, context.currentTime, time);
  }
  function stopMusic() {
    if (music) { music.onended = null; try { music.stop(); } catch { /* Already ended. */ } music.disconnect(); music = undefined; }
  }
  function stopVoices() {
    for (const voice of voices) { voice.source.onended = null; try { voice.source.stop(); } catch { /* Already ended. */ } voice.source.disconnect(); voice.gain.disconnect(); }
    voices.clear();
  }
  function gains() {
    if (!context) return;
    smooth(master.gain, active() ? unit(settings.masterVolume) : 0);
    smooth(cueBus.gain, unit(settings.cuesVolume));
    const duck = context.currentTime < duckUntil ? 0.3 : 1;
    smooth(vehicleBus.gain, active() && (scene === 'exam' || scene === 'practice') ? unit(settings.vehicleVolume) * duck : 0);
    const allowed = scene === 'menu' || scene === 'briefing' || scene === 'practice' || scene === 'result';
    smooth(musicBus.gain, active() && allowed && context.currentTime >= resultUntil ? unit(settings.musicVolume) * duck : 0);
  }
  async function load(name: string): Promise<AudioBuffer | undefined> {
    if (buffers.has(name)) return buffers.get(name);
    if (loads.has(name)) return loads.get(name);
    const ctx = context;
    if (!ctx) return undefined;
    const request = (async () => {
      try {
        const url = `${options.baseUrl ?? import.meta.env.BASE_URL}audio/${name}.mp3`;
        const bytes = options.fetchAudio ? await options.fetchAudio(url) : await fetch(url).then(response => {
          if (!response.ok) throw new Error('Audio unavailable');
          return response.arrayBuffer();
        });
        if (disposed) return undefined;
        const decoded = await ctx.decodeAudioData(bytes);
        if (disposed) return undefined;
        buffers.set(name, decoded);
        return decoded;
      } catch { return undefined; }
      finally { loads.delete(name); }
    })();
    loads.set(name, request);
    return request;
  }
  function graph(ctx: AudioContext) {
    master = ctx.createGain(); musicBus = ctx.createGain(); vehicleBus = ctx.createGain(); cueBus = ctx.createGain();
    master.gain.value = 0; vehicleBus.gain.value = 0; musicBus.gain.value = 0;
    master.connect(ctx.destination); musicBus.connect(master); vehicleBus.connect(master); cueBus.connect(master);
    nodes.push(master, musicBus, vehicleBus, cueBus);
    filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.connect(vehicleBus); nodes.push(filter);
    for (const [multiple, level] of [[1, 1], [2, 0.36], [3, 0.16], [5, 0.06]]) {
      const source = ctx.createOscillator(); source.type = 'sine';
      const gain = ctx.createGain(); gain.gain.value = 0; source.connect(gain); gain.connect(filter); source.start();
      harmonics.push({source, gain, multiple}); persistent.push(source); nodes.push(source, gain);
      // Relative layer amplitudes are retained in the vehicle update.
      gain.gain.value = level * 0.045;
    }
    const noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = noise.getChannelData(0); let seed = 9137;
    for (let i = 0; i < data.length; i++) { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; data[i] = (seed / 4294967296 * 2 - 1); }
    function noiseLayer(type: BiquadFilterType, frequency: number) {
      const source = ctx.createBufferSource(); source.buffer = noise; source.loop = true;
      const tone = ctx.createBiquadFilter(); tone.type = type; tone.frequency.value = frequency;
      const gain = ctx.createGain(); gain.gain.value = 0;
      source.connect(tone); tone.connect(gain); gain.connect(filter); source.start();
      persistent.push(source); nodes.push(source, tone, gain); return gain;
    }
    mechanical = noiseLayer('bandpass', 160); rolling = noiseLayer('lowpass', 650);
    wind = noiseLayer('highpass', 1100); braking = noiseLayer('bandpass', 420);
  }
  async function ensureMusic(token: number) {
    if (!active() || music || !musicAllowed()) return;
    const buffer = await load(ASSETS.music);
    if (!buffer || token !== generation || !active() || music || !musicAllowed()) return;
    const source = context!.createBufferSource(); source.buffer = buffer; source.loop = true;
    // libmp3lame Xing metadata removes encoder delay in Chrome; keep the original musical period explicit.
    source.loopStart = 0; source.loopEnd = 48;
    source.connect(musicBus); source.start(); music = source; gains();
  }
  function updateVehicle(input: VehicleAudioInput, _dt?: number) {
    vehicle = input;
    if (!context) return;
    const model = vehicleAudioModel(input);
    const levels = [1, 0.36, 0.16, 0.06];
    harmonics.forEach((layer, i) => { smooth(layer.source.frequency, model.frequency * layer.multiple, 0.12); smooth(layer.gain.gain, model.engine * levels[i], 0.1); });
    smooth(mechanical.gain, model.mechanical); smooth(rolling.gain, model.rolling); smooth(wind.gain, model.wind); smooth(braking.gain, model.brake);
    smooth(filter.frequency, model.cutoff, 0.15); gains();
  }
  async function unlock(): Promise<boolean> {
    if (disposed || (typeof document !== 'undefined' && document.hidden)) return false;
    if (flight && flightLifecycle === lifecycleGeneration) return flight;
    blocked = false;
    const token = lifecycleGeneration;
    const task = (async () => {
      try {
        if (!context) {
          context = options.contextFactory ? options.contextFactory() : new AudioContext();
          graph(context);
        }
        if (!settings.audioEnabled) return false;
        await context.resume();
        if (token !== lifecycleGeneration || disposed || blocked || !settings.audioEnabled) { gains(); if (!disposed && (blocked || !settings.audioEnabled)) void context.suspend().catch(() => {}); return false; }
        unlocked = context.state === 'running'; updateVehicle(vehicle); gains();
        void ensureMusic(generation); return unlocked;
      } catch { unlocked = false; return false; }
    })();
    flight = task;
    flightLifecycle = token;
    void task.finally(() => { if (flight === task) flight = undefined; });
    return task;
  }
  async function play(event: AudioEvent, token: number, audition = false): Promise<boolean> {
    try { return await startCue(event, token, audition); } catch { return false; }
  }
  async function startCue(event: AudioEvent, token: number, audition: boolean): Promise<boolean> {
    const ctx = context!;
    const requestedAt = ctx.currentTime;
    const buffer = await load(ASSETS[event.type]);
    if (!buffer || token !== generation || !active() || (!audition && scene === 'paused') || ctx.currentTime - requestedAt > 0.5) return false;
    const priority = EVENT_PRIORITY[event.type];
    if (voices.size >= 4) {
      const victim = [...voices].sort((a, b) => a.priority - b.priority)[0];
      if (victim.priority >= priority) return false;
      victim.source.onended = null; try { victim.source.stop(); } catch { /* Ended. */ }
      victim.source.disconnect(); victim.gain.disconnect(); voices.delete(victim);
    }
    const source = ctx.createBufferSource(); source.buffer = buffer;
    const gain = ctx.createGain(); source.connect(gain); gain.connect(cueBus);
    const voice = {source, gain, priority}; voices.add(voice);
    source.onended = () => { voices.delete(voice); source.disconnect(); gain.disconnect(); gains(); };
    if (priority >= 4) duckUntil = Math.max(duckUntil, ctx.currentTime + Math.min(buffer.duration, 2));
    if (priority === 5) resultUntil = ctx.currentTime + buffer.duration;
    gains();
    try { source.start(); } catch { voices.delete(voice); source.disconnect(); gain.disconnect(); return false; }
    return true;
  }
  function playEvents(events: readonly AudioEvent[]) {
    if (!active() || scene === 'paused') return;
    for (const event of queue.select(events, context!.currentTime * 1000)) void play(event, generation);
  }
  function invalidate() { generation++; queue.clear(); stopVoices(); resultUntil = 0; duckUntil = 0; gains(); }
  function pause() {
    generation++; lifecycleGeneration++; blocked = true; unlocked = false; queue.clear(); stopVoices(); stopMusic();
    gains(); if (context) void context.suspend().catch(() => {});
  }
  const visibility = () => { if (document.hidden) pause(); };
  if (options.lifecycle !== false && typeof window !== 'undefined') {
    window.addEventListener('blur', pause); window.addEventListener('pagehide', pause); document.addEventListener('visibilitychange', visibility);
  }
  return {
    unlock, updateVehicle, playEvents, invalidate, pause,
    applySettings(next: AudioSettings) {
      const wasEnabled = settings.audioEnabled;
      settings = { ...next };
      if (!settings.audioEnabled) pause();
      else { gains(); if (wasEnabled && active()) void ensureMusic(generation); }
    },
    setScene(next: AudioScene) {
      if (scene !== next) { generation++; stopVoices(); resultUntil = 0; duckUntil = 0; }
      scene = next;
      if (next === 'exam' || next === 'paused') stopMusic();
      gains(); void ensureMusic(generation);
    },
    preview(): Promise<boolean> { return active() ? play({type: 'ui-confirm'}, generation, true) : Promise.resolve(false); },
    dispose() {
      if (disposed) return;
      pause(); disposed = true;
      if (typeof window !== 'undefined') { window.removeEventListener('blur', pause); window.removeEventListener('pagehide', pause); document.removeEventListener('visibilitychange', visibility); }
      for (const source of persistent) { try { source.stop(); } catch { /* Ended. */ } }
      for (const node of nodes) node.disconnect();
      buffers.clear(); loads.clear(); if (context) void context.close().catch(() => {});
    },
    /** Read-only diagnostics for lifecycle/concurrency regression tests. */
    get diagnostics() { return { unlocked, blocked, generation, voices: voices.size, persistentSources: persistent.length, contextState: context?.state ?? 'uninitialized' }; },
  };
}
