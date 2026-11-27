import {DatabaseSync} from 'node:sqlite';
import {randomBytes, scrypt as scryptCb, timingSafeEqual, createHash} from 'node:crypto';
import {promisify} from 'node:util';
import {mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
const scrypt=promisify(scryptCb);
export const digest=s=>createHash('sha256').update(s).digest('hex');
export async function passwordHash(password){const salt=randomBytes(16).toString('hex');return salt+':'+(await scrypt(password,salt,32)).toString('hex');}
export async function passwordMatches(password,encoded){const [salt,hash]=String(encoded).split(':');if(!salt||!hash)return false;const b=await scrypt(String(password),salt,32);const a=Buffer.from(hash,'hex');return a.length===b.length&&timingSafeEqual(a,b);}
export function openStore(file){
 mkdirSync(dirname(file),{recursive:true,mode:0o700});const db=new DatabaseSync(file);
 db.exec(`PRAGMA journal_mode=WAL;PRAGMA foreign_keys=ON;PRAGMA busy_timeout=5000;
 CREATE TABLE IF NOT EXISTS admins(id TEXT PRIMARY KEY, password_hash TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS sessions(hash TEXT PRIMARY KEY, admin_id TEXT NOT NULL REFERENCES admins(id), csrf TEXT NOT NULL, expires INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS sites(id TEXT PRIMARY KEY, owner TEXT NOT NULL REFERENCES admins(id),slug TEXT UNIQUE NOT NULL,title TEXT NOT NULL,content TEXT NOT NULL,kind TEXT NOT NULL,device TEXT NOT NULL DEFAULT '',published INTEGER NOT NULL DEFAULT 1,revision INTEGER NOT NULL DEFAULT 1,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL);
 CREATE INDEX IF NOT EXISTS sessions_owner ON sessions(admin_id);`);
 return {
  db,
  async addAdmin(id,password){if(!/^[a-zA-Z0-9@._-]{3,100}$/.test(id))throw Error('Invalid admin ID');if(String(password).length<6)throw Error('Password must have at least 6 characters');db.prepare('INSERT INTO admins(id,password_hash,created_at) VALUES(?,?,?)').run(id,await passwordHash(password),Date.now());},
  addAdminHash(id,hash){db.prepare('INSERT INTO admins(id,password_hash,created_at) VALUES(?,?,?)').run(id,hash,Date.now());},
  async verify(id,password){const u=db.prepare('SELECT * FROM admins WHERE id=? AND enabled=1').get(id);if(!u){await scrypt(String(password),'missing-account-padding',32);return false;}return passwordMatches(password,u.password_hash);},
  session(id){const token=randomBytes(32).toString('base64url'),csrf=randomBytes(24).toString('base64url');db.prepare('DELETE FROM sessions WHERE expires<?').run(Date.now());db.prepare('INSERT INTO sessions VALUES(?,?,?,?)').run(digest(token),id,csrf,Date.now()+30*86400_000);return {token,csrf,id};},
  authenticate(token){if(!token)return null;return db.prepare('SELECT s.*,a.id FROM sessions s JOIN admins a ON a.id=s.admin_id WHERE s.hash=? AND s.expires>? AND a.enabled=1').get(digest(token),Date.now());},
  revoke(token){db.prepare('DELETE FROM sessions WHERE hash=?').run(digest(token));},
  sites(owner){return db.prepare('SELECT * FROM sites WHERE owner=? ORDER BY created_at DESC').all(owner);},
  published(){return db.prepare('SELECT slug,title,content,kind FROM sites WHERE published=1 ORDER BY created_at').all();},
  site(id,owner){return db.prepare('SELECT * FROM sites WHERE id=? AND owner=?').get(id,owner);},
  bySlug(slug){return db.prepare('SELECT * FROM sites WHERE slug=? AND published=1').get(slug);},
  close(){db.close();}
 };
}
