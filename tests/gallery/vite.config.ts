import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../..',import.meta.url));
export default defineConfig({
 root:fileURLToPath(new URL('.',import.meta.url)),envDir:false,envPrefix:'TALENTIA_TEST_PUBLIC_',
 plugins:[react()],resolve:{alias:{'@':root,'next/link':fileURLToPath(new URL('link.tsx',import.meta.url))}},
 css:{postcss:fileURLToPath(new URL('../..',import.meta.url))},
 server:{host:'127.0.0.1',port:4173,strictPort:true,fs:{allow:[root]}},
});
