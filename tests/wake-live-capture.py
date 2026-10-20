"""Live capture driver for tests/wake-answer-privacy.test.ts (science MCQ run).

Creates a throwaway confirmed account on the live backend, drives the running app
(http://localhost:8080 by default, WAKE_LIVE_APP_URL to override) through a 10-second
test alarm in Science mode, records every response body the browser receives plus
device storage snapshots, exercises the offline answer queue, then deletes the account
and all its rows. Writes a JSON capture for the Bun test to assert on. Test alarms never
award coins/XP. Auth responses and the stored session are redacted from the capture.
"""
import asyncio, json, os, secrets, sys, time
from pathlib import Path
import requests
from playwright.async_api import async_playwright

APP = os.environ.get("WAKE_LIVE_APP_URL", "http://localhost:8080")
SB = os.environ["SUPABASE_URL"].rstrip("/")
SERVICE = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
PUBLISHABLE = os.environ.get("SUPABASE_PUBLISHABLE_KEY") or os.environ["VITE_SUPABASE_PUBLISHABLE_KEY"]
OUT = Path(os.environ.get("WAKE_LIVE_CAPTURE_OUT", "/tmp/wake-live-capture/capture.json"))
SHOTS = OUT.parent / "screens"


def svc_headers(extra=None):
    h = {"apikey": SERVICE, "Content-Type": "application/json"}
    if SERVICE.count(".") == 2:
        h["Authorization"] = f"Bearer {SERVICE}"
    return {**h, **(extra or {})}


