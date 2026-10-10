"""Signed-in Rank entitlement regression: run with python3 tests/rank-access.py."""
import asyncio
import json
import os
from pathlib import Path
from playwright.async_api import async_playwright

async def main():
    output = Path('/tmp/browser/rank-access')
    output.mkdir(parents=True, exist_ok=True)
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        for status in ['basic', 'expired', 'subscribed', 'trial']:
            context = await browser.new_context(viewport={'width': 1280, 'height': 1800})
            cookies = json.loads(os.environ.get('LOVABLE_BROWSER_SUPABASE_COOKIES_JSON', '[]'))
            for cookie in cookies:
                cookie['url'] = 'http://localhost:8080'
            if cookies:
                await context.add_cookies(cookies)
            page = await context.new_page()
            await page.goto('http://localhost:8080')
            key = os.environ.get('LOVABLE_BROWSER_SUPABASE_STORAGE_KEY')
            session = os.environ.get('LOVABLE_BROWSER_SUPABASE_SESSION_JSON')
            if not key or not session:
                raise RuntimeError('A signed-in preview session is required.')
            await page.evaluate('(x)=>localStorage.setItem(x[0],x[1])', [key, session])
            async def verdict(route):
                response = await route.fetch()
                data = await response.json()
                for row in data if isinstance(data, list) else [data]:
                    row.update(is_premium=status == 'subscribed', premium_access=status in ['subscribed', 'trial'], access_status=status, remaining_seconds=3600 if status == 'trial' else 0)
                await route.fulfill(response=response, json=data)
            await page.route('**/rest/v1/rpc/get_entitlement', verdict)
            await page.goto('http://localhost:8080/dashboard')
            if status == 'trial':
                welcome = page.get_by_role('button', name='START MY 3 DAYS')
                try:
                    await welcome.wait_for(timeout=5000)
                    await welcome.click()
                except Exception:
                    pass
            await page.get_by_role('button', name='Rank', exact=True).click()
            gate = page.get_by_role('dialog', name='Unlock full access')
            if status in ['basic', 'expired']:
                await gate.wait_for()
                await page.screenshot(path=str(output / f'{status}.png'))
                await gate.get_by_role('button', name='Continue with Basic').click()
                assert await gate.count() == 0
                await page.get_by_role('button', name='Rank', exact=True).click()
                await gate.get_by_role('button', name='Unlock AXEN Pro' if status == 'expired' else 'Upgrade Account').click()
                await page.get_by_role('heading', name='Unlock your full potential').wait_for()
                print(f'PASS {status}: Rank locked, Basic exit and upgrade work')
            else:
                await page.get_by_role('button', name='View All Ranks').click()
                await page.get_by_role('heading', name='All Ranks', exact=True).wait_for()
                assert await gate.count() == 0
                await page.screenshot(path=str(output / f'{status}.png'))
                print(f'PASS {status}: Rank progression accessible without paywall')
            await context.close()
        await browser.close()

asyncio.run(main())
