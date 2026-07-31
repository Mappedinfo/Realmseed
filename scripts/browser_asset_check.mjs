import { chromium } from 'playwright'

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 })
const failures = []
const responses = []
page.on('requestfailed', (request) => {
  if (!request.url().endsWith('/audio/loopcity.ogg')) {
    failures.push(`${request.url()} :: ${request.failure()?.errorText}`)
  }
})
page.on('response', (response) => {
  if (response.url().includes('/assets/')) responses.push([response.status(), response.url()])
})
page.on('console', (message) => {
  if (message.type() === 'error') failures.push(`console :: ${message.text()}`)
})

await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' })
await page.screenshot({ path: '/private/tmp/realmseed-title-generated.png', fullPage: true })

const titleBackground = await page.locator('.title-screen').evaluate((element) => getComputedStyle(element).backgroundImage)
if (!titleBackground.includes('verdant-world-scene.webp')) {
  throw new Error(`Generated title scene is not active: ${titleBackground}`)
}

await page.locator('#world-seed').fill('interaction-3')
await page.getByText('小地图', { exact: true }).click()
await page.getByRole('button', { name: /展开这个世界/ }).click()
await page.locator('canvas[aria-label="Realmseed 像素世界地图"]').waitFor()
await page.waitForTimeout(800)

const canvas = page.locator('canvas[aria-label="Realmseed 像素世界地图"]')
await canvas.screenshot({ path: '/private/tmp/realmseed-map-generated.png' })
const canvasStats = await canvas.evaluate((element) => {
  const context = element.getContext('2d')
  const pixels = context.getImageData(0, 0, element.width, element.height).data
  const colors = new Set()
  let nonTransparent = 0
  for (let index = 0; index < pixels.length; index += 4) {
    if (pixels[index + 3] > 0) {
      nonTransparent += 1
      if (colors.size < 5000) colors.add(`${pixels[index]},${pixels[index + 1]},${pixels[index + 2]},${pixels[index + 3]}`)
    }
  }
  return { width: element.width, height: element.height, nonTransparent, sampledUniqueColors: colors.size }
})

const bubble = page.locator('.talk-bubble').first()
await bubble.waitFor()
const bubbleLabel = await bubble.getAttribute('aria-label')
await bubble.click()
const interaction = page.locator('.interaction-panel')
await interaction.waitFor()

const inventory = page.locator('.inventory-item')
const berriesBefore = Number((await inventory.locator('b').innerText()).replace(/\D/g, ''))
const goldBefore = Number(await page.locator('.resource-row strong').first().innerText())
const marketText = await interaction.locator('.market-rate strong').innerText()
const rate = Number(marketText.match(/\d+/)?.[0])
if (rate < 8 || rate > 12) throw new Error(`Unexpected berry exchange rate: ${marketText}`)

await interaction.getByRole('button', { name: /花 1 金购买/ }).click()
const berriesAfter = Number((await inventory.locator('b').innerText()).replace(/\D/g, ''))
const goldAfter = Number(await page.locator('.resource-row strong').first().innerText())
if (berriesAfter !== berriesBefore + rate || goldAfter !== goldBefore - 1) {
  throw new Error(`Trade did not update inventory: ${berriesBefore}/${goldBefore} -> ${berriesAfter}/${goldAfter}, rate ${rate}`)
}
await interaction.getByRole('button', { name: /^交谈/ }).click()
await page.screenshot({ path: '/private/tmp/realmseed-trade-panel.png', fullPage: true })

await page.setViewportSize({ width: 720, height: 1100 })
await page.waitForTimeout(200)
if (!(await page.locator('.inventory-panel').isVisible())) throw new Error('Inventory is hidden on the mobile layout')
await page.screenshot({ path: '/private/tmp/realmseed-trade-mobile.png', fullPage: true })

const requiredAssets = [
  'verdant-generated-preview.png',
  'verdant-generated-terrain.png',
  'verdant-generated-objects.png',
  'verdant-generated-characters.png',
  'verdant-world-scene.webp',
]
for (const asset of requiredAssets) {
  const matches = responses.filter(([, url]) => url.endsWith(asset))
  if (!matches.some(([status]) => status === 200)) throw new Error(`Missing successful response for ${asset}`)
}
if (failures.length) throw new Error(`Browser failures:\n${failures.join('\n')}`)

console.log(JSON.stringify({
  titleBackground,
  canvasStats,
  interaction: { bubbleLabel, marketText, berriesBefore, berriesAfter, goldBefore, goldAfter },
  assetResponses: responses,
}, null, 2))
await browser.close()
