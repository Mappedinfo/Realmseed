import { useState } from 'react'
import { artThemes, atlasPreviewUrl, type ArtTheme } from '../game/art'
import { randomSeed } from '../game/rng'
import type { MapSize } from '../game/types'

interface StartScreenProps {
  onStart: (seed: string, size: MapSize, theme: ArtTheme) => void
}

export function StartScreen({ onStart }: StartScreenProps) {
  const [seed, setSeed] = useState(randomSeed)
  const [size, setSize] = useState<MapSize>('large')
  const [theme, setTheme] = useState<ArtTheme>('verdant')

  return (
    <main className="title-screen">
      <div className="title-mist title-mist-a" />
      <div className="title-mist title-mist-b" />
      <section className="title-card">
        <p className="eyebrow">OPEN-SOURCE PIXEL FRONTIER</p>
        <div className="seed-mark" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
        </div>
        <h1>REALMSEED</h1>
        <p className="title-cn">一粒种子，一方世界</p>
        <p className="title-copy">
          在迷雾里找路，在路上认识人。每片区域都有四条交通线，
          世界会沿场景坐标持续展开；你可以建立村庄、收服随从，
          也可能成为某个阵营的属臣——或它未来的领主。
        </p>

        <div className="seed-form">
          <label htmlFor="world-seed">世界种子</label>
          <div className="seed-input-row">
            <input
              id="world-seed"
              value={seed}
              onChange={(event) => setSeed(event.target.value)}
              spellCheck={false}
            />
            <button type="button" className="icon-button" onClick={() => setSeed(randomSeed())} title="随机种子">
              ↻
            </button>
          </div>

          <fieldset className="size-picker">
            <legend>世界尺度</legend>
            <label className={size === 'small' ? 'is-selected' : ''}>
              <input type="radio" name="size" value="small" checked={size === 'small'} onChange={() => setSize('small')} />
              <strong>小地图</strong>
              <span>每场景 40 × 40 · 无限相邻场景</span>
            </label>
            <label className={size === 'large' ? 'is-selected' : ''}>
              <input type="radio" name="size" value="large" checked={size === 'large'} onChange={() => setSize('large')} />
              <strong>大地图</strong>
              <span>每场景 96 × 96 · 无限相邻场景</span>
            </label>
          </fieldset>

          <fieldset className="art-theme-picker">
            <legend>视觉风格</legend>
            {(Object.entries(artThemes) as [ArtTheme, (typeof artThemes)[ArtTheme]][]).map(([id, option]) => (
              <label className={theme === id ? 'is-selected' : ''} key={id}>
                <input type="radio" name="theme" value={id} checked={theme === id} onChange={() => setTheme(id)} />
                <img src={atlasPreviewUrl(id)} alt="" />
                <strong>{option.name}</strong>
                <span>{option.caption}</span>
              </label>
            ))}
          </fieldset>

          <button type="button" className="primary-button" onClick={() => onStart(seed.trim() || randomSeed(), size, theme)}>
            展开这个世界 <span>→</span>
          </button>
        </div>
        <p className="title-note">同一总种子 + 场景坐标生成同一区域 · 无账号 · 无服务器 · 本地运行</p>
      </section>
    </main>
  )
}
