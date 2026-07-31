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

    detail_window = page.get_by_label("左上角详情展示窗口")
    default_detail = detail_window.locator("h2").inner_text()
    tab_buttons = page.locator(".explorer-tab-list [role='tab']")
    if tab_buttons.count() != 5:
        raise RuntimeError(f"Expected five explorer tabs, got {tab_buttons.count()}")

    tab_results = {}
    for label in ("物品", "装备", "队伍", "营地", "领地"):
        tab = page.get_by_role("tab", name=label)
        tab.click()
        if tab.get_attribute("aria-selected") != "true":
            raise RuntimeError(f"Tab did not activate: {label}")
        tab_results[label] = page.locator(".explorer-tab-panel").inner_text()

    page.get_by_role("tab", name="装备").click()
    equipment_name = page.locator(".equipment-inspect").first.locator("strong").inner_text()
    page.locator(".equipment-inspect").first.click()
    if detail_window.locator("h2").inner_text() != equipment_name:
        raise RuntimeError("Equipment detail did not reuse the top-left display window")

    page.get_by_role("tab", name="队伍").click()
    page.locator(".party-roster button").first.click()
    party_name = detail_window.locator("h2").inner_text()

    if page.locator(".scene-transit-disclosure").evaluate("(node) => node.open"):
        raise RuntimeError("Advanced scene navigation is expanded by default")
    if page.locator(".scene-transit").is_visible():
        raise RuntimeError("INFINITE FRONTIER content is visible by default")

    page.locator(".talk-bubble").first.click()
    page.locator(".interaction-panel").wait_for()
    person_name = detail_window.locator("h2").inner_text()
    person_meta = detail_window.locator(".selection-eyebrow").inner_text()

    action_buttons = page.locator(".action-buttons > button")
    action_heights = [round(action_buttons.nth(index).bounding_box()["height"]) for index in range(action_buttons.count())]
    if len(set(action_heights)) != 1:
        raise RuntimeError(f"Action buttons are not uniform: {action_heights}")

    page.get_by_role("button", name="建立营地").click()
    page.get_by_role("tab", name="营地").click()
    page.locator(".camp-list button").first.click()
    camp_name = detail_window.locator("h2").inner_text()
    camp_stats = detail_window.locator(".selection-stats").inner_text()

    tab_font_size = float(
        page.locator(".explorer-tab-list button span").first.evaluate(
            "(node) => parseFloat(getComputedStyle(node).fontSize)"
        )
    )
    if tab_font_size < 10:
        raise RuntimeError(f"Tab font is too small: {tab_font_size}")

    page.screenshot(path="/private/tmp/realmseed-ui-tabs-desktop.png", full_page=True)
    page.set_viewport_size({"width": 720, "height": 1100})
    page.wait_for_timeout(200)
    if not detail_window.is_visible() or not page.locator(".explorer-tab-list").is_visible():
        raise RuntimeError("Detail window or tab bar is hidden on mobile")
    page.screenshot(path="/private/tmp/realmseed-ui-tabs-mobile.png", full_page=True)

    page.set_viewport_size({"width": 1440, "height": 1000})
    page.get_by_role("button", name="新世界").click()
    page.locator("#world-seed").fill("diagonal-ui-35")
    page.get_by_text("小地图", exact=True).click()
    page.get_by_role("button", name="展开这个世界").click()
    diagonal_bubble = page.get_by_role("button", name="与 Lark Hearth 交谈或交易")
    diagonal_bubble.wait_for()
    diagonal_bubble.click()
    page.locator(".interaction-panel").wait_for()
    diagonal_dialogue = page.locator(".interaction-person h3").inner_text()

    if errors:
        raise RuntimeError("Browser console errors:\n" + "\n".join(errors))

    print(json.dumps({
        "defaultDetail": default_detail,
        "tabs": list(tab_results.keys()),
        "equipmentDetail": equipment_name,
        "partyDetail": party_name,
        "person": {"name": person_name, "meta": person_meta},
        "camp": {"name": camp_name, "stats": camp_stats},
        "sceneNavigationDefaultOpen": False,
        "actionHeights": action_heights,
        "tabFontSize": tab_font_size,
        "mobileVisible": True,
        "diagonalDialogue": diagonal_dialogue,
    }, ensure_ascii=False, indent=2))
    browser.close()
