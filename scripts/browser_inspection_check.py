import json
import sys

from playwright.sync_api import sync_playwright


app_url = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:5173/"

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 1000})
    errors = []
    page.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)
    page.goto(app_url, wait_until="networkidle")
    page.locator("#world-seed").fill("interaction-3")
    page.get_by_text("小地图", exact=True).click()
    page.get_by_role("button", name="展开这个世界").click()
    page.locator("canvas[aria-label='Realmseed 像素世界地图']").wait_for()

    page.locator(".talk-bubble").first.click()
    person_name = page.locator(".selection-details h3").inner_text()
    person_category = page.locator(".selection-eyebrow").filter(has_text="人物").inner_text()

    food_target = page.locator(".map-inspect-target[aria-label='查看野果丛详情']").first
    food_target.wait_for()
    food_target.click()
    item_name = page.locator(".selection-details h3").inner_text()
    item_hint = page.locator(".selection-hint").inner_text()

    page.get_by_role("button", name="建营 8 金").click()
    camp_target = page.locator(".map-inspect-target[aria-label*='营地'][aria-label$='详情']").first
    camp_target.wait_for()
    camp_target.click()
    building_name = page.locator(".selection-details h3").inner_text()
    building_stats = page.locator(".selection-stats").inner_text()
    page.screenshot(path="/private/tmp/realmseed-inspection-desktop.png", full_page=True)

    page.set_viewport_size({"width": 720, "height": 1100})
    page.wait_for_timeout(200)
    if not page.locator(".selection-details").is_visible():
        raise RuntimeError("Selection details are hidden on mobile")
    page.screenshot(path="/private/tmp/realmseed-inspection-mobile.png", full_page=True)

    if errors:
        raise RuntimeError("Browser console errors:\n" + "\n".join(errors))

    print(json.dumps({
        "person": {"name": person_name, "category": person_category},
        "item": {"name": item_name, "hint": item_hint},
        "building": {"name": building_name, "stats": building_stats},
        "mobileVisible": True,
    }, ensure_ascii=False, indent=2))
    browser.close()
