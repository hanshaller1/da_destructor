import {mkdir,copyFile,writeFile,readdir} from 'node:fs/promises';
import path from 'node:path';
const root=process.cwd(), out=path.join(root,'dist');
await mkdir(out,{recursive:true});
for(const name of await readdir(root)) if(/\.(mjs|css|html)$/.test(name)&&name!=='server.mjs') await copyFile(path.join(root,name),path.join(out,name));
await writeFile(path.join(out,'_headers'),'/*\n  Cache-Control: no-cache\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  Permissions-Policy: microphone=(self)\n');
console.log('Built static application in dist/');
