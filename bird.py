#!/usr/bin/env python3
"""Narae Bird + Termux connector. Files are streamed, never staged on the relay."""
import argparse,base64,concurrent.futures,getpass,hashlib,http.client,json,os,pathlib,sys,threading,time,urllib.request,urllib.error,urllib.parse,uuid
DEFAULT='https://aiedue.ddns.net'
class Client:
 def __init__(self,base,auth):
  self.base=base.rstrip('/');self.auth=pathlib.Path(auth).expanduser();self.token=''
  if self.auth.exists():
   saved=json.loads(self.auth.read_text());
   if saved.get('base')==self.base:self.token=saved.get('token','')
 def api(self,path,method='GET',body=None):
  data=json.dumps(body).encode() if body is not None else None
  req=urllib.request.Request(self.base+'/domain/api/'+path,data=data,method=method,headers={'Authorization':'Bearer '+self.token,'Content-Type':'application/json','X-Client':'termux'})
  try:
   with urllib.request.urlopen(req,timeout=35) as r:return json.load(r)
  except urllib.error.HTTPError as e:
   try:message=json.load(e).get('error',str(e))
   except Exception:message=str(e)
   raise RuntimeError(message) from None
 def save(self,data):
  self.auth.parent.mkdir(parents=True,exist_ok=True,mode=0o700);fd=os.open(self.auth,os.O_WRONLY|os.O_CREAT|os.O_TRUNC,0o600)
  with os.fdopen(fd,'w') as f:json.dump({'base':self.base,'token':data['token'],'id':data['id']},f)
  os.chmod(self.auth,0o600);self.token=data['token']
 def login(self,user):
  data=self.api('login','POST',{'id':user or input('아이디: '),'password':getpass.getpass('비밀번호: ')})
  self.save(data);print('로그인됨:',data['id'],'(세션 파일 권한 600)')
 def upload(self,offer,file):
  u=urllib.parse.urlsplit(self.base);conn=(http.client.HTTPSConnection if u.scheme=='https' else http.client.HTTPConnection)(u.hostname,u.port,timeout=1800)
  try:
   conn.putrequest('POST',(u.path.rstrip('/') if u.path else '')+'/domain/api/bird/'+offer['id']+'/upload');conn.putheader('Authorization','Bearer '+self.token);conn.putheader('Content-Type','application/octet-stream');conn.putheader('Content-Length',str(offer['size']));conn.endheaders()
   sent=0
   with file.open('rb') as f:
    while sent<offer['size']:
     b=f.read(min(65536,offer['size']-sent))
     if not b:raise RuntimeError('전송 중 파일 크기가 달라졌습니다.')
     conn.send(b);sent+=len(b)
   r=conn.getresponse();data=r.read()
   if r.status!=200:raise RuntimeError('전송 실패: HTTP '+str(r.status))
   result=json.loads(data);print('전송 완료:',sent,'bytes; SHA-256',result['sha256']);return result
  finally:conn.close()
 def send(self,path,label):
  file=pathlib.Path(path).expanduser().resolve();stat=file.stat()
  if not file.is_file():raise RuntimeError('일반 파일만 보낼 수 있습니다.')
  offer=self.api('bird','POST',{'name':file.name,'size':stat.st_size,'device':label});print('송신 등록:',offer['id'],file.name,stat.st_size,'bytes',flush=True);print('다른 기기에서 수신을 선택할 때까지 이 명령을 유지하세요.',flush=True)
  try:
   while True:
    status=self.api('bird/'+offer['id'])['state']
    if status=='ready':
     if (file.stat().st_size,file.stat().st_mtime_ns)!=(stat.st_size,stat.st_mtime_ns):raise RuntimeError('등록 이후 파일이 변경되었습니다. 다시 등록하세요.')
     return self.upload(offer,file)
    if status!='waiting':raise RuntimeError('전송 종료: '+status)
    time.sleep(1)
  except BaseException:
   try:self.api('bird/'+offer['id'],'DELETE')
   except Exception:pass
   raise
 def receive(self,id,out):
  offer=self.api('bird/'+id);target=pathlib.Path(out or pathlib.Path(offer['name']).name).expanduser().resolve()
  if target.exists():raise RuntimeError('이미 있는 파일은 덮어쓰지 않습니다: '+str(target))
  target.parent.mkdir(parents=True,exist_ok=True);part=target.with_name(target.name+'.'+uuid.uuid4().hex+'.part');req=urllib.request.Request(self.base+'/domain/api/bird/'+id+'/download',headers={'Authorization':'Bearer '+self.token});size=0;sha=hashlib.sha256()
  try:
   with urllib.request.urlopen(req,timeout=1800) as r,part.open('xb') as f:
    while True:
     b=r.read(65536)
     if not b:break
     f.write(b);sha.update(b);size+=len(b)
   if size!=offer['size']:raise RuntimeError('일부만 받았습니다. 다시 전송해 주세요.')
   for _ in range(20):
    state=self.api('bird/'+id)
    if state['state']=='completed':break
    time.sleep(.1)
   if state.get('sha256')!=sha.hexdigest():raise RuntimeError('파일 해시 검증에 실패했습니다.')
   if target.exists():raise RuntimeError('같은 이름의 파일이 생겼습니다. 다른 이름을 지정하세요.')
   part.rename(target);print('수신 완료:',target,'SHA-256',sha.hexdigest());return target
  finally:
   if part.exists():part.unlink()
 def connect(self,port,label):
  try:import websocket
  except ImportError:raise RuntimeError('먼저 pip install websocket-client 를 실행하세요.') from None
  if not 1024<=port<=65535:raise RuntimeError('포트는 1024~65535를 지정하세요.')
  device_file=self.auth.with_name('device-id');device_file.parent.mkdir(parents=True,exist_ok=True,mode=0o700)
  if not device_file.exists():device_file.write_text(str(uuid.uuid4()));os.chmod(device_file,0o600)
  device_id=device_file.read_text().strip();backoff=1
  while True:
   ws=None;jobs={};lock=threading.Lock();pool=concurrent.futures.ThreadPoolExecutor(max_workers=8)
   try:
    self.api('session');url=self.base.replace('https://','wss://',1).replace('http://','ws://',1)+'/domain/api/connect';ws=websocket.create_connection(url,header={'Authorization':'Bearer '+self.token},suppress_origin=True,timeout=60,enable_multithread=True)
    def send(m):
     with lock:ws.send(json.dumps(m,separators=(',',':')))
    def work(m,job):
     conn=http.client.HTTPConnection('127.0.0.1',port,timeout=60)
     try:
      path=m['path']
      if not path.startswith('/') or '\r' in path or '\n' in path:raise ValueError('path')
      body=base64.b64decode(m.get('body',''),validate=True);conn.request(m['method'],path,body=body or None,headers=m.get('headers',{}));r=conn.getresponse();headers={k.lower():v for k,v in r.getheaders()};send({'t':'headers','id':m['id'],'status':r.status,'headers':headers})
      while not job['cancel'].is_set():
       b=r.read(65536)
       if not b:break
       job['ack'].clear();send({'t':'chunk','id':m['id'],'data':base64.b64encode(b).decode()})
       if not job['ack'].wait(300) or job['cancel'].is_set():raise RuntimeError('cancelled')
      if not job['cancel'].is_set():send({'t':'end','id':m['id']})
     except Exception:
      try:send({'t':'error','id':m['id']})
      except Exception:pass
     finally:conn.close();jobs.pop(m['id'],None)
    send({'t':'hello','id':device_id,'label':label,'port':port});print('Termux 연결 중:',device_id,'로컬 포트',port,flush=True);backoff=1
    while True:
     raw=ws.recv()
     if not raw:raise RuntimeError('연결 종료')
     m=json.loads(raw)
     if m['t']=='registered':print('연결됨. /domain 에서 이 기기를 선택하세요.',flush=True)
     elif m['t']=='request':
      if len(jobs)>=8:send({'t':'error','id':m['id']});continue
      job={'ack':threading.Event(),'cancel':threading.Event()};jobs[m['id']]=job;pool.submit(work,m,job)
     elif m['t']=='ack' and m['id'] in jobs:jobs[m['id']]['ack'].set()
     elif m['t']=='cancel' and m['id'] in jobs:jobs[m['id']]['cancel'].set();jobs[m['id']]['ack'].set()
   except KeyboardInterrupt:raise
   except Exception as e:
    print('연결 재시도:',type(e).__name__,'(',backoff,'초 후 )',file=sys.stderr,flush=True)
    time.sleep(backoff);backoff=min(30,backoff*2)
   finally:
    for job in list(jobs.values()):job['cancel'].set();job['ack'].set()
    if ws:ws.close()
    pool.shutdown(wait=False,cancel_futures=True)

