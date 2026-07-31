import { expect, test } from '@playwright/test'

test('starts a seeded world and advances a turn', async ({ page }) => {
  const consoleErrors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })

  await page.goto('http://127.0.0.1:5173/')
  await expect(page.getByRole('heading', { name: 'REALMSEED' })).toBeVisible()
  await page.getByLabel('世界种子').fill('browser-smoke-seed')
  await page.getByRole('button', { name: /展开这个世界/ }).click()

  await expect(page.getByLabel('Realmseed 像素世界地图')).toBeVisible()
  await expect(page.getByText('SEED: browser-smoke-seed')).toBeVisible()
  await expect(page.getByText('96 × 96')).toBeVisible()
  await expect(page.getByText('第').locator('..')).toContainText('1')
  await expect(page.getByRole('button', { name: '效忠' })).toHaveCount(3)
  await expect(page.getByRole('button', { name: '纳为附属' })).toHaveCount(3)
  await expect(page.getByText('场景坐标 [0, 0]')).toBeVisible()

  await page.getByRole('button', { name: /休息/ }).click()
  await expect(page.locator('.world-status')).toContainText('2')
  await expect(page.locator('.chronicle-list')).toContainText(/恢复|度过一夜/)
  await page.getByRole('button', { name: '向东前往相邻场景' }).click()
  await expect(page.getByText('场景坐标 [1, 0]')).toBeVisible()
  await expect(page.locator('.chronicle-list')).toContainText('场景由总种子继续展开')
  await page.screenshot({ path: '/tmp/realmseed-game.png', fullPage: true })

  expect(consoleErrors).toEqual([])
})

test('keeps the action interface usable on a phone viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('http://127.0.0.1:5173/')
  await page.getByRole('button', { name: /展开这个世界/ }).click()
  await expect(page.getByRole('button', { name: /休息/ })).toBeVisible()
  await expect(page.getByLabel('Realmseed 像素世界地图')).toBeVisible()
  await page.screenshot({ path: '/tmp/realmseed-mobile.png', fullPage: true })
})
