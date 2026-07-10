/**
 * StafferSetupScreen — /staffer-setup
 *
 * 4-step profile setup for staffing agencies.
 *
 * Step 1 — Agency name (required) → stored in users.bio
 * Step 2 — Logo upload (optional) → stored in users.photo_url
 * Step 3 — Types of events they staff (multi-select tiles) → users.secondary_job_types
 * Step 4 — Billing card (simulated — no real charges)
 *
 * Completion marker: users.username is set at the end of Step 4 (slug from agency name).
 */
import { useState, useEffect, useRef } from 'react';
import { useLocation }                   from 'wouter';
import { ChevronLeft, Camera, AlertCircle, CreditCard, Lock, CheckCircle2 } from 'lucide-react';
import { supabase, uploadAvatar } from '@/lib/supabase';
import { useAuth }  from '@/contexts/AuthContext';
import { ImageCropper } from '@/components/ImageCropper';

// ── Design tokens ──────────────────────────────────────────────────────────────
const NAVY   = '#0A1628';
const BORDER = '#E5E7EB';
const TEXT   = '#111827';
const MUTED  = '#6B7280';
const GREEN  = '#10B981';
const RED    = '#EF4444';

const TOTAL = 4;

const EVENT_TYPES = [
  'Nightclub', 'Rooftop Event', 'Corporate Event', 'Private Party',
  'Wedding', 'Festival', 'Pool Party', 'Gala',
  'Concert', 'Pop-up', 'Sports Event', 'Brand Activation',
  'Birthday Party', 'Product Launch',
];

function slugify(s: string) {
  return s.trim().toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 30) || `agency_${Date.now().toString(36)}`;
}

const stepKey   = (uid: string) => `ss_step_${uid}`;
const storeStep = (uid: string, s: number) => localStorage.setItem(stepKey(uid), String(s));
const loadStep  = (uid: string) => parseInt(localStorage.getItem(stepKey(uid)) ?? '1', 10) || 1;

