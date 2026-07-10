/**
 * WorkerSetupScreen — /worker-setup
 *
 * 8-step profile setup for workers. Each step saves to Supabase on "Continue"
 * so a refresh correctly resumes from where the user left off.
 *
 * Step 1 — @username (unique, validated)
 * Step 2 — Profile photo (required, uploads to `avatars` bucket)
 * Step 3 — Bio (optional)
 * Step 4 — Primary job type (pick exactly 1 of 14)
 * Step 5 — Secondary job types (pick up to 2 more)
 * Step 6 — Certifications (optional tags)
 * Step 7 — Weekly availability Mon–Sun
 * Step 8 — First post (optional photo + caption, saves to `posts` table if provided)
 */
import { useState, useEffect, useRef } from 'react';
import { useLocation }                  from 'wouter';
import { ChevronLeft, Camera, Plus, X, Check, AlertCircle, CheckCircle2 } from 'lucide-react';
import { supabase, uploadAvatar, uploadPostPhoto } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { JOB_TYPES } from '@/lib/jobTypes';
import { ImageCropper } from '@/components/ImageCropper';

// ── Design tokens ──────────────────────────────────────────────────────────────
const NAVY   = '#0A1628';
const BORDER = '#E5E7EB';
const TEXT   = '#111827';
const MUTED  = '#6B7280';
const GREEN  = '#10B981';
const RED    = '#EF4444';

// ── Constants ──────────────────────────────────────────────────────────────────
const TOTAL_STEPS = 8;

const DAYS: { key: string; label: string }[] = [
  { key: 'mon', label: 'Mon' },
  { key: 'tue', label: 'Tue' },
  { key: 'wed', label: 'Wed' },
  { key: 'thu', label: 'Thu' },
  { key: 'fri', label: 'Fri' },
  { key: 'sat', label: 'Sat' },
  { key: 'sun', label: 'Sun' },
];

type UsernameStatus = 'idle' | 'checking' | 'valid' | 'taken' | 'invalid';
type Availability   = Record<string, boolean>;

// ── Local-storage step key (per user) ─────────────────────────────────────────
const stepKey  = (uid: string) => `ws_step_${uid}`;
const storeStep = (uid: string, s: number) => localStorage.setItem(stepKey(uid), String(s));
const loadStep  = (uid: string) => parseInt(localStorage.getItem(stepKey(uid)) ?? '1', 10) || 1;

// ── Shared UI primitives ──────────────────────────────────────────────────────
const INPUT = `w-full border rounded-[12px] px-4 outline-none font-medium text-[15px] transition-colors`;

