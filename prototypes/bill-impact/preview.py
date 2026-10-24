"""Serve the isolated bill-impact design study and its saved JSON fixtures."""

import argparse
from http.server import BaseHTTPRequestHandler, HTTPServer
import json
from pathlib import Path
import sys
from urllib.parse import urlsplit


HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
FIXTURES = {
    "bill": "agents/hr973-expected-output.json",
    "company": "company.json",
    "forecast": "tests/hr973-forecast.json",
    "results": "tests/hr973-impact-results.json",
    "plan": "tests/hr973-impact-plan.json",
    "brief": "tests/hr973-brief.json",
}
DIST = HERE / "dist"


def build_assets():
    """Expose only built frontend files, never arbitrary repository paths."""
    import mimetypes

    if not (DIST / "index.html").is_file():
        raise SystemExit("Build the frontend first: cd prototypes/bill-impact && npm install && npm run build")
    assets = {"/": (DIST / "index.html", "text/html")}
    for file in DIST.rglob("*"):
        if file.is_file() and not file.is_symlink():
            assets["/" + file.relative_to(DIST).as_posix()] = (
                file, mimetypes.guess_type(file)[0] or "application/octet-stream"
            )
    return assets


def read_snapshot():
    snapshot = {
        name: json.loads((ROOT / path).read_text(encoding="utf-8"))
        for name, path in FIXTURES.items()
    }
    sys.path.insert(0, str(ROOT))
    from impact.verify_brief import check, numbers

    allowed = set()
    for name in ("bill", "company", "forecast", "results", "plan"):
        allowed.update(numbers(snapshot[name]))
    problems = check(snapshot["brief"], allowed)
    snapshot["verification"] = {"numbers_trace_to_inputs": not problems, "problems": problems}
    snapshot["fixture_paths"] = FIXTURES
    return snapshot


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=5173, help="loopback port (default: 5173)")
    args = parser.parse_args()
    assets = build_assets()
    snapshot = json.dumps(read_snapshot()).encode("utf-8")

    class PreviewHandler(BaseHTTPRequestHandler):
        def do_GET(self):
            self.respond(include_body=True)

        def do_HEAD(self):
            self.respond(include_body=False)

        def respond(self, include_body):
            path = urlsplit(self.path).path
            if path == "/snapshot.json":
                body, content_type = snapshot, "application/json"
            elif path in assets:
                filename, content_type = assets[path]
                body = filename.read_bytes()
            else:
                self.send_error(404, "This preview only serves its own assets and saved snapshot.")
                return
            self.send_response(200)
            self.send_header("Content-Type", content_type + "; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            if include_body:
                self.wfile.write(body)

    with HTTPServer(("127.0.0.1", args.port), PreviewHandler) as server:
        print(f"Policy desk prototype: http://127.0.0.1:{server.server_port}", flush=True)
        print("Saved fictional analysis from 2026-10-23. Ctrl+C stops the preview.", flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            print("\nPreview stopped.")


if __name__ == "__main__":
    main()
