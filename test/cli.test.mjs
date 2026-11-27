import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync,readdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {randomBytes,createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {createApp} from '../server.mjs';
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(fn){for(let n=0;n<160;n++){const value=fn();if(value)return value;await wait(50);}throw Error('CLI readiness timed out');}

test('actual Python send/receive preserve bytes, reject overwrite and remove partial downloads', {timeout:30000}, async t=>{
 const dir=mkdtempSync(join(tmpdir(),'bird-cli-qa-'));
 const app=await createApp({data:join(dir,'data'),origin:'http://qa.local'});
 const addr=await app.listen(0),base='http://127.0.0.1:'+addr.port;
 await app.store.addAdmin('cli-user',randomBytes(24).toString('hex'));
 const sender=app.store.session('cli-user'),receiver=app.store.session('cli-user');
 const children=[];
 t.after(async()=>{for(const child of children)if(child.exitCode===null)child.kill();await app.close();await wait(150);rmSync(dir,{recursive:true,force:true});});
 for(const [name,session] of [['sender',sender],['receiver',receiver]])writeFileSync(join(dir,name+'.json'),JSON.stringify({base,token:session.token,id:session.id}),{mode:0o600});
 function cli(auth,args){
  const child=spawn('python',[resolve('bird.py'),'--base',base,'--auth',join(dir,auth+'.json'),...args],{stdio:['ignore','pipe','pipe'],env:{...process.env,PYTHONIOENCODING:'utf-8'}});
  children.push(child);let stdout='',stderr='';child.stdout.on('data',b=>stdout+=b);child.stderr.on('data',b=>stderr+=b);
  const done=new Promise(resolve=>{child.on('error',error=>resolve({code:-1,stderr:error.message}));child.on('close',code=>resolve({code,stdout,stderr}));});
  return {child,done};
 }
 const bytes=randomBytes(1024*1024+127),source=join(dir,'source.bin'),target=join(dir,'received.bin');writeFileSync(source,bytes);
 const sending=cli('sender',['send',source,'--label','CLI-regression']);
 const offer=await until(()=>app.bird.list('cli-user').find(o=>o.device==='CLI-regression'));
 const receiving=cli('receiver',['receive',offer.id,'--out',target]);
 const [sent,got]=await Promise.all([sending.done,receiving.done]);
 assert.equal(sent.code,0,sent.stderr);assert.equal(got.code,0,got.stderr);
 assert.deepEqual(readFileSync(target),bytes);
 assert.equal(app.bird.get(offer.id,'cli-user').sha256,createHash('sha256').update(bytes).digest('hex'));
 const actor=app.store.authenticate(sender.token);
 const overwrite=app.bird.create(actor,{name:'preserve.bin',size:bytes.length});
 const denied=await cli('receiver',['receive',overwrite.id,'--out',target]).done;
 assert.equal(denied.code,1);assert.deepEqual(readFileSync(target),bytes);
 assert.equal(app.bird.get(overwrite.id,'cli-user').state,'waiting');
 const aborted=app.bird.create(actor,{name:'partial.bin',size:100000}),partial=join(dir,'partial.bin');
 const pending=cli('receiver',['receive',aborted.id,'--out',partial]);
 await until(()=>app.bird.get(aborted.id,'cli-user').state==='ready');
 app.bird.cancel(app.bird.get(aborted.id,'cli-user'));
 assert.equal((await pending.done).code,1);
 assert.ok(!readdirSync(dir).some(name=>name==='partial.bin'||name.endsWith('.part')));
});
