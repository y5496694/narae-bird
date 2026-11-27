import http from 'node:http';
import {readFileSync,writeFileSync,renameSync,mkdirSync,existsSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {randomUUID,randomBytes} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {openStore,passwordHash} from './store.mjs';
import {Bird} from './bird.mjs';
import {Tunnels} from './tunnels.mjs';
const here=dirname(fileURLToPath(import.meta.url)),exec=promisify(execFile);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const error=(status,message)=>Object.assign(Error(message),{status});
export async function createApp(options={}){
 const data=options.data||process.env.DATA_DIR||join(here,'data');mkdirSync(data,{recursive:true,mode:0o700});
 const store=openStore(join(data,'admin.sqlite')),bird=new Bird();
 const origin=options.origin||process.env.APP_ORIGIN||'https://aiedue.ddns.net';
 const secure=origin.startsWith('https:'),cookieName=secure?'__Secure-aiedue_admin':'aiedue_admin_qa';
 const routesFile=options.routesFile||process.env.ROUTES_FILE;
 const catalogFile=options.catalogFile||process.env.CATALOG_FILE||join(data,'catalog.json');
 const sync=process.env.DYNAMIC_FALLBACK==='1'?async()=>{}:options.sync|| (process.env.ROUTE_SYNC?async()=>{await exec('/usr/bin/python3',[process.env.ROUTE_SYNC],{timeout:30000,maxBuffer:256000});}:async()=>{});
 const attempts=new Map();let queue=Promise.resolve();let tunnels;
 function catalog(){try{return JSON.parse(readFileSync(catalogFile,'utf8'));}catch{return [{path:'/korean/',title:'에이두 국어'},{path:'/server',title:'에이두 크래프트'}];}}
 function reserved(){return new Set(['domain','bird','db-api','db-admin','db-cloud','admin','api','login','logout','assets','favicon.ico','robots.txt','landing','health','narae','sites',...catalog().map(x=>x.path.split('/').filter(Boolean)[0])]);}
 function authenticate(req){const bearer=String(req.headers.authorization||'').match(/^Bearer (.+)$/);const rawToken=bearer?.[1]||String(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(cookieName+'='))?.slice(cookieName.length+1);const a=store.authenticate(rawToken);return a?{...a,rawToken,bearer:!!bearer}:null;}
 function json(res,status,obj){res.writeHead(status,{'Content-Type':'application/json;charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(obj));}
 function requireActor(req){const a=authenticate(req);if(!a)throw error(401,'관리자 로그인이 필요합니다.');if(!['GET','HEAD','OPTIONS'].includes(req.method)){if(req.headers.origin&&req.headers.origin!==origin)throw error(403,'요청 출처가 올바르지 않습니다.');if(!a.bearer&&(!req.headers.origin||req.headers['x-csrf-token']!==a.csrf))throw error(403,'인증 확인이 필요합니다. 새로고침해 주세요.');}return a;}
 async function body(req){if(!String(req.headers['content-type']||'').startsWith('application/json'))throw error(415,'JSON 요청이 필요합니다.');let total=0,parts=[];for await(const b of req){total+=b.length;if(total>128*1024)throw error(413,'요청이 너무 큽니다.');parts.push(b);}try{return JSON.parse(Buffer.concat(parts).toString());}catch{throw error(400,'입력 형식이 올바르지 않습니다.');}}
 function writeRoutes(){if(process.env.DYNAMIC_FALLBACK==='1'||!routesFile)return;const paths=['/domain','/domain/*','/bird','/bird/*',...store.published().flatMap(s=>['/'+s.slug,'/'+s.slug+'/*'])];const text='@domainBird path '+paths.join(' ')+'\nhandle @domainBird {\n reverse_proxy 127.0.0.1:3099 {\n  flush_interval -1\n  transport http {\n   read_timeout 0\n   write_timeout 0\n  }\n }\n}\n';mkdirSync(dirname(routesFile),{recursive:true});writeFileSync(routesFile+'.next',text);renameSync(routesFile+'.next',routesFile);}
 async function mutate(fn){const work=queue.then(async()=>{store.db.exec('BEGIN IMMEDIATE');try{const result=fn();writeRoutes();await sync();store.db.exec('COMMIT');return result;}catch(e){store.db.exec('ROLLBACK');writeRoutes();try{await sync();}catch{}throw e;}});queue=work.catch(()=>{});return work;}
 function siteInput(b,a,old){const slug=String(b.slug||'').replace(/^\/+|\/+$/g,'').toLowerCase();if(!/^[a-z][a-z0-9-]{2,39}$/.test(slug)||reserved().has(slug))throw error(400,'주소는 영문 소문자로 시작하는 3~40자 영문·숫자·하이픈이며, 기존 주소는 사용할 수 없습니다.');if(typeof b.title!=='string'||!b.title.trim()||b.title.length>100||typeof b.content!=='string'||b.content.length>20000)throw error(400,'제목(100자)과 내용(20,000자)을 확인해 주세요.');if(!['landing','proxy'].includes(b.kind))throw error(400,'사이트 형식이 올바르지 않습니다.');const device=String(b.device||'');if(b.kind==='proxy'&&!tunnels.list(a.id).some(d=>d.id===device)&&!(old?.device===device&&old?.kind==='proxy'))throw error(400,'이 계정에 연결된 Termux 기기를 선택해 주세요.');if(store.db.prepare('SELECT id FROM sites WHERE slug=? AND id<>?').get(slug,old?.id||''))throw error(409,'이미 사용 중인 주소입니다.');return {slug,title:b.title.trim(),content:b.content,kind:b.kind,device:b.kind==='proxy'?device:'',published:b.published===false?0:1};}
 async function handle(req,res){try{
  const url=new URL(req.url,'http://localhost'),path=url.pathname;
  if(req.method==='GET'&&path==='/domain/api/health')return json(res,200,{ok:true,service:'aiedue-domain-bird',fileStorage:false});
  if(req.method==='GET'&&path==='/domain/api/public/sites')return json(res,200,{sites:store.published(),existing:catalog().filter(x=>x.landing)});
  if(req.method==='POST'&&path==='/domain/api/login'){
   if(req.headers.origin&&req.headers.origin!==origin)throw error(403,'요청 출처가 올바르지 않습니다.');const b=await body(req);const id=String(b.id||'').trim().toLowerCase();const ip=String(req.headers['x-forwarded-for']||req.socket.remoteAddress).split(',')[0].trim();const key=ip+':'+id;const now=Date.now();for(const [k,v] of attempts)if(v.expires<now)attempts.delete(k);if(attempts.size>5000)throw error(429,'잠시 뒤 다시 시도해 주세요.');const attempt=attempts.get(key)||{n:0,expires:now+15*60_000};if(attempt.n>=10)throw error(429,'로그인 시도가 많습니다. 15분 뒤 다시 시도해 주세요.');attempt.n++;attempts.set(key,attempt);
   let valid=typeof b.password==='string'&&b.password.length<=512&&await store.verify(id,b.password);
   if(!valid&&process.env.LEGACY_LOGIN_URL&&id.includes('@')){const r=await fetch(process.env.LEGACY_LOGIN_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:id,password:b.password}),signal:AbortSignal.timeout(10000)});const legacy=await r.json();if(r.ok&&legacy.user?.role==='admin'){if(!store.db.prepare('SELECT id FROM admins WHERE id=?').get(id))store.addAdminHash(id,await passwordHash(randomBytes(48).toString('hex')));valid=true;}}
   if(!valid)throw error(401,'아이디 또는 비밀번호를 확인해 주세요.');attempts.delete(key);const session=store.session(id);res.setHeader('Set-Cookie',`${cookieName}=${session.token}; Path=/domain/api; Max-Age=2592000; HttpOnly; SameSite=Lax${secure?'; Secure':''}`);return json(res,200,{id,csrf:session.csrf,...(req.headers['x-client']==='termux'?{token:session.token}:{})});
  }
  if(path.startsWith('/domain/api/')){
   const a=requireActor(req);
   if(path==='/domain/api/session'&&req.method==='GET')return json(res,200,{id:a.id,csrf:a.csrf});
   if(path==='/domain/api/logout'&&req.method==='POST'){store.revoke(a.rawToken);for(const o of bird.offers.values())if(o.source===a.hash||o.receiverSession===a.hash)bird.cancel(o,'logged-out');res.setHeader('Set-Cookie',`${cookieName}=; Path=/domain/api; Max-Age=0; HttpOnly; SameSite=Lax${secure?'; Secure':''}`);return json(res,200,{ok:true});}
   if(path==='/domain/api/catalog'&&req.method==='GET')return json(res,200,{existing:catalog(),sites:store.sites(a.id),devices:tunnels.list(a.id),dnsMode:'path'});
   if(path==='/domain/api/sites'&&req.method==='POST'){const b=await body(req);const result=await mutate(()=>{if(store.sites(a.id).length>=30)throw error(429,'계정별 사이트는 30개까지 지원합니다.');const s=siteInput(b,a),id=randomUUID(),now=Date.now();store.db.prepare('INSERT INTO sites(id,owner,slug,title,content,kind,device,published,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)').run(id,a.id,s.slug,s.title,s.content,s.kind,s.device,s.published,now,now);return store.site(id,a.id);});return json(res,201,result);}
   const sm=path.match(/^\/domain\/api\/sites\/([-a-f0-9]+)$/);
   if(sm&&['PUT','DELETE'].includes(req.method)){const b=await body(req);const result=await mutate(()=>{const old=store.site(sm[1],a.id);if(!old)throw error(404,'사이트를 찾지 못했습니다.');if(b.revision!==old.revision)throw error(409,'다른 기기에서 변경되었습니다. 목록을 새로고침해 주세요.');if(req.method==='DELETE'){store.db.prepare('DELETE FROM sites WHERE id=? AND owner=?').run(old.id,a.id);return {ok:true};}const s=siteInput(b,a,old);store.db.prepare('UPDATE sites SET slug=?,title=?,content=?,kind=?,device=?,published=?,revision=revision+1,updated_at=? WHERE id=? AND owner=?').run(s.slug,s.title,s.content,s.kind,s.device,s.published,Date.now(),old.id,a.id);return store.site(old.id,a.id);});return json(res,200,result);}
   if(path==='/domain/api/bird'&&req.method==='GET')return json(res,200,{offers:bird.list(a.id)});
   if(path==='/domain/api/bird'&&req.method==='POST')return json(res,201,bird.create(a,await body(req)));
   const bm=path.match(/^\/domain\/api\/bird\/([-a-f0-9]+)(?:\/(download|upload))?$/);
   if(bm){const o=bird.get(bm[1],a.id);if(!bm[2]&&req.method==='GET')return json(res,200,bird.view(o));if(!bm[2]&&req.method==='DELETE'){bird.cancel(o);return json(res,200,{ok:true});}if(bm[2]==='download'&&req.method==='GET')return bird.receive(o,a,req,res);if(bm[2]==='upload'&&req.method==='POST')return await bird.upload(o,a,req,res);}
   throw error(404,'요청한 기능이 없습니다.');
  }
  if(req.method==='GET'&&['/domain','/domain/','/bird','/bird/'].includes(path)){res.writeHead(200,{'Content-Type':'text/html;charset=utf-8','Cache-Control':'no-cache','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",'X-Content-Type-Options':'nosniff'});return res.end(readFileSync(join(here,'public/index.html')));}
  if(req.method==='GET'&&path==='/domain/bird.py'){res.writeHead(200,{'Content-Type':'text/x-python;charset=utf-8','Content-Disposition':'attachment; filename="bird.py"','Cache-Control':'no-cache'});return res.end(readFileSync(join(here,'bird.py')));}
  const assets={'/domain/assets/app.js':['app.js','text/javascript;charset=utf-8'],'/domain/assets/style.css':['style.css','text/css;charset=utf-8'],'/domain/assets/landing.js':['landing.js','text/javascript;charset=utf-8']};
  if(req.method==='GET'&&assets[path]){const [file,type]=assets[path];res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});return res.end(readFileSync(join(here,'public',file)));}
  const slug=path.split('/')[1],site=store.bySlug(slug);
  if(site){if(site.kind==='proxy'){if(path==='/'+site.slug&&['GET','HEAD'].includes(req.method)){res.writeHead(308,{Location:'/'+site.slug+'/'+url.search});return res.end();}if(req.method==='OPTIONS'){res.writeHead(204,{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS','Access-Control-Allow-Headers':'Content-Type,Authorization,Range'});return res.end();}return await tunnels.proxy(site,req,res,(path.slice(slug.length+1)||'/')+url.search);}if(!['GET','HEAD'].includes(req.method))throw error(405,'허용되지 않는 요청입니다.');res.writeHead(200,{'Content-Type':'text/html;charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':"default-src 'none'; style-src 'self'; base-uri 'none'; frame-ancestors 'self'",'X-Content-Type-Options':'nosniff'});return res.end(req.method==='HEAD'?'':`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(site.title)}</title><link rel="stylesheet" href="/domain/assets/style.css"><main class="site"><a href="/domain">에이두</a><h1>${esc(site.title)}</h1><p class="site-content">${esc(site.content)}</p></main></html>`);}
  throw error(404,'페이지를 찾지 못했습니다.');
 }catch(e){if(res.headersSent){res.destroy();return;}if(!e.status)console.error('domain-bird request failed:',e.code||e.name);return json(res,e.status||500,{error:e.status?e.message:'처리하지 못했습니다. 오류 코드: EDGE_INTERNAL'});}}
 const server=http.createServer(handle);server.requestTimeout=0;server.headersTimeout=60_000;
 tunnels=new Tunnels(server,authenticate,origin);writeRoutes();
 return {server,store,bird,tunnels,writeRoutes,async listen(port=Number(process.env.PORT||3099),host=process.env.HOST||'127.0.0.1'){await new Promise((resolve,reject)=>server.listen(port,host,resolve).once('error',reject));return server.address();},async close(){tunnels.close();bird.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));store.close();}};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const app=await createApp();await app.listen();console.log('Aiedue Domain/Bird ready');let stopping=false;for(const sig of ['SIGINT','SIGTERM'])process.on(sig,async()=>{if(stopping)return;stopping=true;await app.close();process.exit(0);});}
