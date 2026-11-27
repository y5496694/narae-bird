"""Create a local administrator without password arguments or default credentials."""
import getpass
import json
import os
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]
NODE_CODE = r"""
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {openStore} from './store.mjs';
const {id,password}=JSON.parse(readFileSync(0,'utf8'));
const store=openStore(join(process.env.DATA_DIR || 'data','admin.sqlite'));
try {
  if(store.db.prepare('SELECT id FROM admins WHERE id=?').get(id)) {
    console.error('Administrator already exists; no changes made.');process.exitCode=1;
  } else {await store.addAdmin(id,password);console.log('Administrator created.');}
} finally {store.close();}
"""


def create_admin(admin_id, password, data_dir=None):
    admin_id = admin_id.strip().lower()
    if len(password) < 12:
        raise ValueError('Use a password with at least 12 characters.')
    env = dict(os.environ)
    if data_dir is not None:
        env['DATA_DIR'] = str(Path(data_dir).resolve())
    return subprocess.run(
        ['node', '--input-type=module', '-e', NODE_CODE], cwd=ROOT,
        input=json.dumps({'id': admin_id, 'password': password}),
        text=True, env=env, check=False,
    ).returncode


def main():
    admin_id = input('Administrator ID: ')
    password = getpass.getpass('Password (12+ characters): ')
    if password != getpass.getpass('Confirm password: '):
        raise ValueError('Passwords do not match.')
    return create_admin(admin_id, password)


if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except (ValueError, EOFError, KeyboardInterrupt) as error:
        print(str(error) or 'Cancelled.')
        raise SystemExit(1)
