import { readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
async function check(dir){
  for(const entry of await readdir(dir,{withFileTypes:true})){
    const file=`${dir}/${entry.name}`;
    if(entry.isDirectory())await check(file);
    else if(/\.(m?js)$/.test(file)){
      const result=spawnSync(process.execPath,['--check',file],{stdio:'inherit'});
      if(result.status!==0)process.exit(1);
    }
  }
}
await check('js');await check('scripts');await check('tests');console.log('Source syntax checks passed');
