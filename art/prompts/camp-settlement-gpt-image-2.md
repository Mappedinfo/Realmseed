# Realmseed 驻地与营地建筑美术生成说明

这份文档用于让 GPT Image 2 生成 Realmseed 的驻地核心、六类营地建筑和一张完整驻地气氛图。游戏会继续采用“较真实的自然地表 + 清晰低像素人物与建筑”的混合画面，因此建筑需要比角色略有体积感，但轮廓、材质和色块仍必须适合像素化。

## 一、驻地文本设定

Realmseed 的驻地不是整齐的中世纪城市，而是远征队在迷雾荒野中逐步扎根的“移动文明节点”。所有建筑围绕篝火、道路和共同生活形成，没有统一砖墙，也没有宏伟宫殿。视觉上应体现：

- 就地取材：原木、帆布、石块、旧铜件、干草和藤蔓。
- 可持续扩建：建筑边缘保留木桩、绳索、工具和未完成的小构件。
- 明亮边界：灯笼、篝火、旗帜和浅色石圈构成安全范围的视觉语言。
- 阵营中立：基础驻地使用苔绿、暖琥珀、旧木褐和少量青铜，不直接绑定苔冠盟、余烬社或潮汐庭。
- 有人生活：即便不画人物，也要通过晒干的草药、晾衣绳、货箱、脚印、冒烟的烟囱表达人口。
- 低魔法：魔法只作为篝火祠和古代石刻中的微弱萤光，不出现夸张光柱。

## 二、统一素材规范

- 输出尺寸：`1536 × 768 px`。
- 排版：严格 `2 行 × 4 列`，共 8 个等尺寸单元，每格 `384 × 384 px`。
- 每个单元只放一个完整对象，位于格子中心，四周至少保留 12% 安全留白。
- 视角：固定约 3/4 俯视，镜头角度与 2D RPG / RTS 地图建筑一致。
- 光照：左上方柔和日光，物体内部允许遮挡阴影，但不要绘制超出单元格的大投影。
- 背景：纯色抠图绿 `#00FF66`，颜色必须完全均匀，无纹理、无渐变、无地平线。
- 对象之间不得连接；任何屋檐、旗杆、烟雾或树枝不得跨越单元格边界。
- 风格：低像素概念图，硬边缘色块，有限色阶，细节密度适合降采样为 `64 × 64 px`。
- 不要直接绘制像素网格，不要添加描边网格；后处理脚本会统一量化、抠图和像素采样。
- 不要文字、数字、UI、标签、水印、签名或人物。

## 三、建筑图集 A：正式生产提示词

复制下面整段提示词生成一张 2×4 图集：

```text
Create a production-ready 2D game building sprite sheet for a wilderness settlement management game named Realmseed.

Canvas is exactly 1536×768 pixels and divided into a strict invisible 2-row × 4-column grid. Each cell is exactly 384×384 pixels. Put exactly one complete isolated building or prop cluster in the center of each cell with at least 12% empty margin. Never let any object, smoke, flag, roof, shadow, plant, rope, or particle cross a cell boundary.

Fixed camera: consistent three-quarter top-down RTS/RPG view, about 35 degrees downward. Soft daylight from upper left. Low-pixel concept art designed to be downsampled into crisp 64×64 sprites: strong silhouette, clustered hard-edged color shapes, restrained material detail, limited palette, readable roof and entrance. Use reclaimed timber, canvas, field stone, rope, old bronze, moss green cloth, warm amber firelight, muted earth colors. The settlement feels improvised but loved, a small civilization taking root inside a dangerous fog-covered wilderness. Low fantasy only.

Background must be one perfectly flat chroma-key color #00FF66, with no gradient, texture, horizon, floor, vignette, border, grid line, text, label, UI, watermark, or signature. No characters.

Cell order, left to right:
Top row:
1. Settlement heart: a compact circular campfire hearth, four timber posts, a small moss-green expedition pennant, bedrolls, supply crates, a warm lantern, and a pale stone safety ring. It must read as the central registered camp tile.
2. Traveler lodge: a sturdy low timber-and-canvas dwelling with three implied sleeping bays, small chimney, hanging blanket, boots and storage chest. Warm, safe, expandable. Broad recognizable roof silhouette.
3. Forest-edge farm: three tidy raised crop beds, berry trellis, rain barrel, scare marker and tiny tool shed, all composed as one compact tile. Productive rather than decorative.
4. Wooden watchtower: elevated timber lookout platform, ladder, small roof, warning bell, lantern and one moss-green signal flag. Tall but fully contained. Defensive and vision-focused, not a castle.

Bottom row:
5. Tarp market: crossed timber frames supporting layered canvas awnings, two produce tables, baskets, scales, compact crates and hanging lanterns. A lively trade point without people or written signs.
6. Repair workshop: open-sided timber work shed, low forge glow, anvil, tool rack, saw bench, spare wheel and stacked planks. Practical frontier engineering, no industrial machinery.
7. Ember shrine: circular sheltered fire bowl beneath a small timber canopy, three carved waystones, herb bundles and subtle firefly-like green-gold motes kept close to the object. Quiet morale and recovery landmark, not a temple.
8. Road gate and supply marker: two short defensive timber posts, rope barrier, lantern, milestone, stacked road repair materials and a strip of compacted path contained inside the object cluster. It should visually connect camps and mark the controlled boundary.

Prioritize instantly readable silhouettes and consistent scale. Avoid photorealism, painterly blur, smooth 3D rendering, glossy plastic, elaborate medieval stone architecture, giant castles, modern objects, excessive magic, dense vegetation hiding the building, characters, animals, text, and cast shadows extending outside cells.
```

