import {spawn} from 'node:child_process';
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3011'],{windowsHide:true,stdio:['ignore','pipe','pipe']});
const base='http://127.0.0.1:3011';
try{
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Local server startup timed out')),15000);server.once('error',reject);server.once('exit',code=>reject(Error(`Local server exited: ${code}`)));server.stdout.on('data',chunk=>{if(chunk.toString().includes('Ready')){clearTimeout(timer);resolve()}})});
 const child=spawn(process.execPath,['scripts/smoke.mjs'],{windowsHide:true,env:{...process.env,SMOKE_URL:base},stdio:'inherit'});
 const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',resolve)});
 if(code!==0)process.exitCode=1;
}finally{server.kill()}
