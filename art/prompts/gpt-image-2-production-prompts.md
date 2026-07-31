# Realmseed · GPT Image 2 素材生成提示词包

这份文件用于让 GPT Image 2 生成高质量母版。母版不是最终游戏像素，
后续会统一执行抠图、裁边、限色、缩采样、硬 Alpha 和最近邻放大。

## 建议生成参数

- 模型：`gpt-image-2`
- 质量：`high`
- 格式：PNG
- 单体素材：`2048×2048`
- 横向场景：`2048×1152`
- 素材表：`2048×2048`
- 不要请求原生透明背景；GPT Image 2 使用白底或色键背景。
- 每条提示词单独生成一张图，不要一次要求模型生成所有风格。
- 原图按下面给出的文件名保存，便于后续自动处理。

## 两种生成路线

### 路线 A：清晰普通插画母版（推荐）

让模型生成清晰、平涂、轮廓明确的普通游戏插画，再由算法转换为像素素材。
优点是人物结构、建筑和物品更稳定，抠图也更干净。

在提示词的风格部分使用：

> clean top-down game asset illustration, simplified geometric shapes,
> crisp silhouette, flat color regions, two-step cel shading, minimal texture,
> no anti-aliased micro-detail, designed to survive reduction to 16×16 or
> 32×32 pixels

### 路线 B：直接生成低像素参考图

适合作为视觉参考，但仍需后处理，不能直接当作标准 Atlas。

在提示词的风格部分使用：

> true low-resolution pixel-art appearance, deliberate square pixel clusters,
> hard edges, no blur, no smooth gradients, flat stepped shadows, consistent
> 24×24 or 32×32 sprite grammar, readable at thumbnail size

## 背景选择

### 白底

适合含绿色、青色、植物或白色被封闭在轮廓内部的素材。后处理算法只从边界
向内洪泛移除白色，因此人物眼睛、衣服高光等封闭白色区域不会被误删。

追加：

> perfectly flat solid white background, no floor, no horizon, no cast shadow,
> no contact shadow, no reflection, no background texture, generous empty
> margin around every subject

### 绿幕

适合不包含鲜绿色的建筑、怪物和物品。

追加：

> perfectly flat solid #00FF00 chroma-key background, one uniform green color,
> no gradient, no lighting variation, no floor, no horizon, no shadow, no
> reflection; do not use #00FF00 or similar neon green anywhere in the subject

---

# 一、世界风格方向板

方向板用于确定色彩、轮廓、材质和光照，不需要抠图。

## 01 · 森林遗迹 Verdant Relic

建议文件名：`verdant-style-board.png`

```text
Use case: stylized-concept.
Asset type: original art-direction board for Realmseed, a direct-overhead
browser exploration and village-management game.

Create a coherent Verdant Relic visual direction. Show one large direct-overhead
world sample containing moss meadow, fern forest edge, muted teal stream,
wheat-colored paths, small farm plots, a compact amber-roof village, ancient
stone ruins, a luminous cyan waystone, and a stepped fog-of-war boundary.
Around the main scene, show four tiny traveler and villager silhouettes, a
slime, a boar, a floating wisp, two houses, a tent, food and coin props.

Style: clean top-down game asset illustration, simplified geometric shapes,
crisp silhouette, flat color regions, two-step cel shading, minimal texture,
designed to survive reduction to 16×16 or 32×32 pixels.
Lighting: consistent upper-left warm daylight.
Palette: deep green-black shadows, moss and fern greens, muted teal water,
warm wheat, amber roofs, small luminous cyan magical accents.
Composition: direct overhead only; one large scene plus orderly asset callouts;
no labels and no text.

Original designs only. No franchise likeness. No isometric perspective, side
view, 3D render, photorealism, smooth gradient, blur, excessive texture,
anti-aliased micro-detail, logo, signature, border, UI, text or watermark.
```

## 02 · 余烬边境 Ember Frontier

建议文件名：`ember-style-board.png`

