import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./tests',testMatch:'browser.spec.mjs',timeout:60000,use:{channel:'chrome',headless:true,viewport:{width:1440,height:1000}},reporter:'list'});
