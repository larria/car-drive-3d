import { describe, expect, it, vi } from 'vitest';
import { createAudioController } from '../src/audio';
import { AudioEventQueue, DEFAULT_AUDIO_SETTINGS, gearAudioEvent, vehicleAudioModel } from '../src/audio-model';

function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; }
class Param { value = 0; cancelScheduledValues() {} setTargetAtTime(value: number) { this.value = value; } }
class Node {
  gain = new Param(); frequency = new Param(); type = ''; buffer: unknown; loop = false;
  onended: (() => void) | null = null; started = false; stopped = false;
  connect() { return this; } disconnect() {} start() { this.started = true; } stop() { this.stopped = true; }
}
class Context {
  state = 'suspended'; currentTime = 0; sampleRate = 100; destination = new Node(); sources: Node[] = []; gains: Node[] = [];
  resumeGate: Promise<void> = Promise.resolve();
  resume = vi.fn(async () => { await this.resumeGate; this.state = 'running'; });
  suspend = vi.fn(async () => { this.state = 'suspended'; });
  close = vi.fn(async () => { this.state = 'closed'; });
  decodeAudioData = vi.fn(async () => ({duration: 0.8}));
  createGain() { const node = new Node(); this.gains.push(node); return node; }
  createBiquadFilter() { return new Node(); }
  createOscillator() { const node = new Node(); this.sources.push(node); return node; }
  createBufferSource() { const node = new Node(); this.sources.push(node); return node; }
  createBuffer(_channels: number, length: number) { return {getChannelData: () => new Float32Array(length)}; }
}
function setup(fetchAudio: (url: string) => Promise<ArrayBuffer> = async () => new ArrayBuffer(4)) {
  const ctx = new Context(); const factory = vi.fn(() => ctx as unknown as AudioContext);
  const audio = createAudioController({contextFactory: factory, fetchAudio, baseUrl: '/sub/', lifecycle: false});
  return {audio, ctx, factory};
}
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };

describe('audio presentation model', () => {
  it('maps reverse magnitude equally, finite values, neutral revs and interior filtering', () => {
    const input = {speed: 4, gear: 'D' as const, throttle: 0.6, brake: 1, inside: false};
    expect(vehicleAudioModel(input)).toEqual(vehicleAudioModel({...input, speed: -4, gear: 'R'}));
    expect(vehicleAudioModel({...input, gear: 'N', speed: 30}).frequency).toBe(vehicleAudioModel({...input, gear: 'N'}).frequency);
    expect(vehicleAudioModel({...input, gear: 'N', throttle: 1}).frequency).toBeGreaterThan(vehicleAudioModel({...input, gear: 'N', throttle: 0}).frequency);
    expect(vehicleAudioModel({...input, inside: true}).cutoff).toBeLessThan(vehicleAudioModel(input).cutoff);
    expect(Object.values(vehicleAudioModel({...input, speed: NaN, throttle: Infinity})).every(Number.isFinite)).toBe(true);
    expect(gearAudioEvent('D', 'D')).toBeUndefined(); expect(gearAudioEvent('D', 'R')).toEqual({type: 'gear'});
  });
  it('terminal wins, suppresses and consumes frame events; dedup resets on run change', () => {
    const queue = new AudioEventQueue();
    expect(queue.select([{type:'parking',key:'a'},{type:'fail',key:'end'},{type:'penalty',key:'p'}], 0)).toEqual([{type:'fail',key:'end'}]);
    expect(queue.select([{type:'parking',key:'a'},{type:'fail',key:'end'}], 1000)).toEqual([]);
    queue.clear(); expect(queue.select([{type:'parking',key:'a'}], 1000)).toHaveLength(1);
    expect(queue.select([{type:'ui-reject'}], 1000)).toHaveLength(1);
    expect(queue.select([{type:'ui-reject'}], 1100)).toHaveLength(0);
  });
});
describe('audio controller lifecycle', () => {
  it('lazy single flight unlock follows current scene and persistent nodes never grow', async () => {
    const {audio,ctx,factory} = setup(); const gate = deferred<void>(); ctx.resumeGate = gate.promise;
    expect(factory).not.toHaveBeenCalled(); audio.playEvents([{type:'pass'}]);
    const a = audio.unlock(); const b = audio.unlock(); audio.setScene('exam'); gate.resolve();
    expect(await a).toBe(true); expect(await b).toBe(true); expect(factory).toHaveBeenCalledTimes(1); expect(ctx.resume).toHaveBeenCalledTimes(1);
    for (let i = 0; i < 1000; i++) audio.updateVehicle({speed: i % 5, gear:'D', throttle:1, brake:0, inside:false});
    expect(audio.diagnostics.persistentSources).toBe(8); expect(ctx.sources).toHaveLength(8); audio.dispose();
    expect(ctx.sources.every(source => source.stopped)).toBe(true);
  });
  it('mute during resume cannot unlock; reenable gesture is not lost behind stale flight', async () => {
    const {audio,ctx} = setup(); const first = deferred<void>(); ctx.resumeGate = first.promise;
    const stale = audio.unlock(); audio.applySettings({...DEFAULT_AUDIO_SETTINGS,audioEnabled:false});
    ctx.resumeGate = Promise.resolve(); audio.applySettings(DEFAULT_AUDIO_SETTINGS);
    expect(await audio.unlock()).toBe(true); first.resolve(); expect(await stale).toBe(false);
    expect(audio.diagnostics.unlocked).toBe(true); expect(ctx.state).toBe('running'); audio.dispose();
  });
  it('hidden pause cancels late decode and requires a new gesture', async () => {
    const bytes = deferred<ArrayBuffer>(); const {audio,ctx} = setup(() => bytes.promise);
    await audio.unlock(); audio.setScene('exam'); audio.playEvents([{type:'pass'}]); audio.pause(); bytes.resolve(new ArrayBuffer(2)); await flush();
    expect(audio.diagnostics.voices).toBe(0); expect(ctx.state).toBe('suspended');
    audio.setScene('menu'); await flush(); expect(ctx.state).toBe('suspended');
    await audio.unlock(); await flush(); expect(ctx.state).toBe('running'); audio.dispose();
  });
  it('caps short voices, prioritizes terminal, recycles ended nodes, audition works paused', async () => {
    const {audio,ctx} = setup(); await audio.unlock(); audio.setScene('exam');
    for (const type of ['gear','parking','ui-confirm','ui-back'] as const) { audio.playEvents([{type}]); await flush(); }
    expect(audio.diagnostics.voices).toBe(4); audio.playEvents([{type:'complete'}]); await flush(); expect(audio.diagnostics.voices).toBe(4);
    audio.setScene('paused'); expect(audio.diagnostics.voices).toBe(0);
    audio.playEvents([{type:'parking'}]); await flush(); expect(audio.diagnostics.voices).toBe(0);
    audio.preview(); await flush(); expect(audio.diagnostics.voices).toBe(1);
    ctx.sources.at(-1)!.onended!(); expect(audio.diagnostics.voices).toBe(0); audio.dispose();
  });
  it('scene change clears result ducking and cap-suppressed event keys stay consumed', async () => {
    const queue = new AudioEventQueue();
    const events = [{type:'warning',key:'w'},{type:'penalty',key:'p'},{type:'parking',key:'s'},{type:'gear',key:'g'}] as const;
    expect(queue.select(events, 0)).toHaveLength(3); expect(queue.select([events[3]], 1000)).toHaveLength(0);
    const {audio,ctx} = setup(); await audio.unlock(); audio.setScene('result'); audio.playEvents([{type:'complete'}]); await flush();
    expect(ctx.gains[1].gain.value).toBe(0); audio.setScene('menu'); await flush();
    expect(ctx.gains[1].gain.value).toBe(DEFAULT_AUDIO_SETTINGS.musicVolume); audio.dispose();
  });
  it('loading failure and denied context leave game-facing calls safe', async () => {
    const {audio} = setup(async () => {throw new Error('offline');}); await audio.unlock(); audio.preview(); await flush(); expect(audio.diagnostics.voices).toBe(0); audio.dispose();
    const denied = createAudioController({contextFactory: () => {throw new Error('denied');}, lifecycle:false}); expect(await denied.unlock()).toBe(false); denied.dispose();
  });
});
