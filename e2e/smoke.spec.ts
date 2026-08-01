import { expect, test } from '@playwright/test'

const appUrl = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:5173/'

test('starts a seeded world and advances a turn', async ({ page }) => {
  const consoleErrors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })

  await page.goto(appUrl)
  await expect(page.getByRole('heading', { name: 'REALMSEED' })).toBeVisible()
  await page.getByLabel('世界种子').fill('browser-smoke-seed')
  await page.getByRole('button', { name: /展开这个世界/ }).click()

  await expect(page.getByLabel('Realmseed 像素世界地图')).toBeVisible()
  await expect(page.getByText('SEED: browser-smoke-seed')).toBeVisible()
  await expect(page.getByText('96 × 96')).toBeVisible()
  await expect(page.getByText('第').locator('..')).toContainText('1')
  await expect(page.getByRole('button', { name: '效忠' })).toHaveCount(3)
  await expect(page.getByRole('button', { name: '纳为附属' })).toHaveCount(3)
  await expect(page.locator('.world-status')).toContainText('[0, 0]')
  await expect(page.getByText('木材', { exact: true })).toBeVisible()
  await expect(page.getByText('石材', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: /建立营地/ })).toContainText('8 木 · 5 石')

  await page.getByRole('button', { name: /休息/ }).click()
  await expect(page.locator('.world-status')).toContainText('2')
  await expect(page.locator('.chronicle-list')).toContainText(/恢复|度过一夜/)
  await page.locator('.scene-transit-disclosure summary').click()
  await page.getByRole('button', { name: '向东前往相邻场景' }).click()
  await expect(page.locator('.world-status')).toContainText('[1, 0]')
  await expect(page.locator('.chronicle-list')).toContainText('场景由总种子继续展开')
  await page.screenshot({ path: '/tmp/realmseed-game.png', fullPage: true })

  expect(consoleErrors).toEqual([])
})

test('keeps the action interface usable on a phone viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(appUrl)
  await page.getByRole('button', { name: /展开这个世界/ }).click()
  await expect(page.getByRole('button', { name: /休息/ })).toBeVisible()
  await expect(page.getByLabel('Realmseed 像素世界地图')).toBeVisible()
  await page.screenshot({ path: '/tmp/realmseed-mobile.png', fullPage: true })
})

test('manages a twenty-slot loadout and round-trips a readable save file', async ({ page }) => {
  await page.goto(appUrl)
  await page.getByLabel('世界种子').fill('loadout-save-browser')
  await page.getByRole('button', { name: /展开这个世界/ }).click()
  await page.getByRole('tab', { name: /装备/ }).click()
  const board = page.getByLabel('人物全身装备盘')
  await expect(board).toBeVisible()
  await expect(board.locator('.loadout-grid button')).toHaveCount(20)
  await expect(board.getByText('戒指Ⅰ')).toBeVisible()
  await expect(board.getByText('戒指Ⅳ')).toBeVisible()
  await expect(board.getByText('修补短刃')).toBeVisible()
  await page.screenshot({ path: '/tmp/realmseed-loadout.png', fullPage: true })

  await page.getByRole('button', { name: '存档', exact: true }).click()
  const manager = page.getByRole('dialog', { name: '存档管理' })
  await expect(manager).toBeVisible()
  const downloadPromise = page.waitForEvent('download')
  await manager.getByRole('button', { name: /导出当前世界/ }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/^realmseed-loadout-save-browser-D1-.+\.realmseed\.json$/)
  const exported = await page.evaluate(() => localStorage.getItem('realmseed-save-v2'))
  expect(exported).toBeTruthy()

  const input = manager.locator('input[type=file]')
  await input.setInputFiles({ name: 'portable.realmseed.json', mimeType: 'application/json', buffer: Buffer.from(exported!) })
  await expect(manager).toContainText('loadout-save-browser')
  await expect(manager).toContainText('V2')
  await manager.getByRole('button', { name: /备份当前进度并导入/ }).click()
  await expect(page.getByText('SEED: loadout-save-browser')).toBeVisible()
  await page.getByRole('button', { name: '存档', exact: true }).click()
  const reopened = page.getByRole('dialog', { name: '存档管理' })
  await expect(reopened).toContainText('导入替换前')
  await reopened.getByRole('button', { name: /导入替换前/ }).click()
  await expect(reopened).toContainText('确认恢复')
  await reopened.getByRole('button', { name: '取消' }).click()
  await page.screenshot({ path: '/tmp/realmseed-loadout-save.png', fullPage: true })
})