```text
Use case: stylized-concept.
Asset type: original art-direction board for Realmseed, a direct-overhead
browser exploration and village-management game.

Create a coherent Ember Frontier visual direction. Show one large direct-
overhead world sample containing dry sage grass, dusty ochre earth, rocky
badlands, an iron-blue stream, a winding road, farm plots, market tents,
palisades, a compact frontier settlement, a warm orange waystone, and a stepped
fog-of-war boundary. Around the scene, show four settlers and scouts with
distinct hats and red travel scarves, three original monsters, tents, houses,
wooden defenses, food and coin props.

Style: clean top-down game asset illustration, simplified geometric shapes,
crisp silhouette, flat color regions, two-step cel shading, minimal texture,
designed to survive reduction to 16×16 or 32×32 pixels.
Lighting: dry upper-left afternoon light.
Palette: dusty ochre, faded sage, iron blue, cream canvas, dark plum shadows,
ember orange and pale gold highlights.
Composition: direct overhead only; one large scene plus orderly asset callouts;
no labels and no text.

Original designs only. No franchise likeness. No isometric perspective, side
view, 3D render, photorealism, smooth gradient, blur, excessive texture,
anti-aliased micro-detail, logo, signature, border, UI, text or watermark.
```

## 03 · 月潮海岸 Moonlit Tide

建议文件名：`moonlit-style-board.png`

```text
Use case: stylized-concept.
Asset type: original art-direction board for Realmseed, a direct-overhead
browser exploration and village-management game.

Create a coherent Moonlit Tide visual direction. Show one large direct-overhead
world sample containing deep navy ground, turquoise channels, blue-green
foliage, lavender stone islands, docks, small fishing houses, shrine ruins,
bioluminescent plants, a cyan moon-waystone, coral travel ribbons, and a
stepped fog-of-war boundary. Around the scene, show four travelers and fishers,
three original coastal monsters, boats, houses, shrine props, food and coins.

Style: clean top-down game asset illustration, simplified geometric shapes,
crisp silhouette, flat color regions, two-step cel shading, minimal texture,
designed to survive reduction to 16×16 or 32×32 pixels.
Lighting: soft upper-left moonlight with controlled luminous accents.
Palette: deep navy, blue-green, turquoise, lavender stone, coral, pale gold,
small cyan bioluminescent highlights.
Composition: direct overhead only; one large scene plus orderly asset callouts;
no labels and no text.

Original designs only. No franchise likeness. No isometric perspective, side
view, 3D render, photorealism, smooth gradient, blur, excessive texture,
anti-aliased micro-detail, logo, signature, border, UI, text or watermark.
```

---

# 二、完整场景母版

完整场景用于提取配色、地形纹理和构图，不做抠图。每套风格各生成一张。

## 04 · 森林遗迹场景

建议文件名：`verdant-scene-master.png`

```text
Create an original direct-overhead game scene for Realmseed in the Verdant
Relic direction. A 24×18-tile-like explored clearing sits inside dark fog of
war. Include moss meadow, two fern forest masses, a muted teal winding stream
with a small bridge, wheat paths, four farm plots, three amber-roof houses, one
camp, ancient ruins, a luminous cyan waystone, four tiny travelers, one slime,
one boar, one wisp, food pickups and coins.

Use clean top-down game illustration, crisp silhouettes, simplified geometry,
flat color regions, two-step cel shading, minimal texture, and consistent
upper-left light. Every object must remain readable after heavy reduction.
Camera is exactly vertical overhead. Use deep green-black, moss, fern, muted
teal, wheat, amber and cyan. Fill the whole image with the scene.

No isometric perspective, no side-facing horizon, no labels, no UI, no text,
no logo, no watermark, no smooth gradient, no photorealism, no franchise
likeness.
```

## 05 · 余烬边境场景

建议文件名：`ember-scene-master.png`

```text
Create an original direct-overhead game scene for Realmseed in the Ember
Frontier direction. A 24×18-tile-like explored settlement sits inside dark fog
of war. Include dry sage grass, ochre earth, rocky ground, an iron-blue stream,
a winding road, canvas market tents, farm plots, palisades, three frontier
houses, a camp, a warm orange waystone, four scouts and settlers, three
original monsters, food pickups and coins.

Use clean top-down game illustration, crisp silhouettes, simplified geometry,
flat color regions, two-step cel shading, minimal texture, and consistent dry
upper-left light. Every object must remain readable after heavy reduction.
Camera is exactly vertical overhead. Use dusty ochre, faded sage, iron blue,
cream canvas, dark plum, ember orange and pale gold. Fill the whole image.

No isometric perspective, no side-facing horizon, no labels, no UI, no text,
no logo, no watermark, no smooth gradient, no photorealism, no franchise
likeness.
```

## 06 · 月潮海岸场景

建议文件名：`moonlit-scene-master.png`

