
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {readStore,writeStore,upsertDiscoveries} from './store.js';
import {collectAll} from './collectors.js';

const root=path.dirname(fileURLToPath(import.meta.url));
const envFile=path.join(root,'.env');

if(fs.existsSync(envFile)){
  for(const line of fs.readFileSync(envFile,'utf8').split(/\r?\n/)){
    const m=line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if(m&&!process.env[m[1]])process.env[m[1]]=m[2].replace(/^['"]|['"]$/g,'');
  }
}

const port=Number(process.env.PORT||3000);
const mime={
  '.html':'text/html; charset=utf-8',
  '.css':'text/css; charset=utf-8',
  '.js':'text/javascript; charset=utf-8',
  '.json':'application/json; charset=utf-8',
  '.svg':'image/svg+xml',
  '.png':'image/png',
  '.jpg':'image/jpeg',
  '.webp':'image/webp'
};

let scanning=false;

function send(res,status,obj){
  res.writeHead(status,{
    'content-type':'application/json; charset=utf-8',
    'cache-control':'no-store',
    'access-control-allow-origin':'same-origin'
  });
  res.end(JSON.stringify(obj));
}

function readBody(req){
  return new Promise((resolve,reject)=>{
    let b='';
    req.on('data',c=>{
      b+=c;
      if(b.length>1e6)reject(new Error('Body too large'));
    });
    req.on('end',()=>{
      try{resolve(b?JSON.parse(b):{})}
      catch{reject(new Error('Invalid JSON'))}
    });
  });
}

async function scan(){
  if(scanning)return {busy:true};
  scanning=true;
  try{
    const result=await collectAll();
    const saved=upsertDiscoveries(result.items);
    const db=readStore();
    db.sources=result.sources;
    db.scans.unshift({
      at:new Date().toISOString(),
      ...saved,
      sources:result.sources
    });
    db.scans=db.scans.slice(0,200);
    db.settings.lastScanAt=new Date().toISOString();
    writeStore(db);
    return {...saved,sources:result.sources};
  }finally{
    scanning=false;
  }
}

const server=http.createServer(async(req,res)=>{
  try{
    const u=new URL(req.url,'http://localhost');

    if(req.method==='OPTIONS'){
      res.writeHead(204,{
        'access-control-allow-methods':'GET,POST,OPTIONS',
        'access-control-allow-headers':'content-type,x-openinfo-admin,x-openinfo-extension'
      });
      return res.end();
    }

    if(u.pathname.startsWith('/api/')){

      if(req.method==='GET'&&u.pathname==='/api/health'){
        return send(res,200,{
          ok:true,
          service:'OPENINFO',
          version:'1.0.0',
          scanning,
          lastScanAt:readStore().settings.lastScanAt
        });
      }

      if(req.method==='GET'&&u.pathname==='/api/categories'){
        const p=path.join(root,'categories.json');
        return send(res,200,JSON.parse(fs.readFileSync(p,'utf8')));
      }

      if(req.method==='GET'&&u.pathname==='/api/discoveries'){
        const db=readStore();
        let items=db.discoveries;
        const q=(u.searchParams.get('q')||'').toLowerCase();
        const cat=u.searchParams.get('category');
        const tab=u.searchParams.get('tab');

        if(q)items=items.filter(x=>
          (x.title+' '+x.description+' '+(x.tags||[]).join(' ')).toLowerCase().includes(q)
        );
        if(cat)items=items.filter(x=>x.category===cat);
        if(tab==='free')items=items.filter(x=>/free|open source/i.test(x.pricing));
        if(tab==='trending')items=[...items].sort((a,b)=>(b.score||0)-(a.score||0));
        if(tab==='latest')items=[...items].sort((a,b)=>new Date(b.discoveredAt)-new Date(a.discoveredAt));

        return send(res,200,{
          items:items.slice(0,100),
          total:items.length,
          lastScanAt:db.settings.lastScanAt
        });
      }

      if(req.method==='GET'&&u.pathname==='/api/status'){
        const db=readStore();
        return send(res,200,{
          sources:db.sources,
          scans:db.scans.slice(0,20),
          settings:db.settings,
          discoveryCount:db.discoveries.length
        });
      }

      if(req.method==='POST'&&u.pathname==='/api/scan'){
        const token=req.headers['x-openinfo-admin'];
        if(process.env.OPENINFO_ADMIN_TOKEN&&token!==process.env.OPENINFO_ADMIN_TOKEN){
          return send(res,401,{error:'Admin token required'});
        }
        return send(res,200,await scan());
      }

      if(req.method==='POST'&&u.pathname==='/api/extension/save'){
        const expected=process.env.OPENINFO_EXTENSION_TOKEN;
        if(!expected||req.headers['x-openinfo-extension']!==expected){
          return send(res,401,{error:'Extension token is missing or invalid'});
        }

        const body=await readBody(req);
        let parsed;
        try{parsed=new URL(body.url)}
        catch{return send(res,400,{error:'Valid page URL required'})}

        if(!['http:','https:'].includes(parsed.protocol)){
          return send(res,400,{error:'Only HTTP(S) pages can be saved'});
        }

        const db=readStore();
        const item={
          id:crypto.randomUUID(),
          title:String(body.title||parsed.hostname).slice(0,240),
          url:parsed.href,
          category:String(body.category||'General').slice(0,80),
          note:String(body.note||'').slice(0,1000),
          savedAt:new Date().toISOString()
        };
        db.savedPages.unshift(item);
        db.savedPages=db.savedPages.slice(0,2000);
        writeStore(db);
        return send(res,201,{ok:true,id:item.id});
      }

      if(req.method==='GET'&&u.pathname==='/api/extension/saved'){
        const expected=process.env.OPENINFO_EXTENSION_TOKEN;
        if(!expected||req.headers['x-openinfo-extension']!==expected){
          return send(res,401,{error:'Extension token is missing or invalid'});
        }
        return send(res,200,{items:readStore().savedPages});
      }

      if(req.method==='POST'&&u.pathname==='/api/report'){
        const body=await readBody(req);
        if(!body.message||String(body.message).length>1000){
          return send(res,400,{error:'A short report message is required'});
        }

        const db=readStore();
        db.reports.unshift({
          id:crypto.randomUUID(),
          message:String(body.message),
          url:String(body.url||'').slice(0,500),
          createdAt:new Date().toISOString()
        });
        writeStore(db);
        return send(res,201,{ok:true});
      }

      return send(res,404,{error:'API route not found'});
    }

    const rel=u.pathname==='/'?'index.html':decodeURIComponent(u.pathname).replace(/^\/+/,'');
    const allowed=new Set(['index.html','styles.css','app.js']);

    if(!allowed.has(rel)){
      res.writeHead(404);
      return res.end('Not found');
    }

    const file=path.join(root,rel);

    fs.readFile(file,(err,data)=>{
      if(err){
        res.writeHead(404);
        return res.end('Not found');
      }
      res.writeHead(200,{
        'content-type':mime[path.extname(file)]||'application/octet-stream',
        'x-content-type-options':'nosniff',
        'referrer-policy':'strict-origin-when-cross-origin'
      });
      res.end(data);
    });

  }catch(e){
    send(res,500,{error:e.message});
  }
});

server.listen(port,()=>console.log(`OPENINFO running at http://localhost:${port}`));

if(process.env.ENABLE_SCHEDULER!=='false'){
  const mins=Math.max(15,Number(process.env.SCAN_INTERVAL_MINUTES||60));
  setTimeout(()=>scan().catch(console.error),5000);
  setInterval(()=>scan().catch(console.error),mins*60000);
}