def user_headers(token):
    return {"apikey": PUBLISHABLE, "Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def secret_row(event_id):
    r = requests.get(f"{SB}/rest/v1/alarm_events", params={"id": f"eq.{event_id}", "select": "status,question_version,question_answer,question_hash,question_explanation,question_text,question_options,correct_in_row,coins_awarded,reward_result"}, headers=svc_headers(), timeout=20)
    r.raise_for_status()
    return r.json()[0]


USER_TABLES = ["wake_question_history", "alarm_events", "alarm_sessions", "score_events", "coin_transactions", "task_completions", "alarms", "app_trials", "entitlements", "first_launch_assessments"]


def cleanup(uid):
    report = {}
    events = requests.get(f"{SB}/rest/v1/alarm_events", params={"user_id": f"eq.{uid}", "select": "id"}, headers=svc_headers(), timeout=20).json()
    ids = ",".join(e["id"] for e in events) if isinstance(events, list) else ""
    if ids:
        for t in ["wake_delivery_log", "wake_push_outbox"]:
            requests.delete(f"{SB}/rest/v1/{t}", params={"event_id": f"in.({ids})"}, headers=svc_headers(), timeout=20)
    requests.delete(f"{SB}/rest/v1/wake_push_subscriptions", params={"user_id": f"eq.{uid}"}, headers=svc_headers(), timeout=20)
    for t in USER_TABLES:
        requests.delete(f"{SB}/rest/v1/{t}", params={"user_id": f"eq.{uid}"}, headers=svc_headers(), timeout=20)
    requests.delete(f"{SB}/auth/v1/admin/users/{uid}", headers=svc_headers(), timeout=20)
    for t in USER_TABLES + ["wake_push_subscriptions"]:
        r = requests.get(f"{SB}/rest/v1/{t}", params={"user_id": f"eq.{uid}", "select": "user_id"}, headers=svc_headers(), timeout=20)
        report[t] = len(r.json()) if r.ok else f"http {r.status_code}"
    r = requests.get(f"{SB}/rest/v1/profiles", params={"id": f"eq.{uid}", "select": "id"}, headers=svc_headers(), timeout=20)
    report["profiles"] = len(r.json()) if r.ok else f"http {r.status_code}"
    r = requests.get(f"{SB}/auth/v1/admin/users/{uid}", headers=svc_headers(), timeout=20)
    report["auth_user_http"] = r.status_code
    return report


STORAGE_JS = """async (authKey) => {
  const dump = s => Object.fromEntries(Object.keys(s).map(k => [k, k === authKey ? '<redacted session>' : s.getItem(k)]));
  const idb = indexedDB.databases ? (await indexedDB.databases()).map(d => d.name) : [];
  const cacheKeys = 'caches' in window ? await caches.keys() : [];
  const cached = [];
  for (const name of cacheKeys) { const c = await caches.open(name); for (const req of await c.keys()) { const res = await c.match(req); cached.push({ url: req.url, body: res ? await res.clone().text() : '' }); } }
  const sw = navigator.serviceWorker ? (await navigator.serviceWorker.getRegistrations()).map(r => r.active?.scriptURL ?? null) : [];
  return { localStorage: dump(localStorage), sessionStorage: dump(sessionStorage), indexedDB: idb, cacheStorage: cached, cacheNames: cacheKeys, serviceWorkers: sw };
}"""


async def main():
    OUT.parent.mkdir(parents=True, exist_ok=True); SHOTS.mkdir(parents=True, exist_ok=True)
    email = f"wake-privacy-{secrets.token_hex(6)}@example.com"
    password = secrets.token_urlsafe(18)
    r = requests.post(f"{SB}/auth/v1/admin/users", headers=svc_headers(), json={"email": email, "password": password, "email_confirm": True}, timeout=20)
    r.raise_for_status(); uid = r.json()["id"]
    capture = {"app": APP, "responses": [], "secrets": [], "storage": {}, "offline": {}, "final": {}, "cleanup": {}}
    try:
        tok = requests.post(f"{SB}/auth/v1/token", params={"grant_type": "password"}, headers={"apikey": PUBLISHABLE, "Content-Type": "application/json"}, json={"email": email, "password": password}, timeout=20)
        tok.raise_for_status(); session = tok.json(); token = session["access_token"]
        r = requests.post(f"{SB}/rest/v1/rpc/wake_save_settings", headers=user_headers(token), json={"_time": "04:00", "_sleep": "20:30", "_tone": "classic", "_mode": "science", "_enabled": True, "_repeat": True, "_difficulty": 2}, timeout=20)
        r.raise_for_status()
        storage_key = os.environ.get("LOVABLE_BROWSER_SUPABASE_STORAGE_KEY") or f"sb-{SB.split('//')[1].split('.')[0]}-auth-token"

        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            context = await browser.new_context(viewport={"width": 390, "height": 844})
            page = await context.new_page()
            phase = {"name": "boot"}
            pending = []

            async def on_response(resp):
                try:
                    body = "<redacted auth>" if "/auth/v1/" in resp.url else await resp.text()
                except Exception:
                    body = ""
                capture["responses"].append({"i": len(capture["responses"]), "phase": phase["name"], "url": resp.url, "status": resp.status, "body": body})
            page.on("response", lambda resp: pending.append(asyncio.ensure_future(on_response(resp))))

            async def settle(ms=1500):
                await page.wait_for_timeout(ms)
                if pending: await asyncio.gather(*pending, return_exceptions=True); pending.clear()

            await page.goto(APP, wait_until="domcontentloaded")
            await page.evaluate("([k, v]) => localStorage.setItem(k, v)", [storage_key, json.dumps(session)])
            phase["name"] = "scheduled"
            await page.goto(f"{APP}/dashboard", wait_until="domcontentloaded")
            await settle(6000)
            r = requests.post(f"{SB}/rest/v1/rpc/wake_test_alarm", headers=user_headers(token), json={}, timeout=20)
            r.raise_for_status(); event_id = r.json()
            capture["event_id"] = event_id
            await page.goto(f"{APP}/alarm", wait_until="domcontentloaded")
            await settle(3000)
            capture["storage"]["scheduled"] = await page.evaluate(STORAGE_JS, storage_key)

            phase["name"] = "ringing"
            dialog = page.get_by_role("dialog", name="Wake verification")
            s1 = None
            deadline = time.time() + 60
            while time.time() < deadline:
                row = secret_row(event_id)
                if row["status"] == "ringing" and row["question_text"] and row["question_text"] in (await dialog.inner_text()):
                    s1 = row; break
                await page.wait_for_timeout(1000)
            if not s1: raise RuntimeError("alarm never showed a science question")
            await settle(2500)
            await page.screenshot(path=str(SHOTS / "1_ringing_science.png"))
            capture["storage"]["ringing"] = await page.evaluate(STORAGE_JS, storage_key)

            def opts(row): return row["question_options"] if isinstance(row["question_options"], list) else json.loads(row["question_options"])

            # Q1: deliberately wrong.
            wrong = (int(s1["question_answer"]) + 1) % 4
            capture["secrets"].append({**s1, "label": "Q1 (answered wrong)", "answered_at": len(capture["responses"]), "outcome": "wrong"})
            phase["name"] = "after_wrong"
            await dialog.get_by_role("button", name=opts(s1)[wrong], exact=True).click()
            s2 = None
            deadline = time.time() + 30
            while time.time() < deadline:
                row = secret_row(event_id)
                if row["question_version"] > s1["question_version"] and row["question_text"] in (await dialog.inner_text()):
                    s2 = row; break
                await page.wait_for_timeout(500)
            if not s2: raise RuntimeError("no new question after wrong answer")
            await settle(1500)

            # Q2: correct, but submitted while offline -> must queue, keep ringing, reach server only after reconnect.
            phase["name"] = "offline"
            capture["secrets"].append({**s2, "label": "Q2 (correct, sent via offline queue)", "answered_at": len(capture["responses"]), "outcome": "correct_1_of_2"})
            await context.set_offline(True)
            await dialog.get_by_role("button", name=opts(s2)[int(s2["question_answer"])], exact=True).click()
            notice = page.locator("[data-wake-pending='true']")
            await notice.wait_for(state="visible", timeout=10000)
            await page.wait_for_timeout(5000)
            await page.screenshot(path=str(SHOTS / "2_offline_queued.png"))
            during = secret_row(event_id)
            capture["offline"] = {
                "notice_visible": await notice.is_visible(),
                "notice_text": await notice.inner_text(),
                "buttons_disabled": all([await b.is_disabled() for b in await dialog.get_by_role("button").all() if (await b.inner_text()) in opts(s2)]),
                "awake_shown_while_offline": "AWAKE CONFIRMED" in (await dialog.inner_text()),
                "server_status_while_offline": during["status"],
                "server_version_while_offline": during["question_version"],
                "server_correct_in_row_while_offline": during["correct_in_row"],
                "queued_version": s2["question_version"],
            }
            await context.set_offline(False)
            s3 = None
            deadline = time.time() + 45
            while time.time() < deadline:
                row = secret_row(event_id)
                if row["question_version"] > s2["question_version"] and row["question_text"] in (await dialog.inner_text()):
                    s3 = row; break
                await page.wait_for_timeout(500)
            if not s3: raise RuntimeError("queued answer was not delivered after reconnect")
            await settle(1500)
            capture["offline"].update({
                "after_reconnect_version": s3["question_version"],
                "after_reconnect_correct_in_row": s3["correct_in_row"],
                "notice_gone": not await notice.is_visible(),
                "ui_shows_one_of_two": "1/2 correct in a row" in (await dialog.inner_text()),
            })

            # Q3: correct -> solved (test alarm: no reward).
            phase["name"] = "solved"
            capture["secrets"].append({**s3, "label": "Q3 (correct, solves)", "answered_at": len(capture["responses"]), "outcome": "solve"})
            await dialog.get_by_role("button", name=opts(s3)[int(s3["question_answer"])], exact=True).click()
            await page.get_by_text("AWAKE CONFIRMED").wait_for(timeout=20000)
            await settle(3000)
            await page.screenshot(path=str(SHOTS / "3_solved.png"))
            capture["storage"]["solved"] = await page.evaluate(STORAGE_JS, storage_key)
            final = secret_row(event_id)
            capture["final"] = {"status": final["status"], "coins_awarded": final["coins_awarded"], "reward_result": final["reward_result"]}
            await browser.close()
    finally:
        capture["cleanup"] = cleanup(uid)
        OUT.write_text(json.dumps(capture))
    print(json.dumps({"responses": len(capture["responses"]), "questions": len(capture["secrets"]), "out": str(OUT)}))


asyncio.run(main())
