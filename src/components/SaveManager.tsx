import { useEffect, useRef, useState } from 'react'
import type { ArtTheme } from '../game/art'
import type { GameState } from '../game/types'
import { BrowserSaveStore, createSaveEnvelope, exportSaveFilename, exportSaveText, parseSaveTextDetailed, savePreview, type ParsedSave, type SaveBackup, type SaveProblem, type SavedGame } from '../game/persistence'

function downloadText(text: string, name: string) {
  const link = document.createElement('a')
  link.href = URL.createObjectURL(new Blob([text], { type: 'application/json' })); link.download = name; link.click()
  URL.revokeObjectURL(link.href)
}

export function SaveManager({ state, theme, onImport, saveStatus, problem, onDiscardProblem }: {
  state?: GameState; theme?: ArtTheme; onImport: (save: SavedGame) => void; saveStatus?: string
  problem?: SaveProblem; onDiscardProblem?: () => void
}) {
  const [open, setOpen] = useState(Boolean(problem))
  const [candidate, setCandidate] = useState<ParsedSave | null>(null)
  const [failedFile, setFailedFile] = useState<{ name: string; raw: string; problem: SaveProblem } | null>(problem ? { name: 'damaged-browser-save.realmseed.json', raw: problem.raw, problem } : null)
  const [backups, setBackups] = useState<SaveBackup[]>([])
  const [confirmBackup, setConfirmBackup] = useState<SaveBackup | null>(null)
  const [message, setMessage] = useState(saveStatus ?? (problem ? problem.message : '自动存档已启用'))
  const inputRef = useRef<HTMLInputElement>(null)
  const storeRef = useRef<BrowserSaveStore | null>(null)
  if (!storeRef.current) storeRef.current = new BrowserSaveStore(window.localStorage)

  useEffect(() => { if (open) void storeRef.current!.backups().then(setBackups) }, [open])
  useEffect(() => { if (saveStatus) setMessage(saveStatus) }, [saveStatus])
  const current = state && theme ? createSaveEnvelope(state, theme) : undefined
  const download = () => { if (state && theme) { downloadText(exportSaveText(state, theme), exportSaveFilename(state)); setMessage('存档文件已导出') } }
  const choose = async (file?: File) => {
    if (!file) return
    const raw = await file.text()
    try { setCandidate(parseSaveTextDetailed(raw)); setFailedFile(null); setMessage('存档通过校验，请确认世界信息') }
    catch (error) {
      const detail = error instanceof Error ? error.message : '存档无法读取'
      const issue: SaveProblem = { code: 'file-import', message: detail, detail: error instanceof Error && 'detail' in error ? String(error.detail) : detail, raw, source: 'file' }
      setCandidate(null); setFailedFile({ name: file.name, raw, problem: issue }); setMessage(detail)
    }
  }
  const apply = async (save: SavedGame, reason: 'import' | 'restore') => {
    try {
      await storeRef.current!.atomicReplace(save, current, reason)
      onImport(save); setOpen(false); setCandidate(null); setConfirmBackup(null)
    } catch (error) { setMessage(error instanceof Error ? error.message : '写入失败，当前进度没有被替换。') }
  }
  const preview = candidate ? savePreview(candidate.save, candidate.migrationPath) : null
  return <>
    <button className={`save-manager-trigger ${problem ? 'has-problem' : ''}`} onClick={() => setOpen(true)}>{problem ? '抢救存档' : state ? '存档' : '导入 / 恢复'}</button>
    {open ? <div className="save-manager-scrim" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !problem && setOpen(false)}>
      <section className="save-manager" role="dialog" aria-modal="true" aria-label="存档管理">
        <header><span><b>SAVE LEDGER</b><small>边境远征档案 · Schema V2</small></span>{!problem ? <button onClick={() => setOpen(false)} aria-label="关闭存档管理">×</button> : null}</header>
        <div className="save-status-line"><i className={message.includes('失败') || problem ? 'is-error' : ''} />{message}</div>
        <div className="save-actions">
          {state ? <button onClick={download}><b>⇩ 导出当前世界</b><small>从内存生成，不等待自动保存</small></button> : null}
          <button onClick={() => inputRef.current?.click()}><b>⇧ 选择存档文件</b><small>上限 32 MiB · 校验后预览</small></button>
          <input ref={inputRef} type="file" accept=".json,.realmseed.json,application/json" hidden onChange={(event) => void choose(event.target.files?.[0])} />
        </div>
        {preview ? <div className="save-preview">
          <h3>{preview.seed}</h3><p>第 {preview.day} 日 · {preview.mapSize === 'large' ? '大地图' : '小地图'} · 游戏 {preview.appVersion} · Schema V{preview.schemaVersion}</p>
          <dl><div><dt>营地</dt><dd>{preview.camps}</dd></div><div><dt>居民</dt><dd>{preview.residents}</dd></div><div><dt>装备</dt><dd>{preview.equipment}</dd></div></dl>
          <p>保存于 {new Date(preview.savedAt).toLocaleString()}</p>
          <p className="migration-path">{preview.migrationPath.length ? `迁移路径：${preview.migrationPath.join(' → ')}` : '当前版本，无需迁移'}</p>
          <button className="save-confirm" onClick={() => void apply(candidate!.save, 'import')}>备份当前进度并导入</button>
        </div> : null}
        {failedFile ? <div className="save-diagnostic"><b>无法载入：{failedFile.name}</b><p>{failedFile.problem.message}</p><details><summary>技术详情</summary><code>{failedFile.problem.code}: {failedFile.problem.detail}</code></details><button onClick={() => downloadText(failedFile.raw, `problem-${failedFile.name}`)}>下载问题存档原文</button>{problem && onDiscardProblem ? <button className="danger" onClick={onDiscardProblem}>放弃损坏的活动存档</button> : null}</div> : null}
        <div className="save-backups"><h3>最近自动备份 <small>{backups.length}/3</small></h3>{backups.length ? backups.map((backup) => <button key={backup.id} onClick={() => setConfirmBackup(backup)}><span>{backup.reason === 'migration' ? '版本迁移前' : backup.reason === 'import' ? '导入替换前' : '手动恢复前'}</span><small>{new Date(backup.createdAt).toLocaleString()}</small></button>) : <p>还没有备份记录。</p>}</div>
        {confirmBackup ? <div className="restore-confirm"><p>确认恢复 <b>{new Date(confirmBackup.createdAt).toLocaleString()}</b> 的备份？当前进度会先另存一份。</p><button onClick={() => void apply(confirmBackup.save, 'restore')}>确认恢复</button><button onClick={() => setConfirmBackup(null)}>取消</button></div> : null}
        <footer aria-live="polite">完全本地保存 · 不上传服务器 · {saveStatus ?? '存储状态正常'}</footer>
      </section>
    </div> : null}
  </>
}
