import {defineConfig,devices} from '@playwright/test';
// Fixed loopback target: this suite cannot be pointed at a deployed account.
export default defineConfig({
 testDir:'./tests/browser',fullyParallel:true,forbidOnly:!!process.env.CI,
 retries:0,workers:2,timeout:30000,
 reporter:[['list'],['html',{open:'never',outputFolder:'playwright-report'}]],
 use:{baseURL:'http://127.0.0.1:4173',trace:'retain-on-failure',screenshot:'only-on-failure',serviceWorkers:'block'},
 projects:[{name:'chromium',use:{...devices['Desktop Chrome']}},{name:'mobile',use:{...devices['Pixel 7'],defaultBrowserType:'chromium'}}],
 webServer:{command:'node node_modules/vite/bin/vite.js --config tests/gallery/vite.config.ts',url:'http://127.0.0.1:4173',reuseExistingServer:false,timeout:60000},
});