```text
Create an original direct-overhead game scene for Realmseed in the Moonlit
Tide direction. A 24×18-tile-like explored coastal village sits inside dark fog
of war. Include deep navy ground, turquoise channels, small islands, blue-green
foliage, lavender stone, docks, fishing houses, shrine ruins, a cyan
moon-waystone, bioluminescent plants, four travelers and fishers, three
original coastal monsters, food pickups and coins.

Use clean top-down game illustration, crisp silhouettes, simplified geometry,
flat color regions, two-step cel shading, minimal texture, and consistent
upper-left moonlight. Every object must remain readable after heavy reduction.
Camera is exactly vertical overhead. Use deep navy, turquoise, blue-green,
lavender, coral, pale gold and restrained cyan glow. Fill the whole image.

No isometric perspective, no side-facing horizon, no labels, no UI, no text,
no logo, no watermark, no smooth gradient, no photorealism, no franchise
likeness.
```

---

# 三、角色素材表

生成后按格切分。每个角色之间必须留出大量纯背景。

## 07 · 森林遗迹角色

建议文件名：`verdant-characters-white.png`

```text
Create a clean 4-column by 2-row character asset sheet for an original
direct-overhead exploration game. Exactly eight separate full-body characters:
free traveler, moss scout, farmer, camp keeper, wandering merchant, follower,
village guard, relic scholar. Each character faces downward toward the viewer,
stands in the center of an equal invisible cell, uses the same scale, and has a
strongly distinct hat, hair or clothing silhouette. Arms close to the body,
feet visible, no props crossing cell boundaries.

Verdant Relic palette: moss, fern, muted teal, wheat, amber, deep green-black,
with tiny cyan magical accents. Clean game asset illustration, simplified
geometric shapes, crisp contour, flat color regions, two-step cel shading,
minimal detail, designed for reduction to 16×16 or 24×24 pixels.

Perfectly flat solid white background, no floor, no horizon, no cast shadow,
no contact shadow, no reflection, no texture. Large empty separation between
all characters. No text, labels, grid lines, border, logo or watermark. No
isometric view, no side view, no cropped body, no overlapping characters.
```

## 08 · 余烬边境角色

建议文件名：`ember-characters-green.png`

```text
Create a clean 4-column by 2-row character asset sheet for an original
direct-overhead exploration game. Exactly eight separate full-body characters:
frontier traveler, red-scarf scout, dryland farmer, tent keeper, caravan
merchant, follower, palisade guard, ember priest. Each character faces downward
toward the viewer, stands in the center of an equal invisible cell, uses the
same scale, and has a strongly distinct hat, scarf or clothing silhouette.

Ember Frontier palette: ochre, faded sage, iron blue, cream canvas, dark plum,
ember orange and pale gold. Do not use neon green. Clean game asset
illustration, simplified geometric shapes, crisp contour, flat color regions,
two-step cel shading, minimal detail, designed for reduction to 16×16 or
24×24 pixels.

Perfectly flat solid #00FF00 chroma-key background, one uniform green color,
no gradient, floor, horizon, shadow, reflection or texture. Do not use #00FF00
or similar neon green in any character. Large empty separation. No text,
labels, grid lines, border, logo or watermark. No isometric view, side view,
cropped body or overlap.
```

## 09 · 月潮海岸角色

建议文件名：`moonlit-characters-green.png`

```text
Create a clean 4-column by 2-row character asset sheet for an original
direct-overhead exploration game. Exactly eight separate full-body characters:
coastal traveler, fisher, dock worker, shrine keeper, coral merchant, follower,
moon guard, tide scholar. Each character faces downward toward the viewer,
stands in the center of an equal invisible cell, uses the same scale, and has a
strongly distinct hat, ribbon or clothing silhouette.

Moonlit Tide palette: deep navy, turquoise, blue-green, lavender, coral, pale
gold and cyan. Do not use neon green. Clean game asset illustration, simplified
geometric shapes, crisp contour, flat color regions, two-step cel shading,
minimal detail, designed for reduction to 16×16 or 24×24 pixels.

Perfectly flat solid #00FF00 chroma-key background, one uniform green color,
no gradient, floor, horizon, shadow, reflection or texture. Do not use #00FF00
or similar neon green in any character. Large empty separation. No text,
labels, grid lines, border, logo or watermark. No isometric view, side view,
cropped body or overlap.
```

---

# 四、怪物素材表

## 10 · 三套风格通用怪物

建议文件名：`realmseed-monsters-green.png`