// ── Simulated card ─────────────────────────────────────────────────────────────
function SimulatedCardInput({ onConfirm, loading }: { onConfirm: (ref: string) => void; loading: boolean }) {
  const [num,  setNum]  = useState('');
  const [exp,  setExp]  = useState('');
  const [cvc,  setCvc]  = useState('');
  const [name, setName] = useState('');
  const [err,  setErr]  = useState<string | null>(null);

  function fmtNum(v: string) { const d = v.replace(/\D/g, '').slice(0, 16); return d.replace(/(.{4})/g, '$1 ').trim(); }
  function fmtExp(v: string) { const d = v.replace(/\D/g, '').slice(0, 4); return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d; }

  const digits  = num.replace(/\s/g, '');
  const isValid = digits.length === 16 && exp.length === 5 && cvc.length >= 3 && name.trim().length >= 2;

  function handleSubmit() {
    setErr(null);
    if (!isValid) { setErr('Please fill in all card fields correctly.'); return; }
    onConfirm(`sim_${Math.random().toString(36).slice(2, 10).toUpperCase()}`);
  }

  const iStyle = { border: `1px solid ${BORDER}`, color: TEXT, background: '#FFFFFF' };

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-[16px] p-5 flex flex-col gap-4" style={{ background: '#F9FAFB', border: `1px solid ${BORDER}` }}>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <CreditCard size={18} style={{ color: NAVY }} />
            <span className="text-[13px] font-semibold" style={{ color: TEXT }}>Card details</span>
          </div>
          <div className="flex items-center gap-1">
            <Lock size={12} style={{ color: GREEN }} />
            <span className="text-[11px] font-medium" style={{ color: GREEN }}>Simulated — no charge</span>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[12px] font-semibold ml-0.5" style={{ color: MUTED }}>Card number</label>
          <input type="text" inputMode="numeric" placeholder="4242 4242 4242 4242"
            value={num} onChange={e => setNum(fmtNum(e.target.value))}
            className="w-full rounded-[10px] px-4 h-[48px] outline-none text-[15px] font-medium tracking-wider transition-colors placeholder:text-[#C0C0C0]"
            style={iStyle} />
        </div>

        <div className="flex gap-3">
          <div className="flex flex-col gap-1.5 flex-1">
            <label className="text-[12px] font-semibold ml-0.5" style={{ color: MUTED }}>Expiry</label>
            <input type="text" inputMode="numeric" placeholder="MM/YY"
              value={exp} onChange={e => setExp(fmtExp(e.target.value))}
              className="w-full rounded-[10px] px-4 h-[48px] outline-none text-[15px] font-medium transition-colors placeholder:text-[#C0C0C0]"
              style={iStyle} />
          </div>
          <div className="flex flex-col gap-1.5 flex-1">
            <label className="text-[12px] font-semibold ml-0.5" style={{ color: MUTED }}>CVC</label>
            <input type="text" inputMode="numeric" placeholder="123"
              value={cvc} onChange={e => setCvc(e.target.value.replace(/\D/g, '').slice(0, 4))}
              className="w-full rounded-[10px] px-4 h-[48px] outline-none text-[15px] font-medium transition-colors placeholder:text-[#C0C0C0]"
              style={iStyle} />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[12px] font-semibold ml-0.5" style={{ color: MUTED }}>Name on card</label>
          <input type="text" placeholder="Full name"
            value={name} onChange={e => setName(e.target.value)}
            className="w-full rounded-[10px] px-4 h-[48px] outline-none text-[15px] font-medium transition-colors placeholder:text-[#C0C0C0]"
            style={iStyle} />
        </div>
      </div>

      {err && (
        <div className="flex items-start gap-2 rounded-[12px] px-4 py-3"
          style={{ background: '#FEF2F2', border: `1px solid #FECACA` }}>
          <AlertCircle size={15} style={{ color: RED, flexShrink: 0, marginTop: 1 }} />
          <p className="text-[13px]" style={{ color: RED }}>{err}</p>
        </div>
      )}

      <button onClick={handleSubmit} disabled={!isValid || loading}
        className="w-full text-white font-bold text-[16px] h-[52px] rounded-[12px] active:scale-[0.98] transition-transform disabled:opacity-30"
        style={{ background: NAVY }}>
        {loading ? 'Saving…' : 'Confirm Card'}
      </button>

      <p className="text-[11px] text-center" style={{ color: MUTED }}>
        This is a simulated flow. No real card data is stored or charged.
      </p>
    </div>
  );
}

