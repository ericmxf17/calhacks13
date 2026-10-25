'use client'

import { useEffect, useMemo, useState, type FormEvent, type InputHTMLAttributes } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { demoCompanies, type DemoCompany } from '@/lib/demo-companies'
import { validateBusiness, type BusinessInput } from '@/lib/business-input'
import { parsePartsFile } from '@/lib/parse-parts'
import BusinessSettings from './BusinessSettings'
import { Button } from '@/components/ui/button'
import { profileKey } from '@/lib/scene-profile'
import { starterDepartments } from '@/lib/starter-rooms'
import { useSceneDesign } from './business/useSceneDesign'
import { sampleBusiness, sampleFileName } from '@/lib/sample-business'

const Scene = dynamic(() => import('./business/App'), {
  ssr: false,
  loading: () => (
    <div className="grid h-dvh place-items-center bg-paper text-muted">Opening your world…</div>
  ),
})
const empty: BusinessInput = {
  company: '',
  website: '',
  offering: '',
  channels: '',
  demo: false,
  products: [{ name: '', price: 0, units: 0 }],
  parts: [],
}
const fieldClass =
  'w-full rounded-lg border border-line bg-white/40 px-4 py-3 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/10'
const primary =
  'flex w-full items-center justify-center gap-3 rounded-lg bg-ink px-5 py-4 text-sm text-paper transition hover:bg-accent disabled:cursor-wait disabled:opacity-50'

type WorkspaceView = 'account' | 'demo'
const demoBusiness: BusinessInput = {
  company: 'Consul Goods',
  website: 'https://consulgoods.example',
  offering: 'Everyday home goods and accessories',
  channels: 'Online and retail stores',
  demo: true,
  products: [{ name: 'Canvas tote', price: 48, units: 2400 }],
  parts: [],
}

function Field({ label, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="grid gap-2 text-xs font-medium text-ink">
      {label}
      <input className={fieldClass} {...props} />
    </label>
  )
}
async function request(body?: unknown) {
  const response = await fetch(
    '/api/workspace',
    body
      ? {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      : { cache: 'no-store' },
  )
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'Something went wrong. Please try again.')
  return data
}

type WorkspaceProps =
  | { initialView?: 'account'; preset?: never }
  | { initialView: 'demo'; preset?: DemoCompany }