```text
Create a clean 4-column by 2-row monster asset sheet for an original
direct-overhead exploration game. Exactly eight separate creatures: moss slime,
thorn boar, mist wisp, rock crab, marsh crawler, ember moth, moon jelly, ancient
seed guardian. Each creature is centered in an equal invisible cell, shown from
a slightly top-down game-readable angle, uses the same apparent scale, and has
a strong compact silhouette. No creature touches another cell.

Use an original Realmseed visual language: simplified geometric anatomy, crisp
contours, flat color regions, two-step cel shading, minimal internal detail,
expressive eyes only where appropriate, designed for reduction to 16×16 or
24×24 pixels. Use moss, muted teal, ochre, dark plum, coral, lavender, pale gold
and cyan, but no neon green.

Perfectly flat solid #00FF00 chroma-key background, one uniform green color,
no gradient, floor, horizon, cast shadow, contact shadow, reflection or texture.
Do not use #00FF00 or similar neon green in any creature. Large empty separation.
No text, labels, grid lines, border, logo, watermark, cropped creature or overlap.
```

---

# 五、建筑与设施素材表

## 11 · 森林遗迹建筑

建议文件名：`verdant-buildings-white.png`

```text
Create a clean 4-column by 2-row building asset sheet for an original direct-
overhead village exploration game. Exactly eight separate assets: small camp,
amber-roof cottage, staffed village hall, broken stone ruin, luminous cyan
waystone, wooden bridge, four-tile farm plot, moss watchtower. Show every asset
from the exact same direct-overhead game camera, centered in an equal invisible
cell with generous spacing.

Verdant Relic palette, crisp silhouette, simplified geometry, flat color
regions, two-step cel shading, minimal material texture, designed for reduction
to 24×24 or 32×32 pixels. Consistent upper-left light.

Perfectly flat solid white background, no floor plane, no horizon, no cast
shadow outside each asset, no reflection, no texture. No text, labels, grid
lines, border, logo, watermark, isometric perspective, side view, crop or overlap.
```

## 12 · 余烬边境建筑

建议文件名：`ember-buildings-green.png`

```text
Create a clean 4-column by 2-row building asset sheet for an original direct-
overhead frontier exploration game. Exactly eight separate assets: canvas camp,
iron-blue-roof house, frontier hall, broken badland ruin, warm ember waystone,
wooden palisade gate, dry farm plot, market tent. Exact same direct-overhead
camera, equal invisible cells, centered assets, generous spacing.

Ember Frontier palette: dusty ochre, faded sage, iron blue, cream canvas, dark
plum, ember orange and pale gold. Crisp silhouettes, simplified geometry, flat
color regions, two-step cel shading, minimal material texture, designed for
reduction to 24×24 or 32×32 pixels. Do not use neon green.

Perfectly flat solid #00FF00 background, one uniform green color, no gradient,
floor, horizon, external shadow, reflection or texture. Do not use #00FF00 in
the assets. No text, labels, grid lines, border, logo, watermark, isometric
perspective, side view, crop or overlap.
```

## 13 · 月潮海岸建筑

建议文件名：`moonlit-buildings-green.png`

```text
Create a clean 4-column by 2-row building asset sheet for an original direct-
overhead coastal exploration game. Exactly eight separate assets: fisher camp,
coral-roof house, tide village hall, lavender shrine ruin, cyan moon-waystone,
wooden dock, island farm plot, small moored boat. Exact same direct-overhead
camera, equal invisible cells, centered assets, generous spacing.

Moonlit Tide palette: deep navy, turquoise, blue-green, lavender, coral, pale
gold and cyan. Crisp silhouettes, simplified geometry, flat color regions,
two-step cel shading, minimal material texture, designed for reduction to
24×24 or 32×32 pixels. Do not use neon green.

Perfectly flat solid #00FF00 background, one uniform green color, no gradient,
floor, horizon, external shadow, reflection or texture. Do not use #00FF00 in
the assets. No text, labels, grid lines, border, logo, watermark, isometric
perspective, side view, crop or overlap.
```

---

# 六、地形纹理素材表

地形不抠图，要求无透视、铺满方格。模型输出后按 4×2 等分。

## 14 · 森林遗迹地形

建议文件名：`verdant-terrain-sheet.png`

```text
Create a seamless-looking 4-column by 2-row top-down terrain material sheet for
an original exploration game. Exactly eight equal square swatches: moss meadow,
flower meadow, dense fern forest floor, sparse forest floor, muted teal water,
marsh water with reeds, warm sand, gray mossy stone. Every square is viewed
exactly from above, fills its entire cell edge to edge, has no objects crossing
between cells, and keeps material scale consistent.

Verdant Relic palette. Simplified flat color clusters, two-step shading, sparse
readable texture, no lighting gradient across the sheet, designed for reduction
to 16×16 or 32×32 tiles. No text, labels, gutters with decoration, perspective,
horizon, buildings, characters, logo or watermark.
```

