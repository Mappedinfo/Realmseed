# Realmseed

> 一粒种子，一方世界。

Realmseed 是一个开源、纯前端、像素风的探索经营 Web 游戏。输入文本种子后，浏览器会确定性生成地形、旅行者、阵营、怪物、资源、营地与地下副本；同一个种子始终展开同一个世界。项目不依赖服务器，可直接部署到 GitHub Pages。

[在线游玩](https://mappedinfo.github.io/Realmseed/) · [游戏设计](docs/game-design.md) · [美术规范](docs/art-direction.md) · [第三方资源鸣谢](THIRD_PARTY.md)

![Realmseed 三种可切换美术方向](docs/screenshots/art-direction-picker.png)

> 当前阶段：可玩的 Alpha 原型。核心循环、版本化存档和自动部署已经可用，但数值、内容量与移动端体验仍会持续调整。

## 五分钟开始开发

### 环境要求

- Node.js 22（GitHub Actions 使用的版本）
- npm
- Python 3（仅处理或导入像素素材时需要）
- Chromium / Playwright（仅浏览器验收时需要）

```bash
git clone https://github.com/Mappedinfo/Realmseed.git
cd Realmseed
npm ci
npm run dev
```

Vite 默认启动在 `http://127.0.0.1:5173/`。常用命令：

| 命令 | 用途 |
| --- | --- |
| `npm run dev` | 启动热更新开发服务器 |
| `npm test` | 运行 Vitest 规则与确定性测试 |
| `npm run test:watch` | 监听模式运行单元测试 |
| `npm run build` | TypeScript 检查并生成 `dist/` |
| `npm run preview` | 本地预览生产构建 |
| `npx playwright test` | 运行浏览器交互回归测试 |

浏览器测试需要一个正在运行的开发服务器：

```bash
# 终端 1
npm run dev -- --host 127.0.0.1 --port 5173

# 终端 2
E2E_BASE_URL=http://127.0.0.1:5173/ npx playwright test
```

## 开发约定

Realmseed 把规则、界面和素材处理分开维护。修改功能时建议按以下顺序工作：

1. 在 `src/game/types.ts` 明确数据与动作类型。
2. 把可确定性测试的规则放入 `src/game/`，避免写进 React 组件。
3. 在相邻的 `*.test.ts` 增加种子、边界和状态转换测试。
4. 在 `src/components/` 接入交互，在 `WorldCanvas.tsx` 接入地图视觉反馈。
5. 涉及完整操作链时更新 `e2e/smoke.spec.ts`。
6. 提交前运行 `npm test`、`npm run build` 和相关 Playwright 测试。

必须保持的项目约束：

- **种子确定性**：世界内容使用项目的哈希/种子工具派生，不在模拟规则中直接调用 `Math.random()`。
- **纯静态部署**：正式版本不能依赖后端、数据库、账号或运行时密钥。
- **存档兼容**：修改持久化结构时递增 `schemaVersion`，增加单步迁移器和旧存档测试；失败的迁移不得覆盖原数据。
- **状态来源唯一**：规则状态由 `GameState` 和 reducer 管理；短暂的动画、自动路线与指针状态留在界面层。
- **像素渲染**：Canvas 禁用平滑采样，人物绘制对齐整数像素。移动反馈使用位置插值和足迹，不加入透明度闪烁或上下弹跳。
- **素材许可**：只提交原创、CC0、MIT 兼容或明确允许再分发的素材，并同步更新 `THIRD_PARTY.md`。

## 当前特性

| 系统 | 已实现内容 |
| --- | --- |
| 世界与迷雾 | 40×40 快速地图、96×96 远征地图、无限场景坐标、三态战争迷雾、场景缓存、界碑跨场景旅行 |
| 移动与寻路 | WASD/方向键、按钮移动、双击最短路径、道路减耗、整数像素移动动画、方向足迹 |
| 采集与建造 | 野果、木材、石材；3 斧伐木、5 锤采石；自动寻找下一个已探索同类资源；三日再生；材料建营与六类建筑 |
| 角色与社会 | 随机玩家、旅行者、六种专长、好感、招募、随从队伍、阵营声望、效忠与附属关系 |
| 营地人口 | 两名开拓者起步、住房与食物约束、婚姻、生子、60 日成年、移民、熟人定居、四类营地官职 |
| 战斗 | 怪物追击、双战斗界面、六种装备招式、近战/远程射程、命中/暴击/格挡、NPC 血量、装备与实际掉落 |
| 红名与追缉 | 地图直接攻击、目击与逃离、个人/阵营自动追击、100 金赎偿解除追缉 |
| 地下副本 | 洞穴与巢穴、固定三层、普通怪/精英/Boss、锁定阶梯、宝箱、撤退、次日重置 |
| 装备与物品 | 20 个互斥装备位、四个独立戒指位、玩家/随从装备管理、固定常用栏和 4×5 收藏格 |
| 钓鱼 | 两格内抛竿、连续十杆、三档疲劳、三日恢复、流纹/闪光/深涡、四类鱼、金币与稀有装备 |
| 存档 | IndexedDB 活动存档、`localStorage` 降级、200ms 自动保存、V1→V2 迁移、FNV-1a 校验、JSON 导入导出、最近三份备份与损坏存档救援 |
| 美术与音频 | Verdant 生成素材包、Ember/Moonlit 备用图集、抠图与像素化工具链、CC0 探索/战斗配乐、程序化水岸音乐与分级出水音效 |
| 部署 | Vite 静态构建、GitHub Actions 测试与构建、GitHub Pages 自动发布 |

## 主要操作

- **移动**：`WASD`、方向键或方向按钮；双击可见目标启动自动寻路，任何手动操作都会取消。
- **查看**：点击人物、怪物、建筑、物品、道路、资源或地形，在左上角查看详情。
- **交谈与交易**：人物位于周围一格（含斜角）时出现气泡；点击人物进入对话和交易栏。
- **自动采集**：选择木材或石材资源点。角色自动走到相邻格，完成 3 斧或 5 锤后结算，并继续寻找最近、已探索、可到达的同类资源。无目标、遇敌、体力耗尽或手动操作时停止。
- **钓鱼**：选择曼哈顿距离 1–2 格的水面；空格收竿，再按空格开始下一杆。
- **地下探索**：站在洞穴或巢穴相邻格进入；击败守层精英后下楼，第三层击败 Boss 并开启宝箱。
- **营地**：消耗 8 木材和 5 石材建营；每成功移动 100 步获得一个建设额度。
- **日历与体力**：每移动 10 格推进一天；普通移动累计 100 步消耗 1 体力，战斗期间疲劳增长为 1.5 倍。
- **存档**：顶部“存档”面板可导出、预览导入和恢复备份。导入会先备份当前世界，不会合并两个世界。

更完整的数值和交互规则见 [`docs/game-design.md`](docs/game-design.md)。

## 代码结构

```text
src/
├── components/             React UI、Canvas 地图和交互面板
├── audio/                  钓鱼与水岸程序化音频
├── game/
│   ├── rng.ts              确定性随机与哈希工具
│   ├── world.ts            地形、资源、社会、入口与迷雾生成
│   ├── navigation.ts       四方向寻路与连续资源目标选择
│   ├── simulation.ts       reducer、回合、经济、场景旅行与交互规则
│   ├── dungeons.ts         三层副本、怪物和快照
│   ├── combat.ts           招式、伤害类型与战斗数值
│   ├── equipment.ts        全身装备位、兼容规则与属性汇总
│   ├── fishing.ts          钓位、钓讯、疲劳和掉落表
│   ├── camps.ts            建筑、营地属性与产出
│   ├── settlements.ts      居民、家庭、移民、成长与日历模拟
│   ├── persistence.ts      存档信封、校验、迁移与浏览器存储
│   └── types.ts            领域模型和动作类型
├── App.tsx                 游戏组合、自动路线和临时活动编排
└── styles.css              深色森林像素 UI 设计系统

e2e/                        Playwright 浏览器回归
scripts/                    素材抠图、切片、像素化与图集合成
art/prompts/                GPT Image 素材提示词
public/assets/art/           游戏实际读取的图集和场景素材
```

模拟层不依赖 React 或浏览器绘制代码，因此可以使用固定种子直接测试，也为未来迁移到 Web Worker 留出了边界。

## 存档开发

当前存档格式为 `SaveEnvelopeV2`，核心字段包括：

```text
format: "realmseed-save"
schemaVersion: 2
appVersion
savedAt
theme
state
integrity: fnv1a32
```

新增或修改持久化字段时：

1. 为旧数据提供安全默认值。
2. 如结构语义发生变化，增加 `Vn → Vn+1` 单步迁移。
3. 在 `persistence.test.ts` 验证迁移顺序、幂等性、失败原子性和未来版本拒绝。
4. 验证地图、迷雾、场景缓存、地下三层、居民、NPC 装备、钓位和当前活动恢复。
5. 不执行导入 JSON 中的字符串、HTML 或代码。

## 美术素材开发

素材提示词和规范：

- [`docs/art-direction.md`](docs/art-direction.md)：配色、像素格网与三种主题。
- [`art/prompts/camp-settlement-gpt-image-2.md`](art/prompts/camp-settlement-gpt-image-2.md)：营地建筑与场景。
- [`art/prompts/combat-effects-gpt-image-2.md`](art/prompts/combat-effects-gpt-image-2.md)：战斗特效帧。

常用处理命令：

```bash
python3 scripts/process_generated_asset.py --help
python3 scripts/pixelize_concept.py --help
python3 scripts/build_pixel_atlas.py
python3 scripts/ingest_generated_assets.py
python3 scripts/ingest_directional_assets.py
python3 scripts/ingest_facility_assets.py
```

生成素材应先保留原图，再经过背景移除、网格裁切、调色板压缩和 32×32 图集对齐。不要直接在 Canvas 中拉伸未经处理的概念图。

## GitHub Pages 部署

`.github/workflows/pages.yml` 会在每次推送 `main` 后执行：

1. `npm ci`
2. `npm test`
3. `npm run build`
4. 上传 `dist/`
5. 部署 GitHub Pages

仓库设置中的 Pages Source 应选择 **GitHub Actions**。CI 会自动把 Vite base 设置为 `/Realmseed/`。

## TODO

### P0：稳定性与开发体验

- [ ] 把 Playwright 浏览器回归加入 GitHub Actions，而不只在本地运行。
- [ ] 为 IndexedDB 不可用、容量不足、页面卸载和连续多版本迁移增加更多浏览器级故障注入。
- [ ] 分析 96×96 多场景缓存和 Canvas 重绘性能，确定 Web Worker 拆分边界。
- [ ] 完成移动端装备盘、存档面板、战斗栏和钓鱼栏的触控可用性审计。
- [ ] 补充键盘焦点、色彩对比、减少动态效果和屏幕阅读器说明。

### P1：核心玩法扩展

- [ ] 增加地下环境、Boss 家族、精英词条、Boss 阶段机制和专属掉落表。
- [ ] 增加木石加工、工具升级、制作配方、鱼竿与鱼饵，同时避免耐久度造成重复劳动。
- [ ] 为居民增加可见职业、生产队列、营地任务和玩家可控迁居。
- [ ] 加入阵营战争、领地争夺、营地防守、外交协定和动态贡金。
- [ ] 增加 NPC 对怪物、敌对阵营和营地威胁的自主反应。
- [ ] 扩充遗迹、随机事件、任务链、旅行商人与世界 Boss。

### P2：内容与扩展能力

- [ ] 设计可校验的 JSON 内容包，用于装备、怪物、建筑、事件和掉落表。
- [ ] 增加中文/英文语言包，移除散落在组件和规则中的硬编码文本。
- [ ] 为帽子、外套、披风、武器和坐骑研究可选的角色换装图层。
- [ ] 增加多个手动存档槽；云同步和账号系统保持为可选的外部适配器。
- [ ] 在不破坏确定性的前提下研究天气、昼夜和季节对采集、钓鱼与迁移的影响。

## 当前边界

- 游戏完全运行在浏览器中，没有账号、云同步或服务端防作弊。
- 普通居民存在于营地档案，不作为每个个体都在地图上移动的 NPC。
- 当前没有死亡、离婚、怀孕期、跨营地婚姻或居民手动迁徙。
- 装备影响数值与招式，尚未叠加绘制到地图角色精灵。
- 副本首版固定三层；营地建设、NPC 交易和阵营战争不会进入副本。

## 贡献与许可

欢迎通过 Issue 提交 Bug、平衡反馈、功能建议和可复现种子。Pull Request 请保持范围集中，并附上对应测试或浏览器验收说明。

- 代码：MIT，见 [`LICENSE`](LICENSE)。
- 音乐与第三方素材：见 [`THIRD_PARTY.md`](THIRD_PARTY.md)。
