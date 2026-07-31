import { useState } from 'react'
import { randomSeed } from '../game/rng'
import type { MapSize } from '../game/types'

interface StartScreenProps {
  onStart: (seed: string, size: MapSize) => void
}

export function StartScreen({ onStart }: StartScreenProps) {
  const [seed, setSeed] = useState(randomSeed)
  const [size, setSize] = useState<MapSize>('large')

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
          在迷雾里找路，在路上认识人。你会建立村庄、收服随从，
          也可能成为某个阵营的盟友——或它未来的领主。
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
              <span>40 × 40 · 快速开局</span>
            </label>
            <label className={size === 'large' ? 'is-selected' : ''}>
              <input type="radio" name="size" value="large" checked={size === 'large'} onChange={() => setSize('large')} />
              <strong>大地图</strong>
              <span>96 × 96 · 漫长远征</span>
            </label>
          </fieldset>

          <button type="button" className="primary-button" onClick={() => onStart(seed.trim() || randomSeed(), size)}>
            展开这个世界 <span>→</span>
          </button>
        </div>
        <p className="title-note">同一种子生成同一片大陆 · 无账号 · 无服务器 · 本地运行</p>
      </section>
    </main>
  )
}
