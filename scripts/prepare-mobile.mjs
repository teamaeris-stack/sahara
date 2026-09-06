import { renameSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
if(existsSync('mobile-dist/mobile.html'))renameSync('mobile-dist/mobile.html','mobile-dist/index.html');
// Precache all generated assets and the index, not only previously visited screens.
import { readdirSync } from 'node:fs';
const files=(dir,prefix='')=>readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(dir+'/'+e.name,prefix+'/'+e.name):[prefix+'/'+e.name]);
const manifest=files('mobile-dist').filter(p=>p!=='/sw.js');
const worker=readFileSync('public/sw.js','utf8').replace(/const CORE = \[[\s\S]*?\];/,`const CORE = ${JSON.stringify(['/',...manifest])};`);
writeFileSync('mobile-dist/sw.js',worker);
console.log('Packaged offline mobile assets:',manifest.length);
// After cap add android, this script can be run again to declare foreground GPS permissions.
const path='android/app/src/main/AndroidManifest.xml';
if(existsSync(path)){
  let xml=readFileSync(path,'utf8');
  for(const p of ['ACCESS_COARSE_LOCATION','ACCESS_FINE_LOCATION'])if(!xml.includes('android.permission.'+p))xml=xml.replace('</manifest>',`<uses-permission android:name="android.permission.${p}" />\n</manifest>`);
  writeFileSync(path,xml);
}
