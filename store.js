import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const dataDir = path.join(root, 'data');
const dbFile = path.join(dataDir, 'store.json');
fs.mkdirSync(dataDir, {recursive:true});
const initial = {discoveries:[], sources:[], scans:[], reports:[], savedPages:[], settings:{lastScanAt:null, schedulerEnabled:true}};
export function readStore(){try{return {...initial,...JSON.parse(fs.readFileSync(dbFile,'utf8'))}}catch{return structuredClone(initial)}}
export function writeStore(data){const tmp=dbFile+'.tmp';fs.writeFileSync(tmp,JSON.stringify(data,null,2));fs.renameSync(tmp,dbFile)}
export function upsertDiscoveries(items){const db=readStore();let added=0,updated=0;for(const item of items){const key=item.canonicalUrl||item.url;const old=db.discoveries.find(x=>x.canonicalUrl===key||x.url===key);if(old){Object.assign(old,item,{updatedAt:new Date().toISOString()});updated++}else{db.discoveries.unshift({...item,id:item.id||crypto.randomUUID(),discoveredAt:new Date().toISOString()});added++}}db.discoveries=db.discoveries.slice(0,5000);writeStore(db);return {added,updated,total:db.discoveries.length}}