## 四、完整驻地场景图提示词

这张图用于开始界面、营地详情背景或美术方向参考，不直接切割为格子素材。

```text
A wide key-art scene for Realmseed, a wilderness exploration and settlement-management web game. Three-quarter top-down view of a small frontier settlement growing inside a misty moss-covered valley at late afternoon. In the center is a warm registered camp hearth and moss-green expedition pennant. Around it are a traveler lodge, forest-edge farm, wooden watchtower, tarp market, repair workshop and quiet ember shrine. Two compacted dirt roads leave the settlement and disappear into darker unexplored forest. The controlled territory is communicated naturally by lanterns, pale boundary stones, cleared undergrowth and warm windows rather than a glowing sci-fi circle.

Show credible daily life through objects but no close-up characters: crates, berry baskets, hanging herbs, repaired tools, water barrels, stacked firewood, footprints and thin chimney smoke. The outer forest is realistic and richly textured; buildings use clean low-pixel silhouettes and restrained clustered colors, creating a deliberate hybrid of realistic terrain and pixel-game objects. Palette: deep moss green, lichen yellow-green, weathered timber brown, warm amber, muted slate blue, tiny old-bronze accents. Atmosphere is hopeful, practical and slightly mysterious, not cute, not heroic fantasy.

16:9 composition, no UI, no text, no logo, no labels, no watermark, no borders, no modern objects, no castle, no giant city, no neon magic, no oversaturated colors.
```

## 五、夜间驻地场景图提示词

```text
Use the same Realmseed settlement layout and architecture, now viewed at blue-hour night from the same three-quarter top-down camera. The camp control area stays visibly safe through many small practical light sources: central hearth, lanterns on the lodge, watchtower, market and road gate, a low forge glow, and restrained green-gold motes around the ember shrine. Outside the cleared boundary, the wilderness quickly becomes cool, dark and misty. Roads remain readable but fade into fog. Keep the terrain relatively realistic and the settlement structures crisp low-pixel game art. No people in close-up, no monsters, no UI, no text, no giant magical dome, no cyberpunk neon.
```

## 六、图集内容与游戏数值映射

| 单元 | 游戏名称 | 建造成本 | 核心功能 | UI 中应强调的视觉信号 |
|---|---|---:|---|---|
| A1 | 驻地核心 | 建营 8 金 | 初始容量 3、防御 1、经济 1、食物 2、士气 3、范围 3 | 旗帜、篝火、安全石圈 |
| A2 | 旅人居所 | 1 金 + 1 建筑格 | 容量 +3、士气 +1 | 床铺、烟囱、生活物件 |
| A3 | 林缘农圃 | 2 金 + 1 建筑格 | 食物 +3、经济 +1 | 作物行列、雨桶、莓架 |
| A4 | 木制瞭望塔 | 3 金 + 1 建筑格 | 防御 +3、范围 +1 | 高位平台、警铃、旗帜 |
| A5 | 篷布集市 | 4 金 + 1 建筑格 | 经济 +3、士气 +1 | 遮阳篷、秤、货箱 |
| A6 | 修造工坊 | 4 金 + 1 建筑格 | 防御 +1、经济 +2；本地战斗伤害 +1 | 铁砧、工具、炉火 |
| A7 | 篝火祠 | 3 金 + 1 建筑格 | 士气 +3；强化归零后的休整 | 石刻、药草、克制萤光 |
| A8 | 道路门标 | 自动生成 | 表示营地道路和控制边界 | 灯笼、里程石、修路材料 |

## 七、生成后检查清单

- [ ] 图像严格为 2 行 4 列，八个对象位置清楚且互不重叠。
- [ ] 背景是完全一致的 `#00FF66`，没有地面纹理或投影污染。
- [ ] 每个对象即使缩小到 64×64 仍能通过轮廓辨认。
- [ ] 六类建筑共享材质、相机、光向和比例。
- [ ] 瞭望塔没有顶到单元边缘，烟雾没有跨格。
- [ ] 集市没有文字招牌，祠堂没有夸张魔法效果。
- [ ] 建筑脚底接触面紧凑，方便抠图后放置在现有真实地表贴图上。

生成完成后，把原图放进 `art/generated/raw/`。建议文件名：

- `2r4c-camp-buildings-v2.png`
- `camp-settlement-key-art.png`
- `camp-settlement-night-key-art.png`

后续可使用现有 `scripts/process_generated_asset.py` 与图集构建脚本进行分格、抠图、色板量化和最近邻缩放。