test('previews V1 migration and preserves a corrupt browser save for rescue', async ({ page }) => {
  await page.goto(appUrl)
  await page.getByLabel('世界种子').fill('migration-rescue-browser')
  await page.getByRole('button', { name: /展开这个世界/ }).click()
  await expect.poll(async () => page.evaluate(() => localStorage.getItem('realmseed-save-v2'))).toBeTruthy()
  const legacy = await page.evaluate(() => {
    const current = JSON.parse(localStorage.getItem('realmseed-save-v2')!)
    return JSON.stringify({ version: 1, savedAt: current.savedAt, theme: current.theme, state: current.state })
  })
  await page.getByRole('button', { name: '存档', exact: true }).click()
  const manager = page.getByRole('dialog', { name: '存档管理' })
  await manager.locator('input[type=file]').setInputFiles({ name: 'legacy.realmseed.json', mimeType: 'application/json', buffer: Buffer.from(legacy) })
  await expect(manager).toContainText('迁移路径：V1 → V2')
  await manager.getByRole('button', { name: '关闭存档管理' }).click()

  await page.addInitScript(() => {
    Object.defineProperty(window, 'indexedDB', { value: undefined, configurable: true })
    localStorage.setItem('realmseed-save-v2', '{broken')
  })
  await page.reload()
  const rescue = page.getByRole('dialog', { name: '存档管理' })
  await expect(rescue).toContainText('存档 JSON 无法解析')
  await expect(rescue.getByRole('button', { name: /下载问题存档原文/ })).toBeVisible()
  await page.screenshot({ path: '/tmp/realmseed-save-rescue.png', fullPage: true })
  const problemDownload = page.waitForEvent('download')
  await rescue.getByRole('button', { name: /下载问题存档原文/ }).click()
  expect((await problemDownload).suggestedFilename()).toContain('problem-damaged-browser-save')
  await rescue.getByRole('button', { name: /放弃损坏的活动存档/ }).click()
  await rescue.getByRole('button', { name: '关闭存档管理' }).click()
  await expect(page.getByRole('button', { name: /展开这个世界/ })).toBeEnabled()
})

test('shows common supplies and keeps unowned collectibles as empty 4 by 5 slots', async ({ page }) => {
  await page.goto(appUrl)
  await page.getByLabel('世界种子').fill('inventory-browser-seed')
  await page.getByRole('button', { name: /展开这个世界/ }).click()

  const collection = page.getByLabel('自定义收藏格，4 列 5 行')
  await expect(collection.locator('.inventory-slot')).toHaveCount(20)
  await expect(collection.getByRole('button')).toHaveCount(0)
  await expect(page.getByText('红鳞鲤', { exact: true })).toHaveCount(0)
  await expect(page.getByText('金鲤', { exact: true })).toHaveCount(0)

  const wood = page.locator('.inventory-common-grid button').filter({ hasText: '木材' })
  await wood.hover()
  await expect.poll(() => wood.evaluate((element) => getComputedStyle(element, '::after').opacity)).toBe('1')
  await wood.click()
  await expect(page.getByText('从森林资源点采集，用于营地核心与木制设施。')).toBeVisible()
  await page.screenshot({ path: '/tmp/realmseed-inventory.png', fullPage: true })
})

test('double-clicks a visible tile to auto-route with interpolated movement', async ({ page }) => {
  await page.goto(appUrl)
  await page.getByLabel('世界种子').fill('navigation-browser-seed')
  await page.getByRole('button', { name: /展开这个世界/ }).click()
  const canvas = page.getByLabel('Realmseed 像素世界地图')
  await expect(canvas).toBeVisible()
  const startX = Number(await canvas.getAttribute('data-player-x'))
  const startY = Number(await canvas.getAttribute('data-player-y'))
  const box = await canvas.boundingBox()
  expect(box).not.toBeNull()
  const targetX = startX < 92 ? startX + 4 : startX - 4
  const originX = Math.max(0, Math.min(96 - 25, startX - 12))
  const originY = Math.max(0, Math.min(96 - 17, startY - 8))
  const screenX = box!.x + ((targetX - originX + .5) / 25) * box!.width
  const screenY = box!.y + ((startY - originY + .5) / 17) * box!.height
  const interpolationSeen = page.waitForFunction(() => {
    const element = document.querySelector<HTMLCanvasElement>('[aria-label="Realmseed 像素世界地图"]')
    if (!element) return false
    const x = Number(element.dataset.playerVisualX)
    const y = Number(element.dataset.playerVisualY)
    return Math.abs(x - Math.round(x)) > .01 || Math.abs(y - Math.round(y)) > .01
  })
  const footprintSeen = page.waitForFunction(() => Number(document.querySelector<HTMLCanvasElement>('[aria-label="Realmseed 像素世界地图"]')?.dataset.footprintCount) > 0)
  await page.mouse.dblclick(screenX, screenY, { delay: 45 })
  await expect(page.getByText('AUTO ROUTE')).toBeVisible()
  await expect.poll(async () => page.locator('.auto-route-status > i').evaluate((element) => getComputedStyle(element).animationName)).toBe('none')
  const renderedCoordinates = await page.evaluate(async () => {
    const samples: number[][] = []
    for (let index = 0; index < 14; index += 1) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
      const element = document.querySelector<HTMLCanvasElement>('[aria-label="Realmseed 像素世界地图"]')!
      samples.push([Number(element.dataset.playerRenderX), Number(element.dataset.playerRenderY)])
    }
    return samples
  })
  expect(renderedCoordinates.every(([x, y]) => Number.isInteger(x) && Number.isInteger(y))).toBe(true)
  await page.screenshot({ path: '/tmp/realmseed-navigation.png', fullPage: true })
  await Promise.all([interpolationSeen, footprintSeen])
  await page.screenshot({ path: '/tmp/realmseed-footprints.png', fullPage: true })
  await page.waitForFunction(
    ([x, y]) => {
      const element = document.querySelector<HTMLCanvasElement>('[aria-label="Realmseed 像素世界地图"]')
      if (!element) return false
      return Number(element.dataset.playerX) !== x || Number(element.dataset.playerY) !== y
    },
    [startX, startY],
  )
  await page.keyboard.press('ArrowUp')
  await expect(page.getByText('AUTO ROUTE')).toBeHidden()
})