export default function Workspace({ initialView = 'account', preset }: WorkspaceProps) {
  const [view, setView] = useState<WorkspaceView>(initialView)
  const [loading, setLoading] = useState(initialView === 'account')
  const [signedIn, setSignedIn] = useState(false)
  const [complete, setComplete] = useState(Boolean(preset))
  const [mode, setMode] = useState<'signup' | 'login'>('signup')
  const [step, setStep] = useState(0)
  const [business, setBusiness] = useState<BusinessInput>(() => structuredClone(preset?.business ?? (initialView === 'demo' ? demoBusiness : empty)))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [fileName, setFileName] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)
  // True once this visit finishes the setup steps, so the workspace tour starts for new owners only.
  const [firstVisit, setFirstVisit] = useState(false)
  const [parsing, setParsing] = useState(false)
  const hasWorkspaceAccess = signedIn || view === 'demo'
  // Demo companies use their saved design and prepared rooms until their details are edited.
  // Everyone else gets a building from Scene Designer (or a quick keyword design), with rooms filled from setup.
  const demoPreset = view === 'demo' ? preset : undefined
  const prepared = demoPreset && JSON.stringify(business) === JSON.stringify(demoPreset.business) ? demoPreset.departments : undefined
  const savedDesign = demoPreset && profileKey(business) === profileKey(demoPreset.business) ? demoPreset.scene : undefined
  const design = useSceneDesign(complete ? business : null, savedDesign)
  const scene = design.spec
  const rooms = useMemo(() => starterDepartments(scene, business, prepared), [scene, business, prepared])
  useEffect(() => {
    if (view === 'demo') return
    let active = true
    request()
      .then((data) => {
        if (!active) return
        setSignedIn(!!data.user)
        if (data.business?.company) {
          setBusiness(data.business)
          setComplete(true)
        }
      })
      .catch(() => {
        if (active) setError('We couldn’t connect to your workspace. Please try again.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [view])
  const update = (key: keyof BusinessInput, value: unknown) =>
    setBusiness((b) => ({ ...b, [key]: value }))
  function exitDemo() {
    setBusiness(empty)
    setStep(0)
    setComplete(false)
    setError('')
    setFileName('')
    setLoading(true)
    setView('account')
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (loading && view === 'account') return
    setError('')
    if (hasWorkspaceAccess && step < 2) {
      setStep(step + 1)
      return
    }
    if (view === 'demo') {
      try {
        setBusiness(validateBusiness(business))
        setComplete(true)
        setFirstVisit(true)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Please check your business details.')
      }
      return
    }
    setBusy(true)
    try {
      if (!signedIn) {
        const fields = new FormData(event.currentTarget)
        await request({
          action: mode,
          email: fields.get('email'),
          password: fields.get('password'),
        })
        const data = await request()
        setSignedIn(true)
        if (data.business?.company) {
          setBusiness(data.business)
          setComplete(true)
        }
      } else {
        await request({ action: 'setup', business })
        setComplete(true)
        setFirstVisit(true)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Please try again.')
    } finally {
      setBusy(false)
    }
  }
  async function upload(file?: File) {
    if (!file) return
    setError('')
    setParsing(true)
    try {
      const parts = await parsePartsFile(file)
      setBusiness((b) => ({ ...b, demo: false, parts }))
      setFileName(file.name)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read this spreadsheet.')
    } finally {
      setParsing(false)
    }
  }
  async function logout() {
    setBusy(true)
    setError('')
    try {
      await request({ action: 'logout' })
      setSignedIn(false)
      setComplete(false)
      setBusiness(empty)
      setStep(0)
      setFileName('')
      setMode('login')
    } catch {
      setError('Unable to sign out. Please try again.')
    } finally {
      setBusy(false)
    }
  }
  async function saveSettings(next: BusinessInput) {
    if (view !== 'demo') await request({ action: 'setup', business: next })
    setBusiness(next)
  }
  if (complete)
    return (
      <>
        <Scene
          business={business}
          firstVisit={firstVisit}
          company={business.company}
          scene={scene}
          departments={rooms}
          design={design}
          actions={
            <>
              <Button type="button" data-tour="settings" onClick={() => setSettingsOpen(true)}>
                Business settings
              </Button>
              <Button type="button" disabled={busy} onClick={view === 'demo' ? exitDemo : logout}>
                Sign out
              </Button>
            </>
          }
        />
        {settingsOpen && (
          <BusinessSettings
            business={business}
            preview={view === 'demo'}
            redesignNote="Your rooms update as soon as you save. New names or descriptions also ask Scene Designer to redesign your building."
            onSave={saveSettings}
            onClose={() => setSettingsOpen(false)}
          />
        )}
        {error && (
          <p
            role="alert"
            className="fixed bottom-20 left-6 z-50 rounded-lg bg-paper p-4 text-sm text-red-800"
          >
            {error}
          </p>
        )}
      </>
    )
  const titles = [
    'A little about your business.',
    'The things you bring to life.',
    'Connect the dots.',
  ]
  return (
    <main className="consul-onboarding min-h-dvh bg-paper text-ink">
      <header className="flex items-center justify-between px-6 py-7 md:px-12">
        <div className="brand-glass flex items-center gap-3">
          <span className="font-display text-4xl">c.</span>
          <div className="text-lg font-medium tracking-tight">
            consul
            <span className="block text-[7px] tracking-[0.25em]">THE BUSINESS, CONNECTED</span>
          </div>
        </div>
        <span className="hidden text-xs text-muted sm:block">
          {signedIn ? 'Your next chapter starts here.' : 'A new perspective on your business.'}
        </span>
      </header>
      <div className="mx-auto grid max-w-6xl gap-12 px-6 pb-16 pt-8 md:grid-cols-2 md:gap-24 md:px-12 md:pt-12">
        <aside className="relative flex flex-col justify-between">
          <div>
            <p className="mb-6 text-[9px] font-medium tracking-[0.25em] text-muted">
              WELCOME TO YOUR BUSINESS, REIMAGINED
            </p>
            <h1 className="max-w-md font-display text-4xl leading-tight sm:text-5xl md:text-6xl">
              Big picture.
              <br />
              <span className="text-accent">
                Little details.
                <br />
                All connected.
              </span>
            </h1>
            <p className="mt-6 max-w-xs text-sm leading-7 text-muted">
              A world built around your business. Tell us a little about it, and we’ll make you feel
              right at home.
            </p>
          </div>
          <div className="mt-10 hidden sm:block" aria-hidden="true">
            <div className="onboarding-building mx-auto w-56 border-8 border-line bg-stone-200 shadow-xl">
              <div className="border-b-4 border-paper px-5 pt-6">
                <div className="grid grid-cols-2 gap-7 pb-5">
                  {[0, 1, 2, 3].map((n) => (
                    <div key={n} className="h-14 border-4 border-paper bg-accent/60 shadow-inner" />
                  ))}
                </div>
              </div>
              <p className="border-b-4 border-paper py-2 text-center font-display text-sm tracking-[0.2em]">
                CONSUL
              </p>
              <div className="flex gap-3 p-4">
                {[0, 1, 2].map((n) => (
                  <div key={n} className="h-14 flex-1 border-4 border-ink/50 bg-accent/40" />
                ))}
              </div>
            </div>
            <p className="mt-7 text-center font-display text-lg text-muted">
              Every business has a story.
            </p>
          </div>
        </aside>
        <section
          className="self-center rounded-2xl border border-white/70 bg-white/30 p-6 shadow-sm md:p-9"
          aria-labelledby="setup-title"
        >
          {hasWorkspaceAccess && (
            <ol className="mb-9 flex items-center gap-2" aria-label="Setup progress">
              {['Your business', 'Your products', 'Your suppliers'].map((name, i) => (
                <li
                  key={name}
                  aria-current={step === i ? 'step' : undefined}
                  className={`flex flex-1 items-center gap-2 text-[10px] ${i <= step ? 'text-ink' : 'text-muted'}`}
                >
                  <span
                    className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border ${i <= step ? 'border-ink bg-ink text-paper' : 'border-line'}`}
                  >
                    {i < step ? '✓' : i + 1}
                  </span>
                  <span>{name}</span>
                </li>
              ))}
            </ol>
          )}
          <p className="mb-3 text-[9px] tracking-[0.2em] text-muted">
            {hasWorkspaceAccess ? `STEP 0${step + 1} OF 03 · ABOUT TWO MINUTES` : 'YOUR OWN LITTLE WORLD'}
          </p>
          <h2 id="setup-title" className="font-display text-3xl leading-tight">
            {hasWorkspaceAccess
              ? titles[step]
              : mode === 'signup'
                ? 'Make yourself at home.'
                : 'Welcome home.'}
          </h2>
          <p className="mb-7 mt-3 text-xs leading-6 text-muted">
            {!hasWorkspaceAccess
              ? 'One account. A whole new way to see your business.'
              : step === 0
                ? 'Start with the basics. We’ll take it from here.'
                : step === 1
                  ? 'Add your products. A rough annual estimate is just fine. Prices are in USD.'
                  : 'Bring your suppliers and parts together, or start exploring with demo data.'}
          </p>
        <form key={hasWorkspaceAccess ? `setup-${step}` : mode} onSubmit={submit} className="grid gap-5">
            {!hasWorkspaceAccess ? (
              <>
                <Field
                  label="Work email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="you@company.com"
                  maxLength={254}
                />
                <Field
                  label="Password"
                  name="password"
                  type="password"
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  required
                  minLength={8}
                  maxLength={128}
                  placeholder="At least 8 characters"
                />
              </>
            ) : step === 0 ? (
              <>
                <button
                  type="button"
                  aria-pressed={business.company === sampleBusiness.company && fileName === sampleFileName}
                  className={`rounded-lg border p-4 text-left text-sm ${business.company === sampleBusiness.company && fileName === sampleFileName ? 'border-accent bg-accent/10' : 'border-line'}`}
                  onClick={() => {
                    setBusiness(structuredClone(sampleBusiness))
                    setFileName(sampleFileName)
                    setError('')
                  }}
                >
                  Use sample data
                  <span className="mt-1 block text-xs text-muted">
                    No spreadsheets handy? Fill all three steps with VoltRide, a sample e-bike maker,
                    then click Continue to see how setup works.
                  </span>
                </button>
                <Field
                  label="Company name"
                  required
                  value={business.company}
                  maxLength={120}
                  placeholder="e.g. Maison Goods"
                  onChange={(e) => update('company', e.target.value)}
                />
                <Field
                  label="Company website"
                  required
                  value={business.website}
                  maxLength={300}
                  placeholder="yourcompany.com"
                  onChange={(e) => update('website', e.target.value)}
                />
                <Field
                  label="What do you sell?"
                  required
                  value={business.offering}
                  maxLength={500}
                  placeholder="e.g. Thoughtful homewares and everyday essentials"
                  onChange={(e) => update('offering', e.target.value)}
                />
                <Field
                  label="Where do you sell?"
                  required
                  value={business.channels}
                  maxLength={500}
                  placeholder="e.g. Online, retail stores, wholesale"
                  onChange={(e) => update('channels', e.target.value)}
                />
              </>
            ) : step === 1 ? (
              <>
                {business.products.map((p, i) => (
                  <fieldset key={i} className="grid gap-4 rounded-lg border border-line p-4">
                    <legend className="px-2 text-[10px] tracking-wider">
                      PRODUCT {String(i + 1).padStart(2, '0')}
                    </legend>
                    <Field
                      label="Product name"
                      required
                      maxLength={120}
                      value={p.name}
                      placeholder="e.g. Everyday linen tote"
                      onChange={(e) =>
                        update(
                          'products',
                          business.products.map((v, j) =>
                            j === i ? { ...v, name: e.target.value } : v,
                          ),
                        )
                      }
                    />
                    <div className="grid grid-cols-2 gap-3">
                      {(['price', 'units'] as const).map((key) => (
                        <Field
                          key={key}
                          label={key === 'price' ? 'Price per unit ($)' : 'Annual units sold'}
                          type="number"
                          required
                          min={0}
                          step={key === 'price' ? '0.01' : '1'}
                          value={p[key]}
                          onChange={(e) =>
                            update(
                              'products',
                              business.products.map((v, j) =>
                                j === i
                                  ? {
                                      ...v,
                                      [key]: e.target.value === '' ? '' : Number(e.target.value),
                                    }
                                  : v,
                              ),
                            )
                          }
                        />
                      ))}
                    </div>
                    {business.products.length > 1 && (
                      <button
                        type="button"
                        className="justify-self-end text-xs text-muted hover:text-ink"
                        onClick={() =>
                          update(
                            'products',
                            business.products.filter((_, j) => j !== i),
                          )
                        }
                      >
                        Remove product
                      </button>
                    )}
                  </fieldset>
                ))}
                <button
                  type="button"
                  disabled={business.products.length >= 50}
                  className="justify-self-start text-xs text-accent underline underline-offset-4"
                  onClick={() =>
                    update('products', [...business.products, { name: '', price: 0, units: 0 }])
                  }
                >
                  + Add another product
                </button>
              </>
            ) : (
              <>
                <label
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault()
                    void upload(e.dataTransfer.files[0])
                  }}
                  className={`grid cursor-pointer justify-items-center gap-3 rounded-xl border border-dashed p-8 text-center transition hover:bg-white/50 ${fileName && !business.demo ? 'border-accent' : 'border-line'}`}
                >
                  <svg
                    className="h-8 w-8 text-accent"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.2"
                    aria-hidden="true"
                  >
                    <path d="M12 16V3m-4 4 4-4 4 4M4 14v6h16v-6" />
                  </svg>
                  <span className="text-sm">
                    {parsing
                      ? 'Reading your spreadsheet…'
                      : !business.demo && (fileName || business.parts.length)
                        ? `${fileName || 'Saved spreadsheet'} · ${business.parts.length} parts`
                        : 'Drop your spreadsheet here'}
                  </span>
                  <span className="text-xs text-muted">
                    or click to browse · CSV or XLSX · up to 2 MB
                  </span>
                  <input
                    className="sr-only"
                    type="file"
                    accept=".csv,.xlsx"
                    disabled={parsing}
                    onChange={(e) => {
                      void upload(e.target.files?.[0])
                      e.target.value = ''
                    }}
                  />
                </label>
                <p className="text-xs leading-6 text-muted">
                  Use columns <strong className="font-medium text-ink">supplier, part, cost</strong>{' '}
                  (USD). {view === 'demo' ? 'Your rows stay in this preview only.' : 'Your rows are saved privately to your workspace.'}
                </p>
                {!business.demo && business.parts.length > 0 && (
                  <div className="overflow-hidden rounded-lg border border-line text-xs">
                    <div className="grid grid-cols-3 bg-white/40 p-2 font-medium">
                      <span>Supplier</span>
                      <span>Part</span>
                      <span>Cost</span>
                    </div>
                    {business.parts.slice(0, 3).map((p, i) => (
                      <div
                        key={i}
                        className="grid grid-cols-3 gap-2 border-t border-line p-2 text-muted"
                      >
                        <span className="truncate">{p.supplier}</span>
                        <span className="truncate">{p.part}</span>
                        <span>${p.cost.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  aria-pressed={business.demo}
                  className={`rounded-lg border p-4 text-left text-sm ${business.demo ? 'border-accent bg-accent/10' : 'border-line'}`}
                  onClick={() => {
                    setBusiness((b) => ({ ...b, demo: true, parts: [] }))
                    setFileName('')
                    setError('')
                  }}
                >
                  Use demo data
                  <span className="mt-1 block text-xs text-muted">
                    Explore the rooms with illustrative business data.
                  </span>
                </button>
              </>
            )}
            {error && (
              <p role="alert" className="text-xs leading-6 text-red-800">
                {error}
              </p>
            )}
            <button
              className={primary}
              disabled={
                busy ||
                (loading && view === 'account' && !signedIn) ||
                parsing ||
                (hasWorkspaceAccess && step === 2 && !business.demo && !business.parts.length)
              }
            >
              {busy || (loading && view === 'account' && !signedIn)
                ? 'Just a moment…'
                : !hasWorkspaceAccess
                  ? mode === 'signup'
                    ? 'Create your account'
                    : 'Sign in'
                  : step === 2
                    ? 'Step into your business'
                    : 'Continue'}
              <span aria-hidden="true">→</span>
            </button>
            {hasWorkspaceAccess && (
              <div className="setup-footer flex justify-between text-xs text-muted">
                {step > 0 ? (
                  <button
                    type="button"
                    onClick={() => {
                      setStep(step - 1)
                      setError('')
                    }}
                  >
                    ← Back
                  </button>
                ) : (
                  <button type="button" onClick={view === 'demo' ? exitDemo : logout}>
                    Sign out
                  </button>
                )}
                <span>{view === 'demo' ? 'Preview only · Changes aren’t saved' : 'Saved securely to your account'}</span>
              </div>
            )}
          </form>
          {!hasWorkspaceAccess && (
            <div className="demo-entry">
              <span>Just looking around?</span>
              <a href="/demo" className="demo-button">
                Explore demo <span aria-hidden="true">→</span>
              </a>
              <small>No account needed · Illustrative business data</small>
            </div>
          )}
          {!hasWorkspaceAccess && (
            <nav className="company-previews" aria-label="Sample company workspaces">
              <p>Or step into a sample company</p>
              {demoCompanies.map((profile) => (
                <Link className="company-preview" key={profile.id} href={`/demo/${profile.id}`}>
                  <strong>{profile.business.company}<span aria-hidden="true"> →</span></strong>
                  <span>{profile.industry}</span>
                  <small>{profile.summary}</small>
                </Link>
              ))}
            </nav>
          )}
          {!hasWorkspaceAccess && (
            <p className="mt-6 text-center text-xs text-muted">
              {mode === 'signup' ? 'Already have a home here?' : 'New to Consul?'}{' '}
              <button
                className="font-medium text-ink underline underline-offset-4"
                onClick={() => {
                  setMode(mode === 'signup' ? 'login' : 'signup')
                  setError('')
                }}
              >
                {mode === 'signup' ? 'Sign in' : 'Create an account'}
              </button>
            </p>
          )}
        </section>
      </div>
      <footer className="px-6 pb-6 text-center text-[9px] tracking-wider text-muted">
        A LITTLE CLOSER TO EVERYTHING.
      </footer>
    </main>
  )
}
