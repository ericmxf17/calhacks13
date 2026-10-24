"""Minimal client for CREAO's app-scoped API Trigger.

Each saved agent has its own appId and its own capi_ key. A run is started with
POST /api/v1/apps/{appId}/runs and polled with GET /api/v1/apps/{appId}/runs/{runId}
until it finishes. The agent's JSON answer is pulled from the result text (a ```json
block) or, failing that, from a .json file the agent saved as an artifact.

Pure Python. Falls back to curl when this Mac's Python has no SSL certificates.
"""
import json, os, re, subprocess, time, urllib.error, urllib.request

BASE_URL = os.environ.get("CREAO_BASE_URL", "https://agent.creao.ai")
FINISHED = {"completed", "failed", "cancelled"}


class CreaoError(Exception):
    pass


def _request(method, url, key, body=None):
    data = json.dumps(body).encode() if body is not None else None
    headers = {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}
    try:
        req = urllib.request.Request(url, data=data, headers=headers, method=method)
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.status, r.read().decode("utf-8", "ignore")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "ignore")
    except urllib.error.URLError as e:
        if "CERTIFICATE_VERIFY_FAILED" not in str(e):
            raise CreaoError(f"Could not reach {url}: {e}")
    cmd = ["curl", "-sL", "-m", "60", "-X", method, "-w", "\n%{http_code}",
           "-H", f"Authorization: Bearer {key}", "-H", "Content-Type: application/json", url]
    if data is not None:
        cmd[1:1] = ["--data-binary", "@-"]
    r = subprocess.run(cmd, input=data, capture_output=True)
    text, _, code = r.stdout.decode("utf-8", "ignore").rpartition("\n")
    return (int(code) if code.isdigit() else 0), text


def _json_or_error(status, text, what):
    try:
        payload = json.loads(text) if text else {}
    except json.JSONDecodeError:
        payload = {"raw": text[:300]}
    if status >= 400 or status == 0:
        raise CreaoError(f"{what} failed (HTTP {status}): {payload.get('error') or payload}")
    return payload


def start_run(app_id, key, inputs):
    status, text = _request("POST", f"{BASE_URL}/api/v1/apps/{app_id}/runs", key, {"inputs": inputs})
    payload = _json_or_error(status, text, "Starting the run")
    run_id = payload.get("id") or payload.get("runId") or payload.get("run_id")
    if not run_id:
        raise CreaoError(f"No run ID in response: {payload}")
    return run_id


def wait_for_run(app_id, key, run_id, timeout_s=1500, every_s=float(os.environ.get("CREAO_POLL_SECONDS", 10)), on_tick=None):
    started = time.time()
    while True:
        status, text = _request("GET", f"{BASE_URL}/api/v1/apps/{app_id}/runs/{run_id}", key)
        run = _json_or_error(status, text, "Checking the run")
        state = run.get("status")
        if on_tick:
            on_tick(state, int(time.time() - started))
        if state in FINISHED:
            if state != "completed":
                raise CreaoError(f"Run {run_id} {state}: {run.get('errorCode') or run.get('error') or ''}")
            return run
        if time.time() - started > timeout_s:
            raise CreaoError(f"Run {run_id} still '{state}' after {timeout_s // 60} minutes")
        time.sleep(every_s)


def _strings(obj):
    if isinstance(obj, dict):
        for v in obj.values():
            yield from _strings(v)
    elif isinstance(obj, list):
        for v in obj:
            yield from _strings(v)
    elif isinstance(obj, str):
        yield obj


def extract_json(run, key=None, expected_file=None):
    """Find the agent's JSON answer in a finished run."""
    result = run.get("result") or {}
    texts = [result.get("text"), result.get("chatText")] + list(_strings(result))
    for t in texts:
        if not t:
            continue
        block = re.search(r"```json\s*(\{.*\})\s*```", t, re.S)
        candidate = block.group(1) if block else t.strip()
        if candidate.startswith("{"):
            try:
                return json.loads(candidate)
            except json.JSONDecodeError:
                pass
    # Fall back to a JSON file the agent saved
    for art in result.get("artifacts", []):
        name = (art.get("title") or "") + " " + (art.get("type") or "")
        if expected_file and expected_file not in name and "json" not in name.lower():
            continue
        url = art.get("url") or f"{BASE_URL}/api/v1/runs/{run.get('id')}/artifacts/download?artifactId={art.get('id')}"
        status, text = _request("GET", url, key)
        if status < 400:
            try:
                return json.loads(text)
            except json.JSONDecodeError:
                continue
    raise CreaoError("The run finished, but no JSON answer was found in its reply or files")


def run_agent(app_id, key, inputs, expected_file=None, on_tick=None):
    run_id = start_run(app_id, key, inputs)
    run = wait_for_run(app_id, key, run_id, on_tick=on_tick)
    return extract_json(run, key, expected_file), run_id