function StepHeader({
  step, onBack,
}: { step: number; onBack: () => void }) {
  return (
    <>
      <div className="flex items-center px-5 pt-12 pb-4">
        {step > 1 ? (
          <button
            onClick={onBack}
            className="w-9 h-9 flex items-center justify-center rounded-full mr-3 transition-colors active:scale-95"
            style={{ border: `1px solid ${BORDER}` }}
          >
            <ChevronLeft size={20} style={{ color: TEXT }} />
          </button>
        ) : (
          <div className="w-9 h-9 mr-3" />
        )}
        <span className="text-[13px] font-medium" style={{ color: MUTED }}>
          Step {step} of {TOTAL_STEPS}
        </span>
      </div>
      <div className="mx-5 h-[3px] rounded-full mb-8 overflow-hidden" style={{ background: BORDER }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${(step / TOTAL_STEPS) * 100}%`, background: NAVY }}
        />
      </div>
    </>
  );
}

function ErrorBanner({ msg }: { msg: string }) {
  return (
    <div className="mx-5 mb-4 flex items-start gap-2 rounded-[12px] px-4 py-3"
      style={{ background: '#FEF2F2', border: `1px solid #FECACA` }}>
      <AlertCircle size={15} style={{ color: RED, flexShrink: 0, marginTop: 1 }} />
      <p className="text-[13px] leading-snug" style={{ color: RED }}>{msg}</p>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export function WorkerSetupScreen() {
  const [, navigate] = useLocation();
  const { user }     = useAuth();

  // Init
  const [initialized, setInitialized] = useState(false);
  const [step,        setStep]        = useState(1);
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  // Step 1 — username
  const [username,       setUsername]       = useState('');
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>('idle');
  const usernameTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Step 2 — photo
  const [photoFile,    setPhotoFile]    = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const photoRef = useRef<HTMLInputElement>(null);

  // Step 8 photo already declared below; crop state shared for both upload points
  const [cropSrc,    setCropSrc]    = useState<string | null>(null);
  const [cropTarget, setCropTarget] = useState<'photo' | 'post' | null>(null);

  // Step 3 — bio
  const [bio, setBio] = useState('');

  // Step 4 — primary job
  const [primaryJob, setPrimaryJob] = useState<string | null>(null);

  // Step 5 — secondary jobs
  const [secondaryJobs, setSecondaryJobs] = useState<string[]>([]);

  // Step 6 — certifications
  const [certInput, setCertInput] = useState('');
  const [certs,     setCerts]     = useState<string[]>([]);

  // Step 7 — availability
  const [availability, setAvailability] = useState<Availability>(
    Object.fromEntries(DAYS.map(d => [d.key, false])),
  );

  // Step 8 — first post
  const [postFile,    setPostFile]    = useState<File | null>(null);
  const [postPreview, setPostPreview] = useState<string | null>(null);
  const [postCaption, setPostCaption] = useState('');
  const postRef = useRef<HTMLInputElement>(null);

  // ── Load & resume ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) { navigate('/'); return; }
    supabase.from('users')
      .select('username, photo_url, bio, primary_job_type, secondary_job_types, certifications, availability')
      .eq('id', user.id)
      .maybeSingle()
      .then(async ({ data }) => {
        if (!data) { setInitialized(true); return; }

        // If setup is already complete (incl. step 8 first post), go home
        if (data.username && data.availability) {
          navigate('/home'); return;
        }

        // Pre-populate state from saved DB data
        if (data.username)           setUsername(data.username);
        if (data.photo_url)          setPhotoPreview(data.photo_url);
        if (data.bio)                setBio(data.bio);
        if (data.primary_job_type)   setPrimaryJob(data.primary_job_type);
        if (Array.isArray(data.secondary_job_types)) setSecondaryJobs(data.secondary_job_types);
        if (Array.isArray(data.certifications))      setCerts(data.certifications);
        if (data.availability && typeof data.availability === 'object') {
          setAvailability(data.availability as Availability);
        }

        // Infer resume step: take the highest step we can confirm from DB,
        // then also check localStorage in case this session progressed further
        let inferred = 1;
        if (data.username)             inferred = Math.max(inferred, 2);
        if (data.photo_url)            inferred = Math.max(inferred, 3);
        if (data.primary_job_type)     inferred = Math.max(inferred, 5);
        if (data.secondary_job_types != null) inferred = Math.max(inferred, 6);
        if (data.certifications != null)      inferred = Math.max(inferred, 7);
        if (data.availability)         inferred = Math.max(inferred, 8);

        const stored = loadStep(user.id);
        setStep(Math.max(inferred, stored));
        setInitialized(true);
      });
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Username debounce check ──────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    if (usernameTimer.current) clearTimeout(usernameTimer.current);

    const val = username.trim().toLowerCase();
    if (!val) { setUsernameStatus('idle'); return; }
    if (val.length < 2 || !/^[a-z0-9_.]+$/.test(val)) { setUsernameStatus('invalid'); return; }

    setUsernameStatus('checking');
    usernameTimer.current = setTimeout(async () => {
      const { data } = await supabase
        .from('users').select('id').eq('username', val).maybeSingle();
      // Allow if it's already this user's handle
      setUsernameStatus(data && data.id !== user.id ? 'taken' : 'valid');
    }, 600);

    return () => { if (usernameTimer.current) clearTimeout(usernameTimer.current); };
  }, [username, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Save helpers per step ────────────────────────────────────────────────────
  async function saveAndAdvance(nextStep: number, patch: Record<string, unknown>) {
    if (!user) return;
    setSaving(true); setError(null);
    try {
      const { error: dbErr } = await supabase.from('users').update(patch).eq('id', user.id);
      if (dbErr) throw dbErr;
      storeStep(user.id, nextStep);
      setStep(nextStep);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  // ── Per-step "Continue" handlers ─────────────────────────────────────────────
  async function continueStep1() {
    const val = username.trim().toLowerCase();
    if (usernameStatus !== 'valid') return;
    await saveAndAdvance(2, { username: val });
  }

  async function continueStep2() {
    if (!user) return;
    setSaving(true); setError(null);
    try {
      let photoUrl: string | null = photoPreview ?? null; // might already be a remote URL (resume)
      if (photoFile) {
        photoUrl = await uploadAvatar(user.id, photoFile); // throws with real message on failure
        setPhotoPreview(photoUrl);
        setPhotoFile(null);
      }
      // photo is optional — advance with whatever URL we have (may be null)
      await saveAndAdvance(3, { photo_url: photoUrl });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Photo upload failed.');
    } finally {
      setSaving(false);
    }
  }

  async function continueStep3() {
    await saveAndAdvance(4, { bio: bio.trim() || null });
  }

  async function continueStep4() {
    if (!primaryJob) return;
    await saveAndAdvance(5, { primary_job_type: primaryJob });
  }

  async function continueStep5() {
    await saveAndAdvance(6, { secondary_job_types: secondaryJobs });
  }

  async function continueStep6() {
    await saveAndAdvance(7, { certifications: certs });
  }

  async function continueStep7() {
    const hasAny = Object.values(availability).some(Boolean);
    if (!hasAny) { setError('Select at least one day of availability.'); return; }
    await saveAndAdvance(8, { availability });
  }

  async function continueStep8() {
    if (!user) return;
    setSaving(true); setError(null);
    try {
      let imageUrl: string | null = null;
      if (postFile) {
        imageUrl = await uploadPostPhoto(user.id, postFile); // throws with real message on failure
      }
      // Only insert a post when the user has provided at least some content
      if (imageUrl || postCaption.trim()) {
        const { error: postErr } = await supabase.from('posts').insert({
          user_id:   user.id,
          photo_url: imageUrl,
          caption:   postCaption.trim() || null,
        });
        if (postErr) {
          // Surface the real Supabase error (PostgrestError has .message, .code, .details)
          const detail = [postErr.message, postErr.details, postErr.code].filter(Boolean).join(' | ');
          console.error('[WorkerSetup Step 8] post insert failed:', postErr);
          throw new Error(detail || 'Could not save post.');
        }
      }
      localStorage.removeItem(stepKey(user.id));
      navigate('/home');
    } catch (err) {
      const msg = (err as { message?: string })?.message ?? 'Could not save post.';
      console.error('[WorkerSetup Step 8] error:', err);
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  function skipStep8() {
    if (!user) return;
    localStorage.removeItem(stepKey(user.id));
    navigate('/home');
  }

  function openCropper(file: File, target: 'photo' | 'post') {
    // Revoke any existing crop URL before creating a new one
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropTarget(target);
    setCropSrc(URL.createObjectURL(file));
  }

  function handleCropDone(blob: Blob, previewUrl: string) {
    // Revoke the source object URL now that we're done with the cropper
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    const file = new File([blob], 'photo.jpg', { type: 'image/jpeg' });
    if (cropTarget === 'photo') {
      if (photoPreview?.startsWith('blob:')) URL.revokeObjectURL(photoPreview);
      setPhotoFile(file);
      setPhotoPreview(previewUrl);
    } else if (cropTarget === 'post') {
      if (postPreview?.startsWith('blob:')) URL.revokeObjectURL(postPreview);
      setPostFile(file);
      setPostPreview(previewUrl);
    }
    setCropSrc(null);
    setCropTarget(null);
  }

  function cancelCrop() {
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
    setCropTarget(null);
  }

  function handleBack() {
    if (step > 1) {
      const prev = step - 1;
      storeStep(user!.id, prev);
      setStep(prev);
    }
  }

  // ── Loading skeleton ──────────────────────────────────────────────────────────
  if (!initialized) {
    return (
      <div className="min-h-[100dvh] bg-white flex flex-col">
        <div className="flex items-center px-5 pt-12 pb-4">
          <div className="w-9 h-9 rounded-full mr-3" style={{ background: BORDER }} />
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

  // ── Step content ──────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-white overflow-hidden">
      {/* Crop modal — fixed overlay, renders above everything */}
      {cropSrc && (
        <ImageCropper
          imageSrc={cropSrc}
          defaultAspect={cropTarget === 'post' ? 4 / 5 : 1}
          onDone={handleCropDone}
          onCancel={cancelCrop}
        />
      )}

      <StepHeader step={step} onBack={handleBack} />

      {error && <ErrorBanner msg={error} />}

      <div className="flex-1 overflow-y-auto px-5 pb-4">

        {/* ── STEP 1 — Username ─────────────────────────────────────────── */}
        {step === 1 && (
          <div className="flex flex-col">
            <h1 className="text-[26px] font-bold leading-tight mb-2" style={{ color: TEXT }}>
              What's your @handle?
            </h1>
            <p className="text-[14px] mb-8" style={{ color: MUTED }}>
              This is how clients and other workers find you on 365 Connect.
            </p>
            <div
              className="flex items-center rounded-[12px] px-4 h-[56px] transition-colors"
              style={{ border: `1px solid ${usernameStatus === 'invalid' || usernameStatus === 'taken' ? RED : usernameStatus === 'valid' ? GREEN : BORDER}` }}
            >
              <span className="font-semibold text-[18px] mr-1 select-none" style={{ color: TEXT }}>@</span>
              <input
                autoFocus
                type="text"
                placeholder="yourhandle"
                value={username}
                onChange={e => setUsername(e.target.value.replace(/[^a-zA-Z0-9_.]/g, '').toLowerCase())}
                className="flex-1 bg-transparent outline-none text-[16px] font-medium placeholder:text-[#C0C0C0]"
                style={{ color: TEXT }}
                maxLength={30}
                data-testid="input-username"
              />
              {usernameStatus === 'checking' && (
                <div className="w-4 h-4 rounded-full border-[2px] border-t-transparent animate-spin"
                  style={{ borderColor: `${MUTED} transparent ${MUTED} ${MUTED}` }} />
              )}
              {usernameStatus === 'valid' && <CheckCircle2 size={18} style={{ color: GREEN }} />}
              {(usernameStatus === 'taken' || usernameStatus === 'invalid') && (
                <AlertCircle size={18} style={{ color: RED }} />
              )}
            </div>
            {usernameStatus === 'taken'   && <p className="text-[12px] mt-2 ml-1" style={{ color: RED }}>That handle is already taken.</p>}
            {usernameStatus === 'invalid' && <p className="text-[12px] mt-2 ml-1" style={{ color: RED }}>Only letters, numbers, _ and . allowed.</p>}
            {usernameStatus === 'valid'   && <p className="text-[12px] mt-2 ml-1" style={{ color: GREEN }}>@{username} is available!</p>}
          </div>
        )}

        {/* ── STEP 2 — Profile photo ────────────────────────────────────── */}
        {step === 2 && (
          <div className="flex flex-col items-center">
            <h1 className="text-[26px] font-bold leading-tight mb-2 self-start" style={{ color: TEXT }}>Add a profile photo</h1>
            <p className="text-[14px] mb-10 self-start" style={{ color: MUTED }}>
              Optional — clients will see this when reviewing your application.
            </p>
            <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={e => {
              const f = e.target.files?.[0];
              if (f) { openCropper(f, 'photo'); e.target.value = ''; }
            }} />
            <button
              onClick={() => photoRef.current?.click()}
              className="relative w-[160px] h-[160px] rounded-full overflow-hidden active:scale-95 transition-transform"
              style={{ background: '#F9FAFB', border: `2px dashed ${BORDER}` }}
            >
              {photoPreview ? (
                <img src={photoPreview} alt="Profile preview" className="w-full h-full object-cover" />
              ) : (
                <div className="flex flex-col items-center justify-center w-full h-full gap-2">
                  <Camera size={28} style={{ color: MUTED }} />
                  <span className="text-[12px] font-medium" style={{ color: MUTED }}>Tap to upload</span>
                </div>
              )}
            </button>
            {photoPreview && (
              <button onClick={() => photoRef.current?.click()}
                className="mt-5 text-[14px] font-semibold" style={{ color: NAVY }}>
                Change photo
              </button>
            )}
          </div>
        )}

        {/* ── STEP 3 — Bio ──────────────────────────────────────────────── */}
        {step === 3 && (
          <div className="flex flex-col">
            <h1 className="text-[26px] font-bold leading-tight mb-2" style={{ color: TEXT }}>Write a short bio</h1>
            <p className="text-[14px] mb-8" style={{ color: MUTED }}>
              Optional — tell clients what makes you great. Keep it concise.
            </p>
            <div className="relative rounded-[12px] overflow-hidden" style={{ border: `1px solid ${BORDER}` }}>
              <textarea
                autoFocus
                placeholder="e.g. High-energy bartender with 5+ years in upscale venues. TIPS certified. Known for fast service and great vibes."
                value={bio}
                onChange={e => setBio(e.target.value)}
                maxLength={160}
                rows={5}
                className="w-full bg-transparent outline-none text-[15px] leading-relaxed resize-none p-4 pb-8 placeholder:text-[#C0C0C0]"
                style={{ color: TEXT }}
              />
              <span className="absolute bottom-3 right-4 text-[11px]" style={{ color: MUTED }}>{bio.length}/160</span>
            </div>
          </div>
        )}

        {/* ── STEP 4 — Primary job type ─────────────────────────────────── */}
        {step === 4 && (
          <div className="flex flex-col">
            <h1 className="text-[26px] font-bold leading-tight mb-2" style={{ color: TEXT }}>What's your main role?</h1>
            <p className="text-[14px] mb-6" style={{ color: MUTED }}>
              Pick the one you do most — this is your primary skill on 365 Connect.
            </p>
            <div className="grid grid-cols-2 gap-3">
              {JOB_TYPES.map(job => {
                const sel = primaryJob === job;
                return (
                  <button
                    key={job}
                    onClick={() => setPrimaryJob(job)}
                    className="flex items-center justify-between px-4 py-[14px] rounded-[12px] text-left transition-all active:scale-[0.97]"
                    style={{
                      border:     `${sel ? 2 : 1}px solid ${sel ? NAVY : BORDER}`,
                      background: sel ? '#F0F4FF' : '#FFFFFF',
                    }}
                  >
                    <span className="text-[13px] font-semibold leading-snug pr-2" style={{ color: sel ? NAVY : TEXT }}>
                      {job}
                    </span>
                    {sel && (
                      <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: NAVY }}>
                        <Check size={11} color="#fff" strokeWidth={3} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── STEP 5 — Secondary job types ─────────────────────────────── */}
        {step === 5 && (
          <div className="flex flex-col">
            <h1 className="text-[26px] font-bold leading-tight mb-2" style={{ color: TEXT }}>Any secondary skills?</h1>
            <p className="text-[14px] mb-6" style={{ color: MUTED }}>
              Optional — pick up to 2 more roles you can cover.
            </p>
            <div className="grid grid-cols-2 gap-3">
              {JOB_TYPES.filter(j => j !== primaryJob).map(job => {
                const sel = secondaryJobs.includes(job);
                const atMax = secondaryJobs.length >= 2 && !sel;
                return (
                  <button
                    key={job}
                    onClick={() => {
                      if (atMax) return;
                      setSecondaryJobs(prev => sel ? prev.filter(j => j !== job) : [...prev, job]);
                    }}
                    className="flex items-center justify-between px-4 py-[14px] rounded-[12px] text-left transition-all active:scale-[0.97]"
                    style={{
                      border:     `${sel ? 2 : 1}px solid ${sel ? NAVY : BORDER}`,
                      background: sel ? '#F0F4FF' : atMax ? '#FAFAFA' : '#FFFFFF',
                      opacity:    atMax ? 0.45 : 1,
                    }}
                  >
                    <span className="text-[13px] font-semibold leading-snug pr-2" style={{ color: sel ? NAVY : TEXT }}>{job}</span>
                    {sel && (
                      <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: NAVY }}>
                        <Check size={11} color="#fff" strokeWidth={3} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
            {secondaryJobs.length > 0 && (
              <p className="text-[12px] font-medium mt-4 text-center" style={{ color: NAVY }}>
                {secondaryJobs.length}/2 selected
              </p>
            )}
          </div>
        )}

        {/* ── STEP 6 — Certifications ───────────────────────────────────── */}
        {step === 6 && (
          <div className="flex flex-col">
            <h1 className="text-[26px] font-bold leading-tight mb-2" style={{ color: TEXT }}>Any certifications?</h1>
            <p className="text-[14px] mb-8" style={{ color: MUTED }}>
              Optional — add TIPS, ServSafe, CPR, Food Handler, or any others.
            </p>
            <div
              className="rounded-[12px] p-3 min-h-[56px]"
              style={{ border: `1px solid ${BORDER}` }}
            >
              <div className="flex flex-wrap gap-2">
                {certs.map(cert => (
                  <span
                    key={cert}
                    className="inline-flex items-center gap-1 px-3 py-[6px] rounded-full text-[13px] font-medium"
                    style={{ background: '#F0F4FF', border: `1px solid #C7D5F8`, color: NAVY }}
                  >
                    {cert}
                    <button onClick={() => setCerts(p => p.filter(c => c !== cert))} className="ml-1" style={{ color: MUTED }}>
                      <X size={12} />
                    </button>
                  </span>
                ))}
                <input
                  autoFocus
                  type="text"
                  placeholder={certs.length === 0 ? 'Type and press Enter to add…' : 'Add another…'}
                  value={certInput}
                  onChange={e => setCertInput(e.target.value)}
                  onKeyDown={e => {
                    if ((e.key === 'Enter' || e.key === ',') && certInput.trim()) {
                      e.preventDefault();
                      const t = certInput.trim().replace(/,$/, '');
                      if (t && !certs.includes(t)) setCerts(p => [...p, t]);
                      setCertInput('');
                    }
                    if (e.key === 'Backspace' && !certInput && certs.length) setCerts(p => p.slice(0, -1));
                  }}
                  className="flex-1 min-w-[140px] bg-transparent outline-none text-[14px] py-[6px] placeholder:text-[#C0C0C0]"
                  style={{ color: TEXT }}
                />
              </div>
            </div>
            <p className="text-[12px] mt-3 ml-1" style={{ color: MUTED }}>
              You can add or edit these later from your profile.
            </p>
          </div>
        )}

        {/* ── STEP 7 — Availability ─────────────────────────────────────── */}
        {step === 7 && (
          <div className="flex flex-col">
            <h1 className="text-[26px] font-bold leading-tight mb-2" style={{ color: TEXT }}>When are you available?</h1>
            <p className="text-[14px] mb-8" style={{ color: MUTED }}>
              Clients filter shifts by availability. Select every day you could work.
            </p>
            <div className="grid grid-cols-4 gap-3">
              {DAYS.map(({ key, label }) => {
                const on = availability[key] ?? false;
                return (
                  <button
                    key={key}
                    onClick={() => setAvailability(prev => ({ ...prev, [key]: !on }))}
                    className="flex flex-col items-center justify-center h-[64px] rounded-[12px] transition-all active:scale-95 font-semibold text-[14px]"
                    style={{
                      border:     `${on ? 2 : 1}px solid ${on ? NAVY : BORDER}`,
                      background: on ? NAVY : '#FFFFFF',
                      color:      on ? '#FFFFFF' : TEXT,
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── STEP 8 — First post ───────────────────────────────────────── */}
        {step === 8 && (
          <div className="flex flex-col">
            <h1 className="text-[26px] font-bold leading-tight mb-2" style={{ color: TEXT }}>Share your first moment</h1>
            <p className="text-[14px] mb-8" style={{ color: MUTED }}>
              Upload a photo from a past event to show clients your experience.
            </p>
            <input ref={postRef} type="file" accept="image/*" className="hidden" onChange={e => {
              const f = e.target.files?.[0];
              if (f) { openCropper(f, 'post'); e.target.value = ''; }
            }} />
            <button
              onClick={() => postRef.current?.click()}
              className="w-full aspect-[4/3] rounded-[12px] overflow-hidden flex items-center justify-center mb-5 active:scale-[0.98] transition-transform"
              style={{ background: '#F9FAFB', border: `1px dashed ${BORDER}` }}
            >
              {postPreview ? (
                <img src={postPreview} alt="Post preview" className="w-full h-full object-cover" />
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: BORDER }}>
                    <Plus size={24} style={{ color: MUTED }} />
                  </div>
                  <span className="text-[13px] font-medium" style={{ color: MUTED }}>Tap to upload photo</span>
                </div>
              )}
            </button>
            {postPreview && (
              <button onClick={() => postRef.current?.click()}
                className="text-[13px] font-semibold mb-5 text-center" style={{ color: NAVY }}>
                Change photo
              </button>
            )}
            <div className="relative rounded-[12px] overflow-hidden" style={{ border: `1px solid ${BORDER}` }}>
              <textarea
                placeholder="Describe what you were working — role, venue, event type…"
                value={postCaption}
                onChange={e => setPostCaption(e.target.value)}
                maxLength={300}
                rows={4}
                className="w-full bg-transparent outline-none text-[15px] leading-relaxed resize-none p-4 pb-8 placeholder:text-[#C0C0C0]"
                style={{ color: TEXT }}
              />
              <span className="absolute bottom-3 right-4 text-[11px]" style={{ color: MUTED }}>{postCaption.length}/300</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Footer CTA ───────────────────────────────────────────────────────── */}
      <div className="px-5 pb-10 pt-4 flex flex-col gap-3">
        <button
          onClick={
            step === 1 ? continueStep1 :
            step === 2 ? continueStep2 :
            step === 3 ? continueStep3 :
            step === 4 ? continueStep4 :
            step === 5 ? continueStep5 :
            step === 6 ? continueStep6 :
            step === 7 ? continueStep7 :
            continueStep8
          }
          disabled={
            saving ||
            (step === 1 && usernameStatus !== 'valid') ||
            (step === 4 && !primaryJob)
          }
          className="w-full text-white font-bold text-[16px] h-[52px] rounded-[12px] active:scale-[0.98] transition-transform disabled:opacity-30"
          style={{ background: NAVY }}
          data-testid="btn-setup-continue"
        >
          {saving ? 'Saving…' : step === TOTAL_STEPS ? 'Complete Profile' : 'Continue'}
        </button>

        {/* Optional-step skips */}
        {(step === 2 || step === 3 || step === 5 || step === 6 || step === 8) && !saving && (
          <button
            onClick={
              step === 2 ? continueStep2 :
              step === 3 ? () => continueStep3() :
              step === 5 ? continueStep5 :
              step === 6 ? continueStep6 :
              skipStep8
            }
            className="w-full text-center py-2 text-[14px] font-medium transition-colors"
            style={{ color: MUTED }}
          >
            {step === 2 ? 'Skip for now' :
             step === 3 ? 'Skip — add bio later' :
             step === 5 ? 'Skip — no secondary roles' :
             step === 6 ? 'Skip — add certifications later' :
             'Skip for now — add a post later'}
          </button>
        )}
      </div>
    </div>
  );
}
