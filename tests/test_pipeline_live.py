"""Test the live pipeline against a fake CREAO server, without real API keys.

Usage:
    python3 tests/test_pipeline_live.py

The fake server answers like CREAO's API Trigger: runs start as "pending", report
"running" once, then "completed". It returns the saved real agent outputs, one inside a
```json block, and one only as a downloadable file, to test both ways of reading answers.
It also checks every request uses the right key and sends the inputs each agent expects.
"""
import glob, json, os, subprocess, sys, threading
from http.server import BaseHTTPRequestHandler, HTTPServer

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
APPS = {  # appId -> (saved output, expected inputs, how to return the answer)
    "app-bill": ("tests/agent1-hr973.json", {"congress", "bill_type", "bill_number", "companion_bill"}, "text"),
    "app-research": ("tests/agent2-hr973.json", {"bill_analysis"}, "file"),
    "app-planner": ("tests/agent3-hr973.json", {"bill_analysis", "research", "forecast", "as_of"}, "text"),
    "app-brief": ("tests/agent4-hr973-brief.json", {"brief_inputs"}, "text"),
}
runs, errors = {}, []


class FakeCreao(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def reply(self, code, body):
        data = json.dumps(body).encode() if not isinstance(body, bytes) else body
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(data)

    def authorized(self, app):
        if self.headers.get("Authorization") != f"Bearer capi_test_{app}":
            errors.append(f"wrong key for {app}: {self.headers.get('Authorization')}")
            self.reply(401, {"error": "UNAUTHORIZED"})
            return False
        return True

    def do_POST(self):
        parts = self.path.strip("/").split("/")  # api/v1/apps/{app}/runs
        app = parts[3]
        if not self.authorized(app):
            return
        body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        inputs = body.get("inputs", {})
        if set(inputs) != APPS[app][1]:
            errors.append(f"{app} got inputs {sorted(inputs)}, expected {sorted(APPS[app][1])}")
        for k, v in inputs.items():
            if k in ("bill_analysis", "research", "forecast", "brief_inputs"):
                json.loads(v)  # must be a JSON string
        run_id = f"run-{len(runs) + 1}"
        runs[run_id] = {"app": app, "polls": 0}
        self.reply(202, {"id": run_id, "status": "pending", "appId": app})

    def do_GET(self):
        parts = self.path.strip("/").split("?")[0].split("/")
        if parts[:2] == ["files", "research.json"]:
            return self.reply(200, open(os.path.join(ROOT, APPS["app-research"][0]), "rb").read())
        app, run_id = parts[3], parts[5]
        if not self.authorized(app):
            return
        r = runs[run_id]
        r["polls"] += 1
        if r["polls"] < 2:
            return self.reply(200, {"id": run_id, "status": "running"})
        saved, _, mode = APPS[app]
        answer = open(os.path.join(ROOT, saved)).read()
        if mode == "text":
            result = {"text": "Here is the result:\n```json\n" + answer + "\n```", "artifacts": []}
        else:
            base = f"http://127.0.0.1:{self.server.server_port}"
            result = {"text": "Saved research.json.", "artifacts": [
                {"id": "a1", "title": "research.json", "type": "file", "url": f"{base}/files/research.json"}]}
        self.reply(200, {"id": run_id, "status": "completed", "result": result})


def main():
    server = HTTPServer(("127.0.0.1", 0), FakeCreao)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    env = dict(os.environ, CREAO_BASE_URL=f"http://127.0.0.1:{server.server_port}", CREAO_POLL_SECONDS="0.2")
    for name, app in [("BILL_ANALYST", "app-bill"), ("RESEARCHER", "app-research"),
                      ("IMPACT_PLANNER", "app-planner"), ("BRIEF_WRITER", "app-brief")]:
        env[f"CREAO_{name}_APP_ID"], env[f"CREAO_{name}_KEY"] = app, f"capi_test_{app}"

    before = set(glob.glob(os.path.join(ROOT, "runs", "*")))
    p = subprocess.run([sys.executable, os.path.join(ROOT, "backend", "pipeline.py"), "hr", "973", "--companion", "s389"],
                       env=env, capture_output=True, text=True)
    server.shutdown()
    print(p.stdout[-1500:])
    if p.returncode != 0:
        print(p.stderr[-1500:])
    new = sorted(set(glob.glob(os.path.join(ROOT, "runs", "*"))) - before)
    summary = json.load(open(os.path.join(new[-1], "summary.json"))) if new else {}

    checks = [
        ("pipeline finished", p.returncode == 0),
        ("4 agent runs started", len(runs) == 4),
        ("every agent got the right key and inputs", not errors),
        ("research read from a saved file (artifact fallback)", os.path.exists(os.path.join(new[-1], "2-research.json")) if new else False),
        ("brief passed the number check", summary.get("steps", {}).get("9 number check", {}).get("verified") is True),
        ("run IDs recorded", all(summary.get("steps", {}).get(s, {}).get("run_id") for s in
                                 ("1 bill analyst", "2 researcher", "5 impact planner", "8 brief writer"))),
    ]
    for e in errors:
        print("  ERROR", e)
    for name, ok in checks:
        print(f"  {'PASS' if ok else 'FAIL'}  {name}")
    sys.exit(0 if all(ok for _, ok in checks) else 1)


if __name__ == "__main__":
    main()
