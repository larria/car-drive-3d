import {describe, expect, it} from 'vitest';
import {createSettingsStore, DEFAULT_SETTINGS, SETTINGS_KEY, validateSettings} from '../src/settings';

describe('versioned local preferences',()=>{
 it('validates per-course speed ranges and old fields independently',()=>{
  const value=validateSettings({version:1,maxSpeeds:{'right-angle':0,'s-curve':90,practice:90,'parallel-parking':NaN}});
  expect(value.maxSpeeds).toEqual({'right-angle':1,'s-curve':20,'parallel-parking':2,'reverse-garage':2,practice:60});
  expect(validateSettings({version:1}).maxSpeeds).toEqual(DEFAULT_SETTINGS.maxSpeeds);
  const store=createSettingsStore({getItem:()=>null,setItem:()=>{}});store.get().maxSpeeds.practice=50;expect(store.get().maxSpeeds.practice).toBe(15);
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
 it('survives malformed data and denied read/write storage',()=>{
  expect(createSettingsStore({getItem:()=>'{bad',setItem:()=>{}}).get()).toEqual(DEFAULT_SETTINGS);
  const denied=createSettingsStore({getItem:()=>{throw Error('denied');},setItem:()=>{throw Error('quota');}});
  expect(denied.update({headlights:true}).headlights).toBe(true);
  expect(denied.get().headlights).toBe(true);
 });
});
