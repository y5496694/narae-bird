import importlib.util
from contextlib import closing
import json
from pathlib import Path
import secrets
import sqlite3
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('create_admin', ROOT / 'ops/create-admin.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class CreateAdminTests(unittest.TestCase):
    def test_creates_lowercase_id_and_preserves_existing_account(self):
        with tempfile.TemporaryDirectory() as data:
            password = secrets.token_urlsafe(24)
            self.assertEqual(module.create_admin(' Test-Admin ', password, data), 0)
            with closing(sqlite3.connect(str(Path(data) / 'admin.sqlite'))) as db:
                before = db.execute('SELECT id,password_hash FROM admins').fetchone()
            self.assertEqual(before[0], 'test-admin')
            self.assertNotIn(password, before[1])
            check = subprocess.run(
                ['node', '--input-type=module', '-e', "import {passwordMatches} from './store.mjs';import {readFileSync} from 'node:fs';const x=JSON.parse(readFileSync(0,'utf8'));if(!await passwordMatches(x.password,x.hash))process.exit(1);"],
                cwd=ROOT, input=json.dumps({'password': password, 'hash': before[1]}),
                text=True, capture_output=True,
            )
            self.assertEqual(check.returncode, 0)
            self.assertEqual(module.create_admin('test-admin', secrets.token_urlsafe(24), data), 1)
            with closing(sqlite3.connect(str(Path(data) / 'admin.sqlite'))) as db:
                self.assertEqual(db.execute('SELECT id,password_hash FROM admins').fetchone(), before)

    def test_rejects_short_password_before_creating_data(self):
        with tempfile.TemporaryDirectory() as root:
            data = Path(root) / 'unused'
            with self.assertRaises(ValueError):
                module.create_admin('test-admin', secrets.token_hex(3), data)
            self.assertFalse(data.exists())


if __name__ == '__main__':
    unittest.main()
