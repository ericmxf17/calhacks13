'use client'

import { useEffect, useRef, useState } from 'react'
import { validateBusiness, type BusinessInput } from '@/lib/business-input'
import { parsePartsFile } from '@/lib/parse-parts'

type Tab = 'company' | 'products' | 'suppliers'
const tabs: { id: Tab; label: string }[] = [
  { id: 'company', label: 'Company' },
  { id: 'products', label: 'Products' },
  { id: 'suppliers', label: 'Suppliers' },
]
type Draft = Omit<BusinessInput, 'products'> & { products: { name: string; price: number | ''; units: number | '' }[] }

/**
 * Edit the business details from inside the workspace, without going back through setup.
 * Saving checks the details the same way setup does, then updates the rooms.
 */
export default function BusinessSettings({ business, preview, redesignNote, onSave, onClose }: {
  business: BusinessInput
  /** True in the demo, where changes stay in this browser tab. */
  preview: boolean
  /** Shown under the save button, for example that a new description redesigns the building. */
  redesignNote?: string
  onSave: (business: BusinessInput) => Promise<void>
  onClose: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [tab, setTab] = useState<Tab>('company')
  const [draft, setDraft] = useState<Draft>(() => structuredClone(business))
  const [fileName, setFileName] = useState('')
  const [parsing, setParsing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const changed = JSON.stringify(draft) !== JSON.stringify(business)

  useEffect(() => {
    const element = dialog.current
    if (!element) return
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    if (!element.open) element.showModal()
    return () => {
      if (element.open) element.close()
      if (opener?.isConnected) opener.focus({ preventScroll: true })
    }
  }, [])

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft(d => ({ ...d, [key]: value }))
  const setProduct = (i: number, key: 'name' | 'price' | 'units', value: string) =>
    set('products', draft.products.map((p, j) => j !== i ? p : { ...p, [key]: key === 'name' ? value : value === '' ? '' : Number(value) }))

  async function upload(file?: File) {
    if (!file) return
    setError('')
    setParsing(true)
    try {
      const parts = await parsePartsFile(file)
      setDraft(d => ({ ...d, demo: false, parts }))
      setFileName(file.name)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read this spreadsheet.')
    } finally {
      setParsing(false)
    }
  }

  async function save() {
    setError('')
    let valid: BusinessInput
    try {
      valid = validateBusiness(draft)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Please check your business details.')
      return
    }
    setSaving(true)
    try {
      await onSave(valid)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Your changes could not be saved. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const suppliers = new Set(draft.parts.map(p => p.supplier)).size
  return <dialog ref={dialog} className="settings-dialog" aria-labelledby="settings-title"
    onCancel={event => { event.preventDefault(); event.stopPropagation(); onClose() }}
    onClick={event => {
      if (event.target !== event.currentTarget) return
      const bounds = event.currentTarget.getBoundingClientRect()
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose()
    }}>
    <header className="settings-header">
      <div><h2 id="settings-title">Business settings</h2><p>{preview ? 'Changes stay in this preview.' : 'Changes are saved to your workspace.'}</p></div>
      <button type="button" className="settings-close" aria-label="Close business settings" onClick={onClose}>×</button>
    </header>
    <nav className="settings-tabs" role="tablist" aria-label="Settings sections">
      {tabs.map(t => <button key={t.id} type="button" role="tab" id={`settings-tab-${t.id}`} aria-selected={tab === t.id} aria-controls={`settings-panel-${t.id}`} onClick={() => setTab(t.id)}>{t.label}</button>)}
    </nav>
    <div className="settings-body" role="tabpanel" id={`settings-panel-${tab}`} aria-labelledby={`settings-tab-${tab}`}>
      {tab === 'company' && <div className="settings-fields">
        <label>Company name<input required maxLength={120} value={draft.company} onChange={e => set('company', e.target.value)}/></label>
        <label>Company website<input required maxLength={300} value={draft.website} onChange={e => set('website', e.target.value)}/></label>
        <label>What do you sell?<textarea required maxLength={500} rows={3} value={draft.offering} onChange={e => set('offering', e.target.value)}/></label>
        <label>Where do you sell?<textarea required maxLength={500} rows={3} value={draft.channels} onChange={e => set('channels', e.target.value)}/></label>
      </div>}
      {tab === 'products' && <div className="settings-products">
        <p className="settings-hint">A rough annual estimate is fine. Prices are in USD.</p>
        <div className="settings-product-head" aria-hidden="true"><span>Product</span><span>Price per unit</span><span>Annual units</span><span/></div>
        {draft.products.map((p, i) => <fieldset key={i} className="settings-product">
          <legend className="sr-only">Product {i + 1}</legend>
          <label><span className="sr-only">Product name</span><input required maxLength={120} value={p.name} placeholder="Product name" onChange={e => setProduct(i, 'name', e.target.value)}/></label>
          <label><span className="sr-only">Price per unit in dollars</span><input type="number" min={0} step="0.01" required value={p.price} onChange={e => setProduct(i, 'price', e.target.value)}/></label>
          <label><span className="sr-only">Annual units sold</span><input type="number" min={0} step="1" required value={p.units} onChange={e => setProduct(i, 'units', e.target.value)}/></label>
          <button type="button" className="settings-remove" disabled={draft.products.length <= 1} aria-label={`Remove ${p.name || `product ${i + 1}`}`} onClick={() => set('products', draft.products.filter((_, j) => j !== i))}>×</button>
        </fieldset>)}
        <button type="button" className="settings-add" disabled={draft.products.length >= 50} onClick={() => set('products', [...draft.products, { name: '', price: 0, units: 0 }])}>+ Add a product</button>
      </div>}
      {tab === 'suppliers' && <div className="settings-suppliers">
        <p className="settings-status">{draft.demo ? 'Using demo supplier data.' : `${draft.parts.length} parts from ${suppliers} supplier${suppliers === 1 ? '' : 's'}${fileName ? ` · ${fileName}` : ''}.`}</p>
        <label className="settings-drop" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); void upload(e.dataTransfer.files[0]) }}>
          <strong>{parsing ? 'Reading your spreadsheet…' : 'Replace with a new spreadsheet'}</strong>
          <span>Drop a file here or click to browse · CSV or XLSX · columns supplier, part, cost</span>
          <input className="sr-only" type="file" accept=".csv,.xlsx" disabled={parsing} onChange={e => { void upload(e.target.files?.[0]); e.target.value = '' }}/>
        </label>
        {!draft.demo && draft.parts.length > 0 && <div className="settings-table" role="table" aria-label="Supplier parts">
          <div role="row" className="settings-table-head"><span role="columnheader">Supplier</span><span role="columnheader">Part</span><span role="columnheader">Cost</span></div>
          {draft.parts.slice(0, 50).map((p, i) => <div role="row" key={i}><span role="cell">{p.supplier}</span><span role="cell">{p.part}</span><span role="cell">${p.cost.toFixed(2)}</span></div>)}
          {draft.parts.length > 50 && <p className="settings-hint">Showing 50 of {draft.parts.length} parts.</p>}
        </div>}
        <button type="button" className="settings-demo" aria-pressed={draft.demo} onClick={() => { setDraft(d => ({ ...d, demo: true, parts: [] })); setFileName('') }}>
          Use demo data<span>Explore the rooms with illustrative supplier data.</span>
        </button>
      </div>}
    </div>
    <footer className="settings-footer">
      {error ? <p role="alert" className="settings-error">{error}</p> : <p className="settings-hint">{redesignNote ?? 'Your rooms update as soon as you save.'}</p>}
      <div>
        <button type="button" className="settings-secondary" onClick={onClose}>Cancel</button>
        <button type="button" className="settings-primary" disabled={!changed || saving || parsing} onClick={() => void save()}>{saving ? 'Saving…' : 'Save changes'}</button>
      </div>
    </footer>
  </dialog>
}
