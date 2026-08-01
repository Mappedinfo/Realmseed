import { useEffect, useRef, useState } from 'react'
import type { ArtTheme } from '../game/art'
import type { GameState } from '../game/types'
import { BrowserSaveStore, createSaveEnvelope, exportSaveFilename, exportSaveText, parseSaveText, savePreview, type SaveBackup, type SavedGame } from '../game/persistence'

export function SaveManager({ state, theme, onImport }: { state?: GameState; theme?: ArtTheme; onImport: (save: SavedGame) => void }) {
  const [open, setOpen] = useState(false)
  const [candidate, setCandidate] = useState<SavedGame | null>(null)
  const [backups, setBackups] = useState<SaveBackup[]>([])
  const [message, setMessage] = useState('自动存档已启用')
  const inputRef = useRef<HTMLInputElement>(null)
  const storeRef = useRef<BrowserSaveStore | null>(null)
  if (!storeRef.current) storeRef.current = new BrowserSaveStore(window.localStorage)

  useEffect(() => { if (open) void storeRef.current!.backups().then(setBackups) }, [open])
  const current = state && theme ? createSaveEnvelope(state, theme) : undefined
  const download = () => {
    if (!state || !theme) return
    const blob = new Blob([exportSaveText(state, theme)], { type: 'application/json' })
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = exportSaveFilename(state); link.click()
    URL.revokeObjectURL(link.href); setMessage('存档文件已导出')
  }
  const choose = async (file?: File) => {
    if (!file) return
    try { setCandidate(parseSaveText(await file.text())); setMessage('存档通过校验，请确认世界信息') }
    catch (error) { setCandidate(null); setMessage(error instanceof Error ? error.message : '存档无法读取') }
  }
  const apply = async (save: SavedGame, reason: 'import' | 'restore') => {
    try {
      if (reason === 'restore' && current) await storeRef.current!.backup(current, 'restore')
      await storeRef.current!.import(save, reason === 'import' ? current : undefined)
      onImport(save); setOpen(false); setCandidate(null)
    } catch { setMessage('写入失败，当前进度没有被替换。') }
  }
  const preview = candidate ? savePreview(candidate) : null
  return <>
    <button className="save-manager-trigger" onClick={() => setOpen(true)}>{state ? '存档' : '导入 / 恢复'}</button>
    {open ? <div className="save-manager-scrim" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setOpen(false)}>
      <section className="save-manager" role="dialog" aria-modal="true" aria-label="存档管理">
        <header><span><b>SAVE LEDGER</b><small>边境远征档案</small></span><button onClick={() => setOpen(false)} aria-label="关闭存档管理">×</button></header>
        <div className="save-actions">
          {state ? <button onClick={download}><b>⇩ 导出当前世界</b><small>可读 .realmseed.json</small></button> : null}
          <button onClick={() => inputRef.current?.click()}><b>⇧ 选择存档文件</b><small>校验后预览，不会立即覆盖</small></button>
          <input ref={inputRef} type="file" accept=".json,.realmseed.json,application/json" hidden onChange={(event) => void choose(event.target.files?.[0])} />
        </div>
        {preview ? <div className="save-preview">
          <h3>{preview.seed}</h3><p>第 {preview.day} 日 · {preview.mapSize === 'large' ? '大地图' : '小地图'} · V{preview.schemaVersion}</p>
          <dl><div><dt>营地</dt><dd>{preview.camps}</dd></div><div><dt>居民</dt><dd>{preview.residents}</dd></div><div><dt>装备</dt><dd>{preview.equipment}</dd></div></dl>
          <button className="save-confirm" onClick={() => void apply(candidate!, 'import')}>备份当前进度并导入</button>
        </div> : null}
        <div className="save-backups"><h3>最近自动备份</h3>{backups.length ? backups.map((backup) => <button key={backup.id} onClick={() => void apply(backup.save, 'restore')}><span>{backup.reason === 'migration' ? '版本迁移前' : backup.reason === 'import' ? '导入替换前' : '恢复操作前'}</span><small>{new Date(backup.createdAt).toLocaleString()}</small></button>) : <p>还没有备份记录。</p>}</div>
        <footer aria-live="polite">{message}</footer>
      </section>
    </div> : null}
  </>
}
