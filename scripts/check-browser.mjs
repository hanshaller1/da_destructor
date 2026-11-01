import {spawnSync} from 'node:child_process';
for(const file of ['tests/browser-smoke.mjs','tests/browser-files-midi.mjs','tests/browser-completion.mjs']){
 const result=spawnSync(process.execPath,[file],{stdio:'inherit',env:process.env,windowsHide:true});
 if(result.status!==0){process.exitCode=result.status||1;break;}
}
