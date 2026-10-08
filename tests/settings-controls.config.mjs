import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./',testMatch:'settings-controls.spec.mjs',timeout:60000,use:{channel:'chrome',headless:true,viewport:{width:1440,height:1000}},reporter:'list'});
