import {describe, expect, it} from 'vitest';
import {createSettingsStore, DEFAULT_SETTINGS, SETTINGS_KEY, validateSettings} from '../src/settings';

describe('versioned local preferences',()=>{
 it('validates per-course speed ranges and old fields independently',()=>{
  const value=validateSettings({version:1,maxSpeeds:{'right-angle':0,'s-curve':90,practice:90,'parallel-parking':NaN}});
  expect(value.maxSpeeds).toEqual({'right-angle':3,'s-curve':20,'parallel-parking':6,'reverse-garage':6,practice:60});
  expect(validateSettings({version:1}).maxSpeeds).toEqual(DEFAULT_SETTINGS.maxSpeeds);
  const store=createSettingsStore({getItem:()=>null,setItem:()=>{}});store.get().maxSpeeds.practice=50;expect(store.get().maxSpeeds.practice).toBe(15);
 });
 it('migrates every stored speed below the shared minimum without replacing valid speeds',()=>{
  const maxSpeeds={'right-angle':2,'s-curve':-5,'parallel-parking':2.9,'reverse-garage':2,practice:1};
  const store=createSettingsStore({getItem:()=>JSON.stringify({version:1,maxSpeeds}),setItem:()=>{}});
  expect(Object.values(store.get().maxSpeeds)).toEqual([3,3,3,3,3]);
  expect(validateSettings({version:1,maxSpeeds:{practice:50,'right-angle':8}}).maxSpeeds).toMatchObject({practice:50,'right-angle':8});
 });
 it('keeps a legal stored garage 3 while all new exams default to 6',()=>{
  expect(Object.values(DEFAULT_SETTINGS.maxSpeeds)).toEqual([6,6,6,6,15]);
  expect(validateSettings({version:1,maxSpeeds:{'reverse-garage':3}}).maxSpeeds['reverse-garage']).toBe(3);
 });
 it('defaults to game controls and rejects unknown schema or values field by field',()=>{
  expect(validateSettings(null)).toEqual(DEFAULT_SETTINGS);
  expect(validateSettings({version:2,realisticControls:true})).toEqual(DEFAULT_SETTINGS);
  expect(validateSettings({version:1,realisticControls:true,paint:'javascript:bad',quality:'ultra',headlights:1,mirrorsExpanded:false,position:{x:100}})).toEqual({...DEFAULT_SETTINGS,realisticControls:true,mirrorsExpanded:false});
 });
 it('persists only preferences and loads them after restart',()=>{
  let raw:string|null=null;
  const storage={getItem:(key:string)=>key===SETTINGS_KEY?raw:null,setItem:(_key:string,value:string)=>{raw=value;}};
  const first=createSettingsStore(storage);first.update({paint:'#a31e22',realisticControls:true,quality:'smooth'});
  expect(JSON.parse(raw!)).toEqual({version:1,...DEFAULT_SETTINGS,paint:'#a31e22',realisticControls:true,quality:'smooth'});
  expect(createSettingsStore(storage).get()).toEqual(first.get());
  expect(first.get()).not.toBe(first.get());
 });
 it('extends existing v1 preferences with independent audio defaults',()=>{
  const legacy={version:1,paint:'#a31e22',realisticControls:true,maxSpeeds:{'reverse-garage':3}};
  const value=createSettingsStore({getItem:()=>JSON.stringify(legacy),setItem:()=>{}}).get();
  expect(value).toMatchObject({audioEnabled:true,masterVolume:0.7,musicVolume:0.35,vehicleVolume:0.65,cuesVolume:0.8,paint:'#a31e22',realisticControls:true});
  expect(value.maxSpeeds['reverse-garage']).toBe(3);
  expect(SETTINGS_KEY).toBe('larria.settings.v1');
 });
 it('clamps finite audio volumes and preserves explicit mute and zero',()=>{
  expect(validateSettings({version:1,audioEnabled:false,masterVolume:-1,musicVolume:2,vehicleVolume:0,cuesVolume:0.42})).toMatchObject({audioEnabled:false,masterVolume:0,musicVolume:1,vehicleVolume:0,cuesVolume:0.42});
 });
 it.each(['masterVolume','musicVolume','vehicleVolume','cuesVolume'] as const)('rejects non-finite or nonnumeric %s without changing other preferences',(key)=>{
  for(const invalid of [NaN,Infinity,-Infinity,'0.5',null,undefined,true,{},[]]) {
   const value=validateSettings({version:1,[key]:invalid,audioEnabled:false,headlights:true});
   expect(value[key]).toBe(DEFAULT_SETTINGS[key]);
   expect(value.audioEnabled).toBe(false);
   expect(value.headlights).toBe(true);
  }
  expect(validateSettings({version:1,audioEnabled:0}).audioEnabled).toBe(true);
 });
 it('round trips audio preferences under v1 without persisting unknown state',()=>{
  let raw:string|null=null;
  const storage={getItem:()=>raw,setItem:(_key:string,value:string)=>{raw=value;}};
  const store=createSettingsStore(storage);
  const updated=store.update({audioEnabled:false,masterVolume:0,musicVolume:0.2,vehicleVolume:0.4,cuesVolume:1});
  expect(JSON.parse(raw!)).toEqual({version:1,...updated});
  expect(createSettingsStore(storage).get()).toEqual(updated);
  expect(validateSettings({...JSON.parse(raw!),audioContext:'not-a-preference'})).not.toHaveProperty('audioContext');
  const snapshot=store.get();snapshot.masterVolume=1;
  expect(store.get().masterVolume).toBe(0);
 });
 it('keeps audio updates in memory when storage reads and writes fail',()=>{
  const store=createSettingsStore({getItem:()=>{throw Error('denied');},setItem:()=>{throw Error('quota');}});
  store.update({audioEnabled:false,musicVolume:0.12,cuesVolume:4});
  expect(store.get()).toMatchObject({audioEnabled:false,musicVolume:0.12,cuesVolume:1});
 });
 it('survives malformed data and denied read/write storage',()=>{
  expect(createSettingsStore({getItem:()=>'{bad',setItem:()=>{}}).get()).toEqual(DEFAULT_SETTINGS);
  const denied=createSettingsStore({getItem:()=>{throw Error('denied');},setItem:()=>{throw Error('quota');}});
  expect(denied.update({headlights:true}).headlights).toBe(true);
  expect(denied.get().headlights).toBe(true);
 });
});
