"""Script to run automated Playwright screenshots across all 4 roles at 360x800 and 1440x900."""

import asyncio
import os
import json
from pathlib import Path
from playwright.async_api import async_playwright

BASE_URL = os.environ.get("BASE_URL", "http://localhost:5173")

ROLES = [
    {"username": "admin", "password": "admin123", "role": "admin", "name": "Admin"},
    {"username": "coordinator", "password": "coord123", "role": "coordinator", "name": "Coordinator"},
    {"username": "faculty", "password": "faculty123", "role": "faculty", "name": "Faculty"},
    {"username": "clubrep", "password": "clubrep123", "role": "club_rep", "name": "ClubRep"},
]

VIEWPORTS = [
    {"name": "mobile_360x800", "width": 360, "height": 800},
    {"name": "laptop_1440x900", "width": 1440, "height": 900},
]

PAGES = [
    {"path": "/", "name": "dashboard"},
    {"path": "/timetable", "name": "timetable"},
    {"path": "/exams", "name": "exams"},
    {"path": "/bookings", "name": "bookings"},
    {"path": "/disruptions", "name": "disruptions"},
    {"path": "/assistant", "name": "assistant"},
    {"path": "/approvals", "name": "approvals"},
    {"path": "/admin", "name": "admin"},
]

OUTPUT_DIR = Path("docs/screenshots/audit")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


import asyncio
import os
import json
import httpx
from pathlib import Path
from playwright.async_api import async_playwright

BASE_URL = os.environ.get("BASE_URL", "http://127.0.0.1:5173")
API_URL = os.environ.get("API_URL", "http://127.0.0.1:8000")

ROLES = [
    {"username": "admin", "password": "admin123", "role": "admin", "name": "Admin"},
    {"username": "coordinator", "password": "coord123", "role": "coordinator", "name": "Coordinator"},
    {"username": "faculty", "password": "faculty123", "role": "faculty", "name": "Faculty"},
    {"username": "clubrep", "password": "clubrep123", "role": "club_rep", "name": "ClubRep"},
]

VIEWPORTS = [
    {"name": "mobile_360x800", "width": 360, "height": 800},
    {"name": "laptop_1440x900", "width": 1440, "height": 900},
]

PAGES = [
    {"path": "/", "name": "dashboard"},
    {"path": "/timetable", "name": "timetable"},
    {"path": "/exams", "name": "exams"},
    {"path": "/bookings", "name": "bookings"},
    {"path": "/disruptions", "name": "disruptions"},
    {"path": "/assistant", "name": "assistant"},
    {"path": "/approvals", "name": "approvals"},
    {"path": "/admin", "name": "admin"},
]

OUTPUT_DIR = Path("docs/screenshots/audit")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


async def get_token_and_user(role_info):
    async with httpx.AsyncClient() as client:
        res = await client.post(
            f"{API_URL}/api/auth/login",
            data={"username": role_info["username"], "password": role_info["password"]},
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        data = res.json()
        token = data["access_token"]
        user = {
            "id": 1,
            "username": data["username"],
            "display_name": data["display_name"],
            "role": data["role"],
        }
        return token, user


async def audit_role(browser, role_info, viewport, issues_log):
    vp_name = viewport["name"]
    role_name = role_info["username"]

    token, user = await get_token_and_user(role_info)

    context = await browser.new_context(
        viewport={"width": viewport["width"], "height": viewport["height"]},
        device_scale_factor=1,
    )
    page = await context.new_page()

    try:
        # Step 1: Login page unauthenticated
        await page.goto(f"{BASE_URL}/login", wait_until="networkidle")
        await page.wait_for_timeout(300)
        login_shot = OUTPUT_DIR / f"{role_name}_login_{vp_name}.png"
        await page.screenshot(path=str(login_shot), full_page=True)

        # Check horizontal overflow on login
        overflow = await page.evaluate(
            "document.documentElement.scrollWidth > window.innerWidth"
        )
        if overflow:
            issues_log.append(f"[{vp_name}][{role_name}] Horizontal overflow detected on /login")

        # Step 2: Inject auth state into localStorage
        user_json = json.dumps(user)
        await page.evaluate(
            f"""() => {{
                localStorage.setItem('cit_token', '{token}');
                localStorage.setItem('cit_user', '{user_json}');
            }}"""
        )

        # Step 3: Visit each page
        for p in PAGES:
            # Skip admin page for non-admin
            if p["path"] == "/admin" and role_name != "admin":
                continue
            if p["path"] == "/approvals" and role_name not in ("admin", "coordinator"):
                continue

            target_url = f"{BASE_URL}{p['path']}"
            await page.goto(target_url, wait_until="networkidle")
            await page.wait_for_timeout(500)

            shot_path = OUTPUT_DIR / f"{role_name}_{p['name']}_{vp_name}.png"
            await page.screenshot(path=str(shot_path), full_page=True)

            # Check for layout overflow
            has_overflow = await page.evaluate(
                "document.documentElement.scrollWidth > window.innerWidth"
            )
            if has_overflow:
                issues_log.append(f"[{vp_name}][{role_name}] Horizontal overflow on {p['path']}")

    except Exception as e:
        issues_log.append(f"[{vp_name}][{role_name}] Exception during audit: {str(e)}")
    finally:
        await context.close()


async def main():
    issues_log = []
    print("Launching Playwright for UI Audit...")
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        for role in ROLES:
            for vp in VIEWPORTS:
                print(f"Auditing Role: {role['username']} | Viewport: {vp['name']}")
                await audit_role(browser, role, vp, issues_log)
        await browser.close()

    report_path = Path("docs/audit_findings.json")
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(issues_log, f, indent=2)

    print(f"Audit completed! Captured screenshots in {OUTPUT_DIR}")
    print(f"Found {len(issues_log)} automated issues logged to {report_path}")


if __name__ == "__main__":
    asyncio.run(main())