// ── StepHeader ─────────────────────────────────────────────────────────────────
function StepHeader({ step, onBack }: { step: number; onBack: () => void }) {
  return (
    <>
      <div className="flex items-center px-5 pt-12 pb-4">
        {step > 1 ? (
          <button onClick={onBack}
            className="w-9 h-9 flex items-center justify-center rounded-full mr-3 active:scale-95 transition-transform"
            style={{ border: `1px solid ${BORDER}` }}>
            <ChevronLeft size={20} style={{ color: TEXT }} />
          </button>
        ) : (
          <div className="w-9 h-9 mr-3" />
        )}
        <span className="text-[13px] font-medium" style={{ color: MUTED }}>Step {step} of {TOTAL}</span>
      </div>
      <div className="mx-5 h-[3px] rounded-full mb-8" style={{ background: BORDER }}>
        <div className="h-full rounded-full transition-all duration-500"
          style={{ width: `${(step / TOTAL) * 100}%`, background: NAVY }} />
      </div>
    </>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export function StafferSetupScreen() {
  const [, navigate] = useLocation();
  const { user }     = useAuth();

  const [initialized, setInitialized] = useState(false);
  const [step,        setStep]        = useState(1);
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [cardDone,    setCardDone]    = useState(false);

  const [agencyName,  setAgencyName]  = useState('');
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoFile,    setLogoFile]    = useState<File | null>(null);
  const logoRef = useRef<HTMLInputElement>(null);
  const [eventTypes,  setEventTypes]  = useState<string[]>([]);
  const [cropSrc,     setCropSrc]     = useState<string | null>(null);

  // ── Load & resume ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) { navigate('/'); return; }
    supabase.from('users').select('username, bio, photo_url, secondary_job_types')
      .eq('id', user.id).maybeSingle()
      .then(({ data }) => {
        if (data?.username) { navigate('/home'); return; }
        if (data?.bio)      setAgencyName(data.bio);
        if (data?.photo_url) setLogoPreview(data.photo_url);
        if (Array.isArray(data?.secondary_job_types)) setEventTypes(data.secondary_job_types);

        let inferred = 1;
        if (data?.bio) inferred = Math.max(inferred, 2);
        if (data?.photo_url) inferred = Math.max(inferred, 3);
        // secondary_job_types is written (even as []) once step 3 is completed,
        // so presence — not length — signals the step is done.
        if (Array.isArray(data?.secondary_job_types)) inferred = Math.max(inferred, 4);

        const stored = loadStep(user.id);
        setStep(Math.max(inferred, stored));
        setInitialized(true);
      });
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function saveAndAdvance(patch: Record<string, unknown>, next: number) {
    if (!user) return;
    setSaving(true); setError(null);
    try {
      const { error: dbErr } = await supabase.from('users').update(patch).eq('id', user.id);
      if (dbErr) throw dbErr;
      storeStep(user.id, next);
      setStep(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function continueStep1() {
    if (!agencyName.trim()) return;
    await saveAndAdvance({ bio: agencyName.trim() }, 2);
  }

  async function continueStep2() {
    if (!user) return;
    setSaving(true); setError(null);
    try {
      let photoUrl = logoPreview;
      if (logoFile) {
        photoUrl = await uploadAvatar(user.id, logoFile); // throws with real message on failure
        setLogoPreview(photoUrl);
        setLogoFile(null);
      }
      const patch: Record<string, unknown> = {};
      if (photoUrl) patch.photo_url = photoUrl;
      if (Object.keys(patch).length) {
        const { error: dbErr } = await supabase.from('users').update(patch).eq('id', user.id);
        if (dbErr) throw dbErr;
      }
      storeStep(user.id, 3);
      setStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Logo upload failed.');
    } finally {
      setSaving(false);
    }
  }

  function handleCropDone(blob: Blob, previewUrl: string) {
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    const file = new File([blob], 'logo.jpg', { type: 'image/jpeg' });
    if (logoPreview?.startsWith('blob:')) URL.revokeObjectURL(logoPreview);
    setLogoFile(file);
    setLogoPreview(previewUrl);
    setCropSrc(null);
  }

  function cancelCrop() {
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
  }

  async function continueStep3() {
    await saveAndAdvance({ secondary_job_types: eventTypes }, 4);
  }

  async function handleCardConfirm(ref: string) {
    if (!user) return;
    setSaving(true); setError(null);
    try {
      const autoUsername = slugify(agencyName || user.email?.split('@')[0] || 'agency');
      const { error: usernameErr } = await supabase.from('users')
        .update({ username: autoUsername }).eq('id', user.id);
      if (usernameErr) throw usernameErr;
      // Try storing the simulated billing ref (column may not exist — non-fatal)
      const { error: billingErr } = await supabase.from('users')
        .update({ billing_ref: ref }).eq('id', user.id);
      if (billingErr && !/column .* does not exist/i.test(billingErr.message)) {
        console.warn('[StafferSetup] billing_ref save failed:', billingErr.message);
      }
      localStorage.removeItem(stepKey(user.id));
      setCardDone(true);
      setTimeout(() => navigate('/home'), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not complete setup.');
    } finally {
      setSaving(false);
    }
  }

  // ── Loading skeleton ──────────────────────────────────────────────────────────
  if (!initialized) {
    return (
      <div className="min-h-[100dvh] bg-white flex flex-col">
        <div className="flex items-center px-5 pt-12 pb-4 gap-3">
          <div className="w-9 h-9 rounded-full" style={{ background: BORDER }} />
          <div className="h-3 w-24 rounded-full" style={{ background: BORDER }} />
        </div>
        <div className="mx-5 h-[3px] rounded-full" style={{ background: BORDER }} />
        <div className="px-5 mt-10 flex flex-col gap-4">
          <div className="h-8 w-3/4 rounded-[8px]" style={{ background: BORDER }} />
          <div className="h-4 w-1/2 rounded-[8px]" style={{ background: BORDER }} />
          <div className="h-[56px] w-full rounded-[12px] mt-4" style={{ background: BORDER }} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white overflow-hidden">
      {/* Crop modal — fixed overlay */}
      {cropSrc && (
        <ImageCropper
          imageSrc={cropSrc}
          defaultAspect={1}
          onDone={handleCropDone}
          onCancel={cancelCrop}
        />
      )}

      <StepHeader step={step} onBack={() => { if (step > 1) { storeStep(user!.id, step - 1); setStep(s => s - 1); } }} />

      {error && (
        <div className="mx-5 mb-4 flex items-start gap-2 rounded-[12px] px-4 py-3"
          style={{ background: '#FEF2F2', border: `1px solid #FECACA` }}>
          <AlertCircle size={15} style={{ color: RED, flexShrink: 0, marginTop: 1 }} />
          <p className="text-[13px] leading-snug" style={{ color: RED }}>{error}</p>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-5 pb-4">

        {/* ── STEP 1 — Agency name ───────────────────────────────────────── */}
        {step === 1 && (
          <div className="flex flex-col">
            <h1 className="text-[26px] font-bold leading-tight mb-2" style={{ color: TEXT }}>What's your agency name?</h1>
            <p className="text-[14px] mb-8" style={{ color: MUTED }}>This is how clients will find and recognise your agency.</p>
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-semibold ml-0.5" style={{ color: MUTED }}>Agency name</label>
              <input autoFocus type="text" placeholder="e.g. Elite Event Staffing"
                value={agencyName}
                onChange={e => { setAgencyName(e.target.value); setError(null); }}
                onKeyDown={e => e.key === 'Enter' && continueStep1()}
                className="w-full rounded-[12px] px-4 h-[56px] outline-none text-[15px] font-medium placeholder:text-[#C0C0C0] transition-colors"
                style={{ border: `1px solid ${BORDER}`, color: TEXT }}
                maxLength={100}
                data-testid="input-agency-name"
              />
            </div>
          </div>
        )}

        {/* ── STEP 2 — Logo ──────────────────────────────────────────────── */}
        {step === 2 && (
          <div className="flex flex-col items-center">
            <h1 className="text-[26px] font-bold leading-tight mb-2 self-start" style={{ color: TEXT }}>Upload your logo</h1>
            <p className="text-[14px] mb-10 self-start" style={{ color: MUTED }}>Optional — appears on all your shift postings.</p>
            <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={e => {
              const f = e.target.files?.[0];
              if (f) { setCropSrc(URL.createObjectURL(f)); e.target.value = ''; }
            }} />
            <button onClick={() => logoRef.current?.click()}
              className="relative w-[140px] h-[140px] rounded-[20px] overflow-hidden active:scale-95 transition-transform"
              style={{ background: '#F9FAFB', border: `2px dashed ${BORDER}` }}>
              {logoPreview ? (
                <img src={logoPreview} alt="Logo preview" className="w-full h-full object-cover" />
              ) : (
                <div className="flex flex-col items-center justify-center w-full h-full gap-2">
                  <Camera size={28} style={{ color: MUTED }} />
                  <span className="text-[12px] font-medium" style={{ color: MUTED }}>Tap to upload</span>
                </div>
              )}
            </button>
            {logoPreview && (
              <button onClick={() => logoRef.current?.click()}
                className="mt-5 text-[14px] font-semibold" style={{ color: NAVY }}>
                Change logo
              </button>
            )}
          </div>
        )}

        {/* ── STEP 3 — Event types ───────────────────────────────────────── */}
        {step === 3 && (
          <div className="flex flex-col">
            <h1 className="text-[26px] font-bold leading-tight mb-2" style={{ color: TEXT }}>What events do you staff?</h1>
            <p className="text-[14px] mb-6" style={{ color: MUTED }}>Select all that apply.</p>
            <div className="grid grid-cols-2 gap-3">
              {EVENT_TYPES.map(type => {
                const sel = eventTypes.includes(type);
                return (
                  <button key={type}
                    onClick={() => setEventTypes(prev => sel ? prev.filter(t => t !== type) : [...prev, type])}
                    className="flex items-center justify-between px-4 py-[14px] rounded-[12px] text-left transition-all active:scale-[0.97]"
                    style={{ border: `${sel ? 2 : 1}px solid ${sel ? NAVY : BORDER}`, background: sel ? '#F0F4FF' : '#FFFFFF' }}>
                    <span className="text-[13px] font-semibold leading-snug pr-1" style={{ color: sel ? NAVY : TEXT }}>{type}</span>
                    {sel && (
                      <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: NAVY }}>
                        <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                          <path d="M1 4L3.8 7L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
            {eventTypes.length > 0 && (
              <p className="text-[12px] font-medium mt-4 text-center" style={{ color: NAVY }}>
                {eventTypes.length} type{eventTypes.length > 1 ? 's' : ''} selected
              </p>
            )}
          </div>
        )}

        {/* ── STEP 4 — Billing card ──────────────────────────────────────── */}
        {step === 4 && (
          <div className="flex flex-col">
            <h1 className="text-[26px] font-bold leading-tight mb-2" style={{ color: TEXT }}>Add a billing card</h1>
            <p className="text-[14px] mb-8" style={{ color: MUTED }}>
              Used to pay workers your agency places into shifts.
            </p>
            {cardDone ? (
              <div className="flex flex-col items-center justify-center py-12 gap-4">
                <CheckCircle2 size={52} style={{ color: GREEN }} />
                <p className="font-bold text-[18px]" style={{ color: TEXT }}>Card saved!</p>
                <p className="text-[14px]" style={{ color: MUTED }}>Taking you to the app…</p>
              </div>
            ) : (
              <SimulatedCardInput onConfirm={handleCardConfirm} loading={saving} />
            )}
          </div>
        )}
      </div>

      {/* Footer CTA (steps 1–3 only) */}
      {step < 4 && (
        <div className="px-5 pb-10 pt-4 flex flex-col gap-3">
          <button
            onClick={step === 1 ? continueStep1 : step === 2 ? continueStep2 : continueStep3}
            disabled={saving || (step === 1 && !agencyName.trim())}
            className="w-full text-white font-bold text-[16px] h-[52px] rounded-[12px] active:scale-[0.98] transition-transform disabled:opacity-30"
            style={{ background: NAVY }}
            data-testid="btn-staffer-continue"
          >
            {saving ? 'Saving…' : 'Continue'}
          </button>
          {step === 2 && (
            <button onClick={continueStep2} className="w-full text-center py-2 text-[14px] font-medium" style={{ color: MUTED }}>
              Skip — add logo later
            </button>
          )}
          {step === 3 && eventTypes.length === 0 && (
            <button onClick={continueStep3} className="w-full text-center py-2 text-[14px] font-medium" style={{ color: MUTED }}>
              Skip
            </button>
          )}
        </div>
      )}
    </div>
  );
}