test('auto-routes to resource regions and shows three axe or five hammer strikes', async ({ page }) => {
  await page.goto(appUrl)
  await page.getByLabel('世界种子').fill('auto-gather-browser')
  await page.getByRole('button', { name: /展开这个世界/ }).click()
  const canvas = page.getByLabel('Realmseed 像素世界地图')

  await page.getByRole('button', { name: '查看林木资源点详情' }).first().click()
  await page.getByRole('button', { name: '自动伐木' }).click()
  const firstWoodTarget = await canvas.getAttribute('data-gathering-target')
  await expect(page.getByLabel(/自动伐木/)).toBeVisible()
  await page.waitForFunction(() => Number(document.querySelector<HTMLCanvasElement>('[aria-label="Realmseed 像素世界地图"]')?.dataset.gatheringStrike) === 3)
  await expect(page.locator('.chronicle-list')).toContainText('采集木材 +')
  await expect.poll(async () => canvas.getAttribute('data-gathering-target')).not.toBe(firstWoodTarget)
  await expect.poll(async () => canvas.getAttribute('data-gathering-phase')).not.toBe('idle')
  await page.keyboard.press('ArrowUp')
  await expect.poll(async () => canvas.getAttribute('data-gathering-phase')).toBe('idle')

  await page.getByRole('button', { name: '查看山缘石料点详情' }).first().click()
  await page.getByRole('button', { name: '自动采石' }).click()
  const firstStoneTarget = await canvas.getAttribute('data-gathering-target')
  await expect(page.getByLabel(/自动采石/)).toBeVisible()
  await page.waitForFunction(() => Number(document.querySelector<HTMLCanvasElement>('[aria-label="Realmseed 像素世界地图"]')?.dataset.gatheringStrike) === 5)
  await page.screenshot({ path: '/tmp/realmseed-auto-gather.png', fullPage: true })
  await expect(page.locator('.chronicle-list')).toContainText('开采石料 +')
  await expect.poll(async () => canvas.getAttribute('data-gathering-target')).not.toBe(firstStoneTarget)
  await page.keyboard.press('ArrowDown')
  await expect.poll(async () => canvas.getAttribute('data-gathering-phase')).toBe('idle')
})

