from __future__ import annotations

import io
import tempfile
import unittest
import urllib.request
from pathlib import Path
from unittest.mock import patch

from tools import repository_release_api as api


class ReleaseApiTests(unittest.TestCase):
    def test_upload_host_and_binary_download_accept(self):
        observed = []
        class Opener:
            def open(self, request, timeout):
                observed.append(request)
                response = io.BytesIO(b'{"id":1}' if request.get_method() == "POST" else b"ZIP bytes")
                response.status = 201 if request.get_method() == "POST" else 200
                return response
        with tempfile.TemporaryDirectory() as temporary, patch.object(api.urllib.request, "build_opener", return_value=Opener()):
            asset = Path(temporary) / "package.zip"
            asset.write_bytes(b"ZIP bytes")
            self.assertEqual(api.upload_asset("owner/repo", 7, asset, "test-token", name="package.zip"), {"id": 1})
            self.assertEqual(api.download_asset("owner/repo", 1, "test-token"), b"ZIP bytes")
        self.assertEqual(observed[0].full_url, "https://uploads.github.com/repos/owner/repo/releases/7/assets?name=package.zip")
        self.assertEqual(observed[1].get_header("Accept"), "application/octet-stream")

    def test_redirect_drops_credentials_and_rejects_other_origins(self):
        handler = api.AssetRedirectHandler()
        request = urllib.request.Request("https://api.github.com/repos/owner/repo/releases/assets/1", headers={"Authorization": "Bearer test-token", "Accept": "application/octet-stream"})
        redirected = handler.redirect_request(request, None, 302, "Found", {}, "https://release-assets.githubusercontent.com/asset")
        self.assertIsNone(redirected.get_header("Authorization"))
        self.assertEqual(redirected.get_header("Accept"), "application/octet-stream")
        for url in ("http://release-assets.githubusercontent.com/asset", "https://attacker.example/asset", "https://api.github.com@attacker.example/a", "https://api.github.com:444/a"):
            with self.subTest(url=url), self.assertRaises(api.ReleaseApiError):
                handler.redirect_request(request, None, 302, "Found", {}, url)
        upload = urllib.request.Request("https://uploads.github.com/repos/owner/repo/releases/7/assets", data=b"bytes", method="POST")
        with self.assertRaises(api.ReleaseApiError):
            handler.redirect_request(upload, None, 302, "Found", {}, "https://api.github.com/a")


if __name__ == "__main__":
    unittest.main()