def main():
 p=argparse.ArgumentParser(description='나래 버드 실시간 파일 전송 / Termux 서버 연결');p.add_argument('--base',default=DEFAULT);p.add_argument('--auth',default='~/.config/narae-bird/auth.json');sub=p.add_subparsers(dest='cmd',required=True)
 login=sub.add_parser('login');login.add_argument('--id');sub.add_parser('logout');sub.add_parser('list');s=sub.add_parser('send');s.add_argument('file');s.add_argument('--label',default='Termux / CLI');r=sub.add_parser('receive');r.add_argument('id');r.add_argument('--out');c=sub.add_parser('connect');c.add_argument('--port',type=int,required=True);c.add_argument('--label',default='Termux');a=p.parse_args();client=Client(a.base,a.auth)
 try:
  if a.cmd=='login':client.login(a.id)
  elif a.cmd=='logout':client.api('logout','POST',{});client.auth.unlink(missing_ok=True);print('로그아웃됨')
  elif a.cmd=='list':
   for o in client.api('bird')['offers']:print(o['id'],o['state'],o['size'],o['name'])
  elif a.cmd=='send':client.send(a.file,a.label)
  elif a.cmd=='receive':client.receive(a.id,a.out)
  elif a.cmd=='connect':client.connect(a.port,a.label)
 except KeyboardInterrupt:print('\n종료됨',file=sys.stderr);return 130
 except Exception as e:print('오류:',str(e),file=sys.stderr);return 1
 return 0
if __name__=='__main__':sys.exit(main())