## 15 · 余烬边境地形

建议文件名：`ember-terrain-sheet.png`

```text
Create a seamless-looking 4-column by 2-row top-down terrain material sheet for
an original frontier exploration game. Exactly eight equal square swatches:
dry sage grass, dusty ochre earth, cracked badland, sparse scrub, iron-blue
water, muddy marsh, pale dry sand, dark plum-gray rock. Every square is viewed
exactly from above, fills its entire cell edge to edge, has no objects crossing
between cells, and keeps material scale consistent.

Ember Frontier palette. Simplified flat color clusters, two-step shading,
sparse readable texture, no lighting gradient across the sheet, designed for
reduction to 16×16 or 32×32 tiles. No text, labels, decorative gutters,
perspective, horizon, buildings, characters, logo or watermark.
```

## 16 · 月潮海岸地形

建议文件名：`moonlit-terrain-sheet.png`

```text
Create a seamless-looking 4-column by 2-row top-down terrain material sheet for
an original magical coastal exploration game. Exactly eight equal square
swatches: deep navy ground, blue-green meadow, luminous forest floor, lavender
stone, turquoise shallow water, deep water, coral sand, shrine paving. Every
square is viewed exactly from above, fills its entire cell edge to edge, has no
objects crossing between cells, and keeps material scale consistent.

Moonlit Tide palette. Simplified flat color clusters, two-step shading, sparse
readable texture, restrained cyan highlights, no global gradient, designed for
reduction to 16×16 or 32×32 tiles. No text, labels, decorative gutters,
perspective, horizon, buildings, characters, logo or watermark.
```

---

# 七、物品与资源素材表

## 17 · 食物、金币与经营物品

建议文件名：`realmseed-items-green.png`

```text
Create a clean 4-column by 2-row item asset sheet for an original exploration
and settlement game. Exactly eight separate items: old gold coin pouch, red
wild berry cluster, bread loaf, grilled fish, seed bag, cut wood bundle, stone
bundle, small cyan relic shard. Each item is centered in an equal invisible
cell, uses a compact strong silhouette and consistent apparent scale.

Clean game icon illustration, simplified geometry, crisp contour, flat color
regions, two-step cel shading, very limited internal detail, designed for
reduction to 12×12 or 16×16 pixels. Do not use neon green.

Perfectly flat solid #00FF00 chroma-key background, one uniform green color,
no gradient, floor, horizon, cast shadow, contact shadow, reflection or texture.
Do not use #00FF00 in any item. Large empty separation. No text, labels, grid
lines, border, logo, watermark, crop or overlap.
```

---

# 八、直接像素风备选提示词

如果想比较“模型直接出像素”与“普通母版再算法像素化”，可任选上面的提示词，
把 `Style` 段替换为：

```text
True low-resolution pixel-art appearance with a strict 32×32 logical sprite
grammar. Use deliberate square pixel clusters, hard one-pixel stair steps,
flat color ramps, no anti-aliasing, no subpixel detail, no smooth gradients,
no blur, no painterly texture. Use at most 20 visible colors for the whole
subject. The result must remain readable when displayed at 32×32 pixels.
```

仍然保留白底或绿幕段。不要要求模型输出透明背景。

# 九、生成后文件检查

每张图生成后检查：

1. 相机是否真正垂直俯视，而不是常见的 3/4 isometric。
2. 背景是否为完全统一的白色或 `#00FF00`。
3. 素材是否互不重叠，并与画布边缘保持足够距离。
4. 是否没有文字、标签、水印和网格线。
5. 人物身体、建筑屋顶和怪物轮廓是否完整。
6. 同一素材表中的比例与光源是否一致。
7. 如果背景出现阴影、渐变或地面，重新生成，不要交给抠图算法强行修复。

# 十、推荐优先顺序

先生成以下 7 张即可开始第一轮素材处理：

1. `verdant-style-board.png`
2. `verdant-scene-master.png`
3. `verdant-characters-white.png`
4. `realmseed-monsters-green.png`
5. `verdant-buildings-white.png`
6. `verdant-terrain-sheet.png`
7. `realmseed-items-green.png`

第一轮风格确认后，再生成 Ember Frontier 与 Moonlit Tide 对应素材，避免在
尚未确定轮廓语言时一次产生过多不可用图片。