test('keeps the fishing panel open between casts and animates seeded water signals', async ({ page }) => {
  await page.goto(appUrl)
  await page.getByLabel('世界种子').fill('fish-ui-41')
  await page.getByRole('button', { name: /展开这个世界/ }).click()
  const canvas = page.getByLabel('Realmseed 像素世界地图')
  const box = await canvas.boundingBox()
  expect(box).not.toBeNull()
  // Walk through visible tiles first; the influenced water target at (49,41) then enters sight.
  const startOriginX = Number(await canvas.getAttribute('data-origin-x'))
  const startOriginY = Number(await canvas.getAttribute('data-origin-y'))
  await page.mouse.dblclick(box!.x + ((46 - startOriginX + .5) / 25) * box!.width, box!.y + ((44 - startOriginY + .5) / 17) * box!.height, { delay: 45 })
  await expect.poll(async () => Number(await canvas.getAttribute('data-player-x'))).toBe(46)
  const middleOriginX = Number(await canvas.getAttribute('data-origin-x'))
  const middleOriginY = Number(await canvas.getAttribute('data-origin-y'))
  const middleBox = await canvas.boundingBox()
  await page.mouse.dblclick(middleBox!.x + ((47 - middleOriginX + .5) / 25) * middleBox!.width, middleBox!.y + ((43 - middleOriginY + .5) / 17) * middleBox!.height, { delay: 45 })
  await expect.poll(async () => Number(await canvas.getAttribute('data-player-x'))).toBe(47)
  const originX = Number(await canvas.getAttribute('data-origin-x'))
  const originY = Number(await canvas.getAttribute('data-origin-y'))
  const targetBox = await canvas.boundingBox()
  const screenX = targetBox!.x + ((49 - originX + .5) / 25) * targetBox!.width
  const screenY = targetBox!.y + ((41 - originY + .5) / 17) * targetBox!.height
  await page.mouse.dblclick(screenX, screenY, { delay: 45 })
  const cast = page.getByRole('button', { name: /抛竿/ })
  await expect(cast).toBeVisible({ timeout: 10_000 })
  await cast.click()
  const fishing = page.getByLabel('钓鱼判定')
  const audio = page.locator('.audio-button')
  await expect(audio).toHaveAttribute('data-audio-mode', 'shore')
  await audio.click()
  await expect(audio).toContainText('水岸乐声：开')
  await expect(fishing).toContainText('第 1 杆')
  await expect(fishing).toContainText('弱钓讯')
  const firstFrame = await canvas.getAttribute('data-water-animation-frame')
  await expect.poll(async () => await canvas.getAttribute('data-water-animation-frame')).not.toBe(firstFrame)
  await expect.poll(async () => Number(await canvas.getAttribute('data-visible-fishing-signals'))).toBeGreaterThan(0)

  await page.keyboard.press('Space')
  await expect(fishing).toContainText(/本杆落空|成功收竿|完美收竿/)
  await expect(audio).not.toHaveAttribute('data-last-fishing-sound', 'none')
  await expect(fishing).toContainText('已钓 1/10')
  await page.reload()
  await expect(page.getByLabel('钓鱼判定')).toContainText('已钓 1/10')
  await page.getByRole('button', { name: /再次抛竿/ }).click()
  await expect(page.getByLabel('钓鱼判定')).toContainText('第 2 杆')
  await expect(page.getByRole('button', { name: '收竿' })).toBeVisible()
  await page.screenshot({ path: '/tmp/realmseed-fishing-signals.png', fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(fishing).toBeVisible()
  await expect(page.getByRole('button', { name: '收竿' })).toBeVisible()
  await page.screenshot({ path: '/tmp/realmseed-fishing-mobile.png', fullPage: true })
})

test('enters a deep cave visibly and restores the same dungeon after refresh', async ({ page }) => {
  const consoleErrors: string[] = []
  const pageErrors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  page.on('pageerror', (error) => pageErrors.push(error.stack ?? error.message))
  await page.goto(appUrl)
  await page.getByLabel('世界种子').fill('cave-ui-15')
  await page.getByRole('button', { name: /展开这个世界/ }).click()
  const canvas = page.getByLabel('Realmseed 像素世界地图')
  const box = await canvas.boundingBox()
  expect(box).not.toBeNull()
  // The seeded cave is at (66, 43); the player starts at (62, 44).
  const screenX = box!.x + ((66 - 50 + .5) / 25) * box!.width
  const screenY = box!.y + ((43 - 36 + .5) / 17) * box!.height
  await page.mouse.dblclick(screenX, screenY, { delay: 45 })
  const enter = page.getByRole('button', { name: /进入洞穴/ })
  await expect(enter).toBeVisible({ timeout: 10_000 })
  await enter.click()
  await page.waitForTimeout(100)
  expect(pageErrors, `page crashed after entering cave: ${pageErrors.join(' | ')}`).toEqual([])

  await expect(page.locator('.world-status')).toContainText('地下第 1/3 层')
  await expect(canvas).toHaveAttribute('data-world-kind', 'dungeon')
  await expect.poll(async () => Number(await canvas.getAttribute('data-visible-tiles'))).toBeGreaterThan(20)
  await page.screenshot({ path: '/tmp/realmseed-cave.png', fullPage: true })

  await page.reload()
  const restoredCanvas = page.getByLabel('Realmseed 像素世界地图')
  await expect(page.locator('.world-status')).toContainText('地下第 1/3 层')
  await expect(restoredCanvas).toHaveAttribute('data-world-kind', 'dungeon')
  await expect.poll(async () => Number(await restoredCanvas.getAttribute('data-visible-tiles'))).toBeGreaterThan(20)
  expect(consoleErrors).toEqual([])
  expect(pageErrors).toEqual([])
})
