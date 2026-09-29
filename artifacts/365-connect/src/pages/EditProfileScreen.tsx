/**
 * EditProfileScreen — /profile/edit
 *
 * One scrollable screen for every role, replacing the trip back through the
 * multi-step setup wizards. Sections are white cards; only the ones that
 * apply to the role are shown:
 *
 *   Photo          all roles   avatar (workers) / logo (posters)
 *   Basics         all roles   handle, bio (workers) or name (posters)
 *   Work           worker      primary role, other roles, hourly rate,
 *                              certifications, weekly availability
 *   Business       poster      company name, event types, location
 *   Notifications  all roles   link to the notification settings
 *
 * Saving sends ONE PATCH /users/me with only the fields that changed. A
 * "handle taken" answer is shown under the handle and the other edits stay
 * in the form so they are not lost.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import {
  ChevronLeft, ChevronRight, Camera, Bell, Check, X, Plus, AlertCircle, CheckCircle2,
  MapPin, Crosshair, UserCircle2, Briefcase, Building2, User,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useProfile, useUpdateProfile, type ProfilePatch } from '@/hooks/useProfile';
import { profileQueryOptions } from '@/hooks/profileQuery';
import { apiClient, isApiStatus } from '@/lib/api';
import { uploadAvatar } from '@/lib/storage';
import { handleFormatError, isHandleTakenError } from '@/lib/username';
import { JOB_TYPES, EVENT_TYPES } from '@/lib/jobTypes';
import { ImageCropper } from '@/components/ImageCropper';
import { ConfirmSheet } from '@/components/ConfirmSheet';
import { LocationAutocomplete } from '@/components/WizardShared';
import { AvailabilityEditor, normalizeAvailability, type WeekAvailability } from '@/components/AvailabilityEditor';

// ── Form model ─────────────────────────────────────────────────────────────────
type Form = {
  username:      string;
  bio:           string;          // worker bio; poster display / agency name
  primaryJob:    string | null;
  secondaryJobs: string[];
  hourlyRate:    string;
  certs:         string[];
  availability:  WeekAvailability;
  isAvailable:   boolean;
  companyName:   string;
  eventTypes:    string[];
  lat:           number | null;
  lng:           number | null;
};

const BIO_MAX = 300;
const MAX_SECONDARY = 2;

const sameList = (a: string[], b: string[]) => a.length === b.length && a.every((v, i) => v === b[i]);
const sameWeek = (a: WeekAvailability, b: WeekAvailability) => JSON.stringify(normalizeAvailability(a)) === JSON.stringify(normalizeAvailability(b));

/** Parse the hourly-rate text field: '' → null, otherwise a rounded number (NaN when invalid). */
function parseRate(text: string): number | null {
  if (text.trim() === '') return null;
  const n = Number(text);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : NaN;
}

