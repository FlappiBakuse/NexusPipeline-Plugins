from __future__ import annotations

import io
import sys
import tempfile
import unittest
import urllib.request
import urllib.error
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import repository_release_api as api


class ReleaseApiTests(unittest.TestCase):
    def test_transient_reads_are_bounded_but_writes_are_not_blindly_retried(self):
        class Opener:
            def __init__(self):
                self.calls = 0
            def open(self, request, timeout):
                self.calls += 1
                if self.calls == 1:
                    raise urllib.error.HTTPError(request.full_url, 503, "temporary", {}, io.BytesIO(b"busy"))
                response = io.BytesIO(b"{}")
                response.status = 200
                return response

        read = Opener()
        with patch.object(api.urllib.request, "build_opener", return_value=read), \
             patch.object(api.time, "sleep"):
            self.assertEqual(api._request("GET", "/repos/owner/repo/releases/1", "token"), (200, b"{}"))
        self.assertEqual(read.calls, 2)

        write = Opener()
        with patch.object(api.urllib.request, "build_opener", return_value=write), \
             patch.object(api.time, "sleep"), \
             self.assertRaisesRegex(api.ReleaseApiError, "HTTP 503"):
            api._request("PATCH", "/repos/owner/repo/releases/1", "token", body=b"{}")
        self.assertEqual(write.calls, 1)
    def test_preview_compare_accepts_only_forward_ancestry(self):
        import json
        for status, allowed in (("ahead", True), ("identical", True),
                                ("behind", False), ("diverged", False)):
            with self.subTest(status=status), patch.object(
                api, "_request", return_value=(200, json.dumps({"status": status}).encode())
            ) as request:
                self.assertEqual(api.is_ancestor("owner/repo", "a" * 40, "b" * 40, "token"), allowed)
                self.assertEqual(request.call_args.args[1],
                                 "/repos/owner/repo/compare/" + "a" * 40 + "..." + "b" * 40)

    def test_draft_lookup_uses_listing_and_rejects_ambiguity(self):
        import json
        draft = {"id": 1, "tag_name": "plugins-develop", "draft": True}
        for matches in ([], [draft], [draft, {**draft, "id": 2}]):
            with patch.object(api, "_request", side_effect=[api.ReleaseApiError("not found", status_code=404), (200, json.dumps(matches).encode())]) as request:
                if len(matches) > 1:
                    with self.assertRaisesRegex(api.ReleaseApiError, "Multiple releases"):
                        api.get_release("owner/repo", "plugins-develop", "test-token")
                else:
                    self.assertEqual(api.get_release("owner/repo", "plugins-develop", "test-token"), draft if matches else None)
                self.assertEqual(request.call_args.args[1], "/repos/owner/repo/releases?per_page=100&page=1")

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
