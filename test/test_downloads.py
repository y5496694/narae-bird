"""Offline fixtures test catalog handling, not real APK/device execution."""
import copy
import importlib.util
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("downloads", ROOT / "ops/sync-downloads.py")
downloads = importlib.util.module_from_spec(spec)
spec.loader.exec_module(downloads)


def fixture():
    return {"apps": [{"packageName": "com.aiedue.naraeon", "versionName": "1.1.16-local.72",
                      "versionCode": 428373, "minSdk": 29, "abis": ["arm64-v8a"],
                      "url": "https://aiedue.ddns.net/db-cloud/shr_fixture72/download",
                      "detailUrl": "https://aiedue.ddns.net/appstore/apps/naraeon/fixture72/",
                      "bytes": 123456, "sha256": "a" * 64}]}


class DownloadsTests(unittest.TestCase):
    def test_current_app_and_remote_links(self):
        text = downloads.render(fixture())
        for value in ("1.1.16-local.72", "shr_fixture72/download", "API 29", "arm64-v8a",
                      "remote-naraeon-cli/releases/latest", "F-Droid", "매시간"):
            self.assertIn(value, text)

    def test_new_store_release_replaces_old_link(self):
        data = fixture()
        data["apps"][0].update(versionName="1.1.17", versionCode=428374,
                                url="https://aiedue.ddns.net/db-cloud/shr_fixture73/download")
        text = downloads.render(data)
        self.assertIn("1.1.17", text)
        self.assertIn("shr_fixture73/download", text)
        self.assertNotIn("shr_fixture72", text)

    def test_unrelated_app_never_selected(self):
        data = fixture()
        other = copy.deepcopy(data["apps"][0])
        other.update(packageName="com.aiedue.naraeon.updater", versionName="malicious[html]")
        data["apps"].insert(0, other)
        self.assertNotIn("malicious", downloads.render(data))

    def test_withdrawal_does_not_keep_apk(self):
        text = downloads.render({"apps": []})
        self.assertIn("현재 스토어 배포 없음", text)
        self.assertNotIn("shr_fixture72", text)
        self.assertNotIn("[나래온 최신 APK 다운로드]", text)

    def test_duplicate_package_is_rejected(self):
        data = fixture()
        data["apps"].append(copy.deepcopy(data["apps"][0]))
        with self.assertRaises(ValueError):
            downloads.render(data)

    def test_reject_unsafe_urls(self):
        for value in ("http://aiedue.ddns.net/db-cloud/shr_x/download",
                      "https://evil.test/db-cloud/shr_x/download",
                      "https://user@aiedue.ddns.net/db-cloud/shr_x/download",
                      "https://aiedue.ddns.net/db-cloud/shr_x/download?token=x",
                      "https://aiedue.ddns.net/db-cloud/shr_x/download#x",
                      "javascript:alert(1)",
                      "https://aiedue.ddns.net:443/db-cloud/shr_x/download",
                      "https://aiedue.ddns.net/db-cloud/shr_x/download\n"):
            with self.subTest(value=value):
                data = fixture()
                data["apps"][0]["url"] = value
                with self.assertRaises(ValueError):
                    downloads.render(data)

    def test_reject_unsafe_detail(self):
        data = fixture()
        data["apps"][0]["detailUrl"] = "https://evil.test/"
        with self.assertRaises(ValueError):
            downloads.render(data)

    def test_reject_bad_metadata(self):
        for key, value in (("versionName", "[fake](https://evil.test)"), ("sha256", "bad"),
                           ("bytes", -1), ("versionCode", True), ("minSdk", "29"),
                           ("abis", ["arm64-v8a", "<script>"])):
            with self.subTest(key=key):
                data = fixture()
                data["apps"][0][key] = value
                with self.assertRaises(ValueError):
                    downloads.render(data)

    def test_wrong_catalog_shape_rejected(self):
        for data in (None, [], {}, {"apps": "bad"}, {"apps": [None]}):
            with self.subTest(data=data):
                with self.assertRaises(ValueError):
                    downloads.render(data)

    def test_idempotent_atomic_write(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "downloads.md"
            self.assertTrue(downloads.write_document(path, downloads.render(fixture())))
            before = path.stat().st_mtime_ns
            self.assertFalse(downloads.write_document(path, downloads.render(fixture())))
            self.assertEqual(before, path.stat().st_mtime_ns)
            self.assertEqual([path], list(path.parent.iterdir()))

    def test_fetch_error_preserves_existing_document(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "downloads.md"
            path.write_bytes(b"existing document")
            with patch.object(downloads, "fetch_catalog", side_effect=OSError("offline")):
                self.assertEqual(1, downloads.main(["--output", str(path)]))
            self.assertEqual(b"existing document", path.read_bytes())

    def test_check_detects_changes_without_writing(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "downloads.md"
            path.write_bytes(b"old")
            with patch.object(downloads, "fetch_catalog", return_value=fixture()):
                self.assertEqual(1, downloads.main(["--check", "--output", str(path)]))
            self.assertEqual(b"old", path.read_bytes())


if __name__ == "__main__":
    unittest.main()
