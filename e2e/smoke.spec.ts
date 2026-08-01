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
  await page.mouse.dblclick(screenX, screenY, { delay: 45 })
  await expect(page.getByText('AUTO ROUTE')).toBeVisible()
  await page.screenshot({ path: '/tmp/realmseed-navigation.png', fullPage: true })
  await page.waitForFunction(
    ([x, y]) => {
      const element = document.querySelector<HTMLCanvasElement>('[aria-label="Realmseed 像素世界地图"]')
      if (!element) return false
      return Number(element.dataset.playerX) !== x || Number(element.dataset.playerY) !== y
    },
    [startX, startY],
  )
  await page.waitForFunction(() => {
    const element = document.querySelector<HTMLCanvasElement>('[aria-label="Realmseed 像素世界地图"]')
    if (!element) return false
    const x = Number(element.dataset.playerVisualX)
    const y = Number(element.dataset.playerVisualY)
    return Math.abs(x - Math.round(x)) > .01 || Math.abs(y - Math.round(y)) > .01
  })
  await page.keyboard.press('ArrowUp')
  await expect(page.getByText('AUTO ROUTE')).toBeHidden()
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
