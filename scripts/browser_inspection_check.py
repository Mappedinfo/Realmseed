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
    page.locator("#world-seed").fill("systems-ui-7")
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
    challenge_name = page.locator(".roadside-challenge strong").inner_text()
    challenge_chance = page.locator(".roadside-challenge em").inner_text()

    action_buttons = page.locator(".action-buttons > button")
    action_heights = [round(action_buttons.nth(index).bounding_box()["height"]) for index in range(action_buttons.count())]
    if len(set(action_heights)) != 1:
        raise RuntimeError(f"Action buttons are not uniform: {action_heights}")

    page.get_by_role("button", name="建立营地").click()
    page.get_by_role("tab", name="营地").click()
    page.locator(".camp-list button").first.click()
    camp_name = detail_window.locator("h2").inner_text()
    camp_stats = detail_window.locator(".selection-stats").inner_text()
    building_options = page.locator(".camp-buildings button")
    building_option_count = building_options.count()
    if building_option_count != 6:
        raise RuntimeError(f"Expected six camp buildings, got {building_option_count}")
    camp_operations = page.locator(".camp-operation-grid").inner_text()

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
    page.locator("#world-seed").fill("systems-ui-15")
    page.get_by_text("小地图", exact=True).click()
    page.get_by_role("button", name="展开这个世界").click()
    diagonal_bubble = page.locator(".talk-bubble").first
    diagonal_bubble.wait_for()
    diagonal_bubble.click()
    page.locator(".interaction-panel").wait_for()
    diagonal_dialogue = page.locator(".interaction-person h3").inner_text()

    page.get_by_role("button", name="新世界").click()
    page.locator("#world-seed").fill("battle-ui-27")
    page.get_by_text("小地图", exact=True).click()
    page.get_by_role("button", name="展开这个世界").click()
    audio_button = page.locator(".audio-button")
    audio_button.click()
    page.get_by_role("button", name="向下").click()
    page.locator(".battle-panel").wait_for()
    page.wait_for_timeout(250)
    audio_sources = page.locator("audio").evaluate_all(
        "(nodes) => nodes.map((node) => node.getAttribute('src'))"
    )
    if not any("battle-music-01.ogg" in source for source in audio_sources):
        raise RuntimeError("Battle music asset is not mounted during combat")
    if "战斗乐声" not in audio_button.inner_text():
        audio_debug = page.locator("audio").evaluate(
            "(node) => ({ paused: node.paused, readyState: node.readyState, networkState: node.networkState, error: node.error && node.error.code, src: node.currentSrc })"
        )
        raise RuntimeError(f"Audio control did not switch to battle state: {audio_debug}")
    playback_during_battle = page.locator("audio").evaluate_all(
        "(nodes) => nodes.map((node) => ({ paused: node.paused, src: node.getAttribute('src') }))"
    )
    page.screenshot(path="/private/tmp/realmseed-battle-music.png", full_page=True)
    page.get_by_role("button", name="撤离").click()
    page.wait_for_timeout(250)
    if "林野乐声" not in audio_button.inner_text():
        raise RuntimeError("Audio control did not restore exploration state")

    if errors:
        raise RuntimeError("Browser console errors:\n" + "\n".join(errors))

    print(json.dumps({
        "defaultDetail": default_detail,
        "tabs": list(tab_results.keys()),
        "equipmentDetail": equipment_name,
        "partyDetail": party_name,
        "person": {"name": person_name, "meta": person_meta},
        "challenge": {"name": challenge_name, "chance": challenge_chance},
        "camp": {"name": camp_name, "stats": camp_stats, "operations": camp_operations, "buildingOptions": building_option_count},
        "sceneNavigationDefaultOpen": False,
        "actionHeights": action_heights,
        "tabFontSize": tab_font_size,
        "mobileVisible": True,
        "diagonalDialogue": diagonal_dialogue,
        "battleAudio": {"sources": audio_sources, "duringBattle": playback_during_battle},
    }, ensure_ascii=False, indent=2))
    browser.close()
