import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

// Minimal XML DOM adapter for the production OSM parser in Node tests only.
const attrs=text=>Object.fromEntries([...text.matchAll(/([\w:]+)="([^"]*)"/g)].map(m=>[m[1],m[2]]));
const element=(localName,text,children=[])=>({localName,children,getAttribute:key=>attrs(text)[key]??null});
class DOMParser {
  parseFromString(xml){
    const nodes=[...xml.matchAll(/<node\b([^>]*?)\/?>(?:<\/node>)?/g)].map(m=>element('node',m[1]));
    const ways=[...xml.matchAll(/<way\b([^>]*?)>([\s\S]*?)<\/way>/g)].map(m=>element('way',m[1],[...m[2].matchAll(/<(nd|tag)\b([^>]*?)\/>/g)].map(t=>element(t[1],t[2]))));
    return {querySelector:()=>null,querySelectorAll:tag=>tag==='node'?nodes:tag==='way'?ways:[]};
  }
}
function load(path){
  const module={exports:{}};
  const code=ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  vm.runInNewContext(code,{module,exports:module.exports,DOMParser,require:id=>id==='./sos'?{FALLBACK_LOCATION:{latitude:10.1076,longitude:76.3516}}:new Proxy({},{get:()=>()=>null})});return module.exports;
}
test('actual OSM routes change when selected roads are blocked; nearer demo shelters',()=>{
  const routing=load('src/lib/offline-routing.ts');const {SHELTERS}=load('src/lib/shelters.ts');
  const map=routing.parseOsm(readFileSync('public/maps/aluva.osm','utf8'));const start={lat:10.1076,lng:76.3516};
  let verified=0;
  for(const shelter of SHELTERS){
    const base=routing.calculateWalkingRoute(map,start,shelter.geo);assert.ok(base,shelter.id);
    if(shelter.status!=='FULL')assert.ok(base.distanceKm<3,`${shelter.id}: ${base.distanceKm}`);
    let changed=null;
    for(const segment of base.segments){
      const next=routing.calculateWalkingRoute(map,start,shelter.geo,new Set([segment.wayId]));
      if(next){assert.ok(!next.wayIds.includes(segment.wayId));assert.notEqual(JSON.stringify(next.coordinates),JSON.stringify(base.coordinates));changed=next;break;}
    }
    if(changed)verified++;
    console.log(shelter.id,base.distanceKm,'km; reroute',changed?.distanceKm??'unavailable');
  }
  assert.ok(verified>=4);
  const none=routing.calculateWalkingRoute(map,start,SHELTERS[0].geo,new Set(map.roads.map(r=>r.id)));assert.equal(none,null);
  let minimum=Infinity;for(let i=0;i<SHELTERS.length;i++)for(let j=i+1;j<SHELTERS.length;j++)minimum=Math.min(minimum,routing.haversineMetres(SHELTERS[i].geo,SHELTERS[j].geo));
  assert.ok(minimum>800);console.log('Minimum shelter spacing',Math.round(minimum),'m');
});