// ── Small UI pieces ────────────────────────────────────────────────────────────
function Card({ id, icon: Icon, title, hint, children }: {
  id: string; icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string; hint?: string; children: React.ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`}
      className="bg-white border border-[#E5E7EB] rounded-[12px] px-4 py-4 scroll-mt-[76px]">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-[8px] bg-[#F5F5F5] border border-[#E5E7EB] flex items-center justify-center flex-shrink-0">
          <Icon size={14} aria-hidden className="text-[#0A1628]" />
        </div>
        <h2 id={`${id}-title`} className="text-[#111827] font-bold text-[15px]">{title}</h2>
      </div>
      {hint && <p className="text-[#6B7280] text-[12px] -mt-1.5 mb-3">{hint}</p>}
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}

function Field({ label, htmlFor, error, hint, children }: {
  label: string; htmlFor: string; error?: string | null; hint?: string; children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-[#374151] text-[13px] font-semibold">{label}</label>
      {children}
      {error
        ? <p id={`${htmlFor}-error`} role="alert" className="text-[#EF4444] text-[12px] leading-snug">{error}</p>
        : hint ? <p className="text-[#6B7280] text-[12px] leading-snug">{hint}</p> : null}
    </div>
  );
}

const INPUT = 'w-full h-[44px] rounded-[10px] border bg-white px-3 text-[14px] text-[#111827] font-medium placeholder:text-[#9CA3AF] outline-none transition-colors focus:border-[#0A1628]';
const inputBorder = (error?: string | null) => (error ? 'border-[#EF4444]' : 'border-[#E5E7EB]');

function Chip({ selected, onClick, children, disabled = false, testId }: {
  selected: boolean; onClick: () => void; children: React.ReactNode; disabled?: boolean; testId?: string;
}) {
  return (
    <button type="button" aria-pressed={selected} onClick={onClick} disabled={disabled} data-testid={testId}
      className={`h-[38px] px-3.5 rounded-full border text-[13px] font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-40 ${
        selected ? 'bg-[#0A1628] border-[#0A1628] text-white' : 'bg-white border-[#DBDBDB] text-[#111827]'
      }`}>
      {selected && <Check size={12} aria-hidden strokeWidth={3} />}
      {children}
    </button>
  );
}

function EditSkeleton() {
  return (
    <div className="min-h-[100dvh] bg-[#F9FAFB]" aria-busy="true" aria-label="Loading">
      <div className="sticky top-0 bg-white border-b border-[#E5E7EB] px-4 pt-[calc(env(safe-area-inset-top)+12px)] pb-3 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-[#EFEFEF] animate-pulse" />
        <div className="w-32 h-5 rounded-full bg-[#EFEFEF] animate-pulse" />
      </div>
      <div className="px-4 pt-4 flex flex-col gap-4">
        {[120, 220, 260].map((h, i) => (
          <div key={i} className="bg-white border border-[#E5E7EB] rounded-[12px] p-4 animate-pulse" style={{ height: h }}>
            <div className="w-24 h-4 rounded-full bg-[#EFEFEF] mb-4" />
            <div className="w-full h-11 rounded-[10px] bg-[#F3F4F6] mb-3" />
            <div className="w-3/4 h-11 rounded-[10px] bg-[#F3F4F6]" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Screen ─────────────────────────────────────────────────────────────────────
export function EditProfileScreen() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { showToast } = useToast();
  const profile = useProfile();
  const { data: row } = useQuery(profileQueryOptions(user?.id));
  const update = useUpdateProfile();

  const role = profile.role;
  const isWorker = role === 'worker';
  const isPoster = role === 'client' || role === 'staffer';

  // Unauthenticated guard — same as ProfileScreen.
  useEffect(() => {
    if (!profile.isLoading && !profile.email) navigate('/');
  }, [profile.isLoading, profile.email]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Form state, seeded once from the loaded row ─────────────────────────────
  const [initial, setInitial] = useState<Form | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  useEffect(() => {
    if (initial || profile.isLoading || !row) return;
    const seeded: Form = {
      username:      row.username ?? '',
      bio:           row.bio ?? '',
      primaryJob:    row.primary_job_type ?? null,
      secondaryJobs: row.secondary_job_types ?? [],
      hourlyRate:    row.hourly_rate != null ? String(row.hourly_rate) : '',
      certs:         row.certifications ?? [],
      availability:  normalizeAvailability(row.availability),
      isAvailable:   row.is_available ?? true,
      companyName:   row.company_name ?? '',
      eventTypes:    row.secondary_job_types ?? [],
      lat:           row.lat ?? null,
      lng:           row.lng ?? null,
    };
    setInitial(seeded);
    setForm(seeded);
  }, [initial, profile.isLoading, row]);

  const set = <K extends keyof Form>(key: K, value: Form[K]) =>
    setForm((f) => (f ? { ...f, [key]: value } : f));

  // Deep link to a section (/profile/edit#work) once the form is on screen.
  useEffect(() => {
    if (!form) return;
    const id = window.location.hash.replace(/^#/, '');
    if (!id) return;
    const t = window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ block: 'start' }), 50);
    return () => window.clearTimeout(t);
  }, [!!form]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Photo (same cropper + upload path as the setup wizards) ─────────────────
  const photoRef = useRef<HTMLInputElement>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  function handleCropDone(blob: Blob, previewUrl: string) {
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    if (photoPreview?.startsWith('blob:')) URL.revokeObjectURL(photoPreview);
    setPhotoFile(new File([blob], 'photo.jpg', { type: 'image/jpeg' }));
    setPhotoPreview(previewUrl);
    setCropSrc(null);
  }
  function cancelCrop() {
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
  }

  // ── Handle: live format check + debounced availability lookup ───────────────
  const [handleTaken, setHandleTaken] = useState(false);
  const [handleChecking, setHandleChecking] = useState(false);
  const [serverHandleError, setServerHandleError] = useState<string | null>(null);
  const username = form?.username ?? '';
  const handleChanged = !!form && !!initial && username !== initial.username;
  const handleFormat = handleChanged ? handleFormatError(username) : null;

  useEffect(() => {
    setServerHandleError(null);
    setHandleTaken(false);
    if (!handleChanged || handleFormat || !user?.id) { setHandleChecking(false); return; }
    setHandleChecking(true);
    const t = window.setTimeout(async () => {
      try {
        const existing = await apiClient(user.id).get<{ id: string }>(`/users/by-username/${encodeURIComponent(username)}`);
        setHandleTaken(!!existing && existing.id !== user.id);
      } catch {
        setHandleTaken(false); // 404 → free
      } finally {
        setHandleChecking(false);
      }
    }, 500);
    return () => window.clearTimeout(t);
  }, [username, handleChanged, handleFormat, user?.id]);

  const handleError = serverHandleError ?? handleFormat ?? (handleTaken ? 'That handle is taken. Try another.' : null);

  // ── Certifications ──────────────────────────────────────────────────────────
  const [certInput, setCertInput] = useState('');
  function addCert() {
    const t = certInput.trim().replace(/,$/, '');
    if (!form || !t) return;
    if (!form.certs.includes(t)) set('certs', [...form.certs, t]);
    setCertInput('');
  }

  // ── Location (posters) ──────────────────────────────────────────────────────
  const [locationQuery, setLocationQuery] = useState('');
  const [locating, setLocating] = useState(false);
  function useCurrentLocation() {
    if (!navigator.geolocation) { showToast('Location is not available on this device.', 'error'); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => { set('lat', pos.coords.latitude); set('lng', pos.coords.longitude); setLocationQuery('Current location'); setLocating(false); },
      () => { showToast("Couldn't read your location.", 'error'); setLocating(false); },
      { timeout: 8000 },
    );
  }

  // ── What changed → the PATCH body ───────────────────────────────────────────
  const rate = parseRate(form?.hourlyRate ?? '');
  const rateError = Number.isNaN(rate) ? 'Enter a number, e.g. 25.' : null;
  const bioError = isPoster && form && !form.bio.trim() ? 'Please enter a name.' : null;

  const patch = useMemo<ProfilePatch>(() => {
    if (!form || !initial) return {};
    const p: ProfilePatch = {};
    if (form.username !== initial.username) p.username = form.username.trim().toLowerCase();
    if (form.bio !== initial.bio) p.bio = form.bio.trim() || null;
    if (isWorker) {
      const primaryChanged = form.primaryJob !== initial.primaryJob;
      const secondaryChanged = !sameList(form.secondaryJobs, initial.secondaryJobs);
      if (primaryChanged) p.primary_job_type = form.primaryJob;
      if (secondaryChanged) p.secondary_job_types = form.secondaryJobs;
      // Keep the legacy job_types column (read by rosters and worker lists) in step.
      if (primaryChanged || secondaryChanged) {
        p.job_types = [form.primaryJob, ...form.secondaryJobs].filter((j): j is string => !!j);
      }
      if (form.hourlyRate !== initial.hourlyRate && !Number.isNaN(rate)) p.hourly_rate = rate;
      if (!sameList(form.certs, initial.certs)) p.certifications = form.certs;
      if (!sameWeek(form.availability, initial.availability)) p.availability = form.availability;
      if (form.isAvailable !== initial.isAvailable) p.is_available = form.isAvailable;
    }
    if (isPoster) {
      if (role === 'staffer') {
        // The agency name is both the display name (bio) and the company name.
        if (form.bio !== initial.bio) p.company_name = form.bio.trim() || null;
      } else if (form.companyName !== initial.companyName) {
        p.company_name = form.companyName.trim() || null;
      }
      if (!sameList(form.eventTypes, initial.eventTypes)) p.secondary_job_types = form.eventTypes;
      if (form.lat !== initial.lat || form.lng !== initial.lng) { p.lat = form.lat; p.lng = form.lng; }
    }
    return p;
  }, [form, initial, isWorker, isPoster, role, rate]);

  const dirty = Object.keys(patch).length > 0 || !!photoFile;
  const blocked = !!handleError || handleChecking || !!rateError || !!bioError;
  const [saving, setSaving] = useState(false);
  const canSave = dirty && !blocked && !saving;

  async function save() {
    if (!canSave || !user?.id) return;
    setSaving(true);
    setServerHandleError(null);
    try {
      const body: ProfilePatch = { ...patch };
      if (photoFile) body.photo_url = await uploadAvatar(user.id, photoFile);
      await update.mutateAsync(body);
      setPhotoFile(null);
      showToast('Profile saved');
      navigate('/profile');
    } catch (err) {
      if (isApiStatus(err, 409) || isHandleTakenError(err)) {
        // Only the handle was refused: say so under the field, keep every other edit.
        setServerHandleError(err instanceof Error ? err.message : 'That handle is taken. Try another.');
        document.getElementById('basics')?.scrollIntoView({ block: 'start' });
      } else {
        showToast(err instanceof Error ? err.message : "Couldn't save your profile. Try again.", 'error');
      }
    } finally {
      setSaving(false);
    }
  }

  // ── Back / discard ──────────────────────────────────────────────────────────
  const [discardOpen, setDiscardOpen] = useState(false);
  function goBack() {
    if (dirty) { setDiscardOpen(true); return; }
    navigate('/profile');
  }

  if (!profile.isLoading && !profile.email) return null;
  if (profile.isLoading || !form || !initial) return <EditSkeleton />;

  const currentPhoto = photoPreview ?? profile.photoUrl;
  const photoShape = isPoster ? 'rounded-[20px]' : 'rounded-full';
  const posterNameLabel = role === 'staffer' ? 'Agency name' : 'Your name';

  return (
    <div className="min-h-[100dvh] bg-[#F9FAFB] flex flex-col">
      {cropSrc && (
        <ImageCropper imageSrc={cropSrc} defaultAspect={1} onDone={handleCropDone} onCancel={cancelCrop} />
      )}

      {/* Header */}
      <header className="sticky top-0 z-20 bg-white border-b border-[#E5E7EB] px-4 pt-[calc(env(safe-area-inset-top)+12px)] pb-3 flex items-center gap-3">
        <button type="button" aria-label="Go back" onClick={goBack}
          className="w-10 h-10 rounded-full bg-[#FAFAFA] border border-[#DBDBDB] flex items-center justify-center flex-shrink-0">
          <ChevronLeft size={18} aria-hidden className="text-black" />
        </button>
        <h1 className="text-[#111827] font-bold text-[18px] leading-tight flex-1">Edit Profile</h1>
        {dirty && !saving && <span className="text-[#6B7280] text-[12px] font-medium">Unsaved</span>}
      </header>

      <main className="flex-1 px-4 pt-4 pb-[calc(env(safe-area-inset-bottom)+100px)] flex flex-col gap-4">

        {/* ── Photo ─────────────────────────────────────────────────────── */}
        <Card id="photo" icon={Camera} title={isPoster ? 'Logo' : 'Photo'}>
          <input ref={photoRef} type="file" accept="image/*" className="hidden" data-testid="input-photo"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) { if (cropSrc) URL.revokeObjectURL(cropSrc); setCropSrc(URL.createObjectURL(f)); }
              e.target.value = '';
            }} />
          <div className="flex items-center gap-4">
            <button type="button" onClick={() => photoRef.current?.click()} aria-label={isPoster ? 'Change logo' : 'Change photo'}
              className={`w-[88px] h-[88px] ${photoShape} overflow-hidden bg-[#F3F4F6] border border-[#E5E7EB] flex items-center justify-center flex-shrink-0`}>
              {currentPhoto
                ? <img src={currentPhoto} alt="" className="w-full h-full object-cover" />
                : <UserCircle2 size={40} aria-hidden className="text-[#9CA3AF]" />}
            </button>
            <div className="flex flex-col gap-1.5 min-w-0">
              <button type="button" onClick={() => photoRef.current?.click()}
                className="h-11 px-4 rounded-[10px] border border-[#DBDBDB] bg-white text-[#0A1628] text-[14px] font-semibold flex items-center gap-2 self-start">
                <Camera size={15} aria-hidden /> {isPoster ? 'Change logo' : 'Change photo'}
              </button>
              <p className="text-[#6B7280] text-[12px]">
                {photoFile ? 'New photo ready — tap Save to keep it.' : isPoster ? 'Shown on every shift you post.' : 'Clients see this when reviewing your application.'}
              </p>
            </div>
          </div>
        </Card>

        {/* ── Basics ────────────────────────────────────────────────────── */}
        <Card id="basics" icon={User} title="Basics">
          {isPoster && (
            <Field label={posterNameLabel} htmlFor="poster-name" error={bioError}
              hint={role === 'staffer' ? 'How clients and workers see your agency.' : 'Workers see this on your shift postings.'}>
              <input id="poster-name" type="text" value={form.bio} maxLength={100} data-testid="input-name"
                onChange={(e) => set('bio', e.target.value)}
                aria-invalid={!!bioError} aria-describedby={bioError ? 'poster-name-error' : undefined}
                className={`${INPUT} ${inputBorder(bioError)}`} placeholder={role === 'staffer' ? 'e.g. Elite Event Staffing' : 'Jane Smith'} />
            </Field>
          )}

          <Field label="Handle" htmlFor="handle" error={handleError}
            hint={handleChecking ? 'Checking…' : handleChanged && !handleError ? `@${username} is available` : 'Letters, numbers, _ and . only. This is how people find you.'}>
            <div className={`flex items-center h-[44px] rounded-[10px] border bg-white px-3 transition-colors focus-within:border-[#0A1628] ${inputBorder(handleError)}`}>
              <span className="text-[#6B7280] text-[15px] font-semibold mr-1 select-none">@</span>
              <input id="handle" type="text" value={form.username} maxLength={30} data-testid="input-handle"
                autoCapitalize="none" autoCorrect="off" spellCheck={false}
                onChange={(e) => set('username', e.target.value.replace(/[^a-zA-Z0-9_.]/g, '').toLowerCase())}
                aria-invalid={!!handleError} aria-describedby={handleError ? 'handle-error' : undefined}
                className="flex-1 min-w-0 bg-transparent outline-none text-[14px] text-[#111827] font-medium placeholder:text-[#9CA3AF]"
                placeholder="yourhandle" />
              {handleChanged && !handleChecking && !handleError && <CheckCircle2 size={16} aria-hidden className="text-[#10B981] flex-shrink-0" />}
              {handleError && <AlertCircle size={16} aria-hidden className="text-[#EF4444] flex-shrink-0" />}
            </div>
          </Field>

          {isWorker && (
            <Field label="Bio" htmlFor="bio">
              <div className={`relative rounded-[10px] border bg-white transition-colors focus-within:border-[#0A1628] ${inputBorder(null)}`}>
                <textarea id="bio" value={form.bio} maxLength={BIO_MAX} rows={4} data-testid="input-bio"
                  onChange={(e) => set('bio', e.target.value.slice(0, BIO_MAX))}
                  placeholder="Tell clients what makes you great. Keep it concise."
                  className="w-full bg-transparent outline-none text-[14px] text-[#111827] leading-relaxed resize-none px-3 pt-3 pb-7 placeholder:text-[#9CA3AF]" />
                <span className="absolute bottom-2 right-3 text-[11px] text-[#6B7280]" aria-live="polite">{form.bio.length}/{BIO_MAX}</span>
              </div>
            </Field>
          )}
        </Card>

        {/* ── Work (worker) ─────────────────────────────────────────────── */}
        {isWorker && (
          <Card id="work" icon={Briefcase} title="Work" hint="Shifts, offers and reminders are matched on the roles you can work.">
            <Field label="Primary role" htmlFor="primary-role" hint="The one you do most.">
              <div id="primary-role" role="radiogroup" aria-label="Primary role" className="flex flex-wrap gap-2">
                {JOB_TYPES.map((job) => (
                  <Chip key={job} selected={form.primaryJob === job} testId={`primary-${job}`}
                    onClick={() => {
                      set('primaryJob', job);
                      if (form.secondaryJobs.includes(job)) set('secondaryJobs', form.secondaryJobs.filter((j) => j !== job));
                    }}>
                    {job}
                  </Chip>
                ))}
              </div>
            </Field>

            <Field label="Other roles" htmlFor="other-roles" hint={`Up to ${MAX_SECONDARY} more you can cover. ${form.secondaryJobs.length}/${MAX_SECONDARY} selected.`}>
              <div id="other-roles" role="group" aria-label="Other roles" className="flex flex-wrap gap-2">
                {JOB_TYPES.filter((j) => j !== form.primaryJob).map((job) => {
                  const sel = form.secondaryJobs.includes(job);
                  const atMax = !sel && form.secondaryJobs.length >= MAX_SECONDARY;
                  return (
                    <Chip key={job} selected={sel} disabled={atMax} testId={`secondary-${job}`}
                      onClick={() => set('secondaryJobs', sel ? form.secondaryJobs.filter((j) => j !== job) : [...form.secondaryJobs, job])}>
                      {job}
                    </Chip>
                  );
                })}
              </div>
            </Field>

            <Field label="Hourly rate" htmlFor="hourly-rate" error={rateError} hint="What you'd like to earn per hour. Leave blank to skip.">
              <div className={`flex items-center h-[44px] rounded-[10px] border bg-white px-3 transition-colors focus-within:border-[#0A1628] ${inputBorder(rateError)}`}>
                <span className="text-[#111827] text-[15px] font-bold mr-1.5">$</span>
                <input id="hourly-rate" type="number" inputMode="decimal" min="0" step="1" value={form.hourlyRate} data-testid="input-rate"
                  onChange={(e) => set('hourlyRate', e.target.value)} placeholder="25"
                  aria-invalid={!!rateError} aria-describedby={rateError ? 'hourly-rate-error' : undefined}
                  className="flex-1 min-w-0 bg-transparent outline-none text-[14px] text-[#111827] font-medium placeholder:text-[#9CA3AF]" />
                <span className="text-[#6B7280] text-[13px] font-medium">/hr</span>
              </div>
            </Field>

            <Field label="Certifications" htmlFor="cert-input" hint="TIPS, ServSafe, CPR, Food Handler…">
              {form.certs.length > 0 && (
                <div className="flex flex-wrap gap-2" role="list" aria-label="Certifications">
                  {form.certs.map((cert) => (
                    <span key={cert} role="listitem"
                      className="inline-flex items-center gap-1 pl-3 pr-1 h-[36px] rounded-full bg-[#F0F4FF] border border-[#C7D5F8] text-[#0A1628] text-[13px] font-medium">
                      {cert}
                      <button type="button" aria-label={`Remove ${cert}`} onClick={() => set('certs', form.certs.filter((c) => c !== cert))}
                        className="w-8 h-8 rounded-full flex items-center justify-center text-[#6B7280]">
                        <X size={13} aria-hidden />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <input id="cert-input" type="text" value={certInput} data-testid="input-cert"
                  onChange={(e) => setCertInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addCert(); } }}
                  placeholder={form.certs.length === 0 ? 'Add a certification' : 'Add another'}
                  className={`${INPUT} ${inputBorder(null)} flex-1 min-w-0`} />
                <button type="button" onClick={addCert} disabled={!certInput.trim()} aria-label="Add certification"
                  className="h-[44px] px-4 rounded-[10px] bg-[#0A1628] text-white text-[14px] font-semibold flex items-center gap-1 disabled:opacity-40 flex-shrink-0">
                  <Plus size={15} aria-hidden /> Add
                </button>
              </div>
            </Field>

            <div id="availability" className="scroll-mt-[76px] border-t border-[#F3F4F6] pt-4">
              <p className="text-[#374151] text-[13px] font-semibold mb-2.5">Availability</p>
              <AvailabilityEditor availability={form.availability} isAvailable={form.isAvailable}
                onChange={(next) => { set('availability', next.availability); set('isAvailable', next.is_available); }} />
            </div>
          </Card>
        )}

        {/* ── Business (client + staffer) ───────────────────────────────── */}
        {isPoster && (
          <Card id="business" icon={Building2} title="Business">
            {role === 'client' && (
              <Field label="Company name" htmlFor="company" hint="Optional — builds brand recognition on your postings.">
                <input id="company" type="text" value={form.companyName} maxLength={100} data-testid="input-company"
                  onChange={(e) => set('companyName', e.target.value)} placeholder="e.g. The Grand Venue"
                  className={`${INPUT} ${inputBorder(null)}`} />
              </Field>
            )}

            <Field label={role === 'staffer' ? 'Events you staff' : 'Events you host'} htmlFor="event-types" hint="We match you with workers who specialise in these.">
              <div id="event-types" role="group" aria-label="Event types" className="flex flex-wrap gap-2">
                {EVENT_TYPES.map((type) => {
                  const sel = form.eventTypes.includes(type);
                  return (
                    <Chip key={type} selected={sel} testId={`event-${type}`}
                      onClick={() => set('eventTypes', sel ? form.eventTypes.filter((t) => t !== type) : [...form.eventTypes, type])}>
                      {type}
                    </Chip>
                  );
                })}
              </div>
            </Field>

            <Field label="Location" htmlFor="location"
              hint={form.lat != null && form.lng != null
                ? `Saved: ${form.lat.toFixed(3)}, ${form.lng.toFixed(3)} — pick an address to change it.`
                : 'Used to show your shifts to nearby workers.'}>
              <LocationAutocomplete value={locationQuery} onChange={setLocationQuery}
                onPlacePicked={({ lat, lng }) => { set('lat', lat); set('lng', lng); }} />
              <button type="button" onClick={useCurrentLocation} disabled={locating}
                className="h-11 px-3 -mt-1 self-start rounded-[10px] text-[#0A1628] text-[13px] font-semibold flex items-center gap-1.5 disabled:opacity-50">
                {locating ? <Crosshair size={14} aria-hidden className="animate-spin" /> : <MapPin size={14} aria-hidden />}
                {locating ? 'Locating…' : 'Use my current location'}
              </button>
            </Field>
          </Card>
        )}

        {/* ── Notifications link ────────────────────────────────────────── */}
        <section aria-label="Notifications" className="bg-white border border-[#E5E7EB] rounded-[12px] overflow-hidden">
          <button type="button" onClick={() => navigate('/notification-settings')}
            className="w-full flex items-center gap-3 px-4 py-3.5 text-left min-h-[56px]">
            <div className="w-9 h-9 rounded-[10px] bg-[#F5F5F5] border border-[#E5E7EB] flex items-center justify-center flex-shrink-0">
              <Bell size={16} aria-hidden className="text-[#0A1628]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[#111827] text-[14px] font-semibold">Notifications</p>
              <p className="text-[#6B7280] text-[12px]">Push, email and in-app alerts</p>
            </div>
            <ChevronRight size={16} aria-hidden className="text-[#9CA3AF]" />
          </button>
        </section>
      </main>

      {/* Sticky Save bar (sits above the home indicator) */}
      <div data-testid="save-bar"
        className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-app z-30 bg-white border-t border-[#E5E7EB] px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+12px)]">
        <button type="button" onClick={() => void save()} disabled={!canSave} aria-busy={saving} data-testid="btn-save"
          className="w-full h-[50px] rounded-[10px] bg-[#0A1628] text-white font-bold text-[15px] disabled:opacity-40 transition-opacity">
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>

      <ConfirmSheet
        open={discardOpen}
        title="Discard changes?"
        body="You have edits that haven't been saved. Leaving now will throw them away."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        tone="danger"
        onConfirm={() => { setDiscardOpen(false); navigate('/profile'); }}
        onCancel={() => setDiscardOpen(false)}
      />
    </div>
  );
}
