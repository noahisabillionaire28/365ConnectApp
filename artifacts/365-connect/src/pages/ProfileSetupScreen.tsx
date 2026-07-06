import { useState, useRef } from 'react';
import { useLocation } from 'wouter';
import { Camera, Plus, X, ChevronLeft, Check, AlertCircle } from 'lucide-react';
import { supabase, uploadAvatar, uploadPostPhoto } from '@/lib/supabase';

const JOB_TYPES = [
  'Bartender', 'Server', 'DJ', 'Caterer',
  'Security', 'Hostess', 'Promotional Model', 'Brand Ambassador',
  'Captain', 'Manager', 'House Manager', 'Cleaner',
  'Housekeeper', 'Busser',
];

const TOTAL_STEPS = 6;

export function ProfileSetupScreen() {
  const [, navigate] = useLocation();
  const [step,      setStep]      = useState(1);
  const [saving,    setSaving]    = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [username,          setUsername]          = useState('');
  const [photoPreview,      setPhotoPreview]      = useState<string | null>(null);
  const [photoFile,         setPhotoFile]         = useState<File | null>(null);
  const photoInputRef                             = useRef<HTMLInputElement>(null);
  const [bio,               setBio]               = useState('');
  const [selectedJobs,      setSelectedJobs]      = useState<string[]>([]);
  const [certInput,         setCertInput]         = useState('');
  const [certs,             setCerts]             = useState<string[]>([]);
  const [postPhotoPreview,  setPostPhotoPreview]  = useState<string | null>(null);
  const [postPhotoFile,     setPostPhotoFile]     = useState<File | null>(null);
  const postPhotoInputRef                         = useRef<HTMLInputElement>(null);
  const [postDescription,   setPostDescription]   = useState('');

  const progress = (step / TOTAL_STEPS) * 100;

  function handleBack()  { if (step > 1) setStep((s) => s - 1); }
  function handleNext()  { if (step < TOTAL_STEPS) setStep((s) => s + 1); }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) { setPhotoFile(file); setPhotoPreview(URL.createObjectURL(file)); }
  }

  function handlePostPhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) { setPostPhotoFile(file); setPostPhotoPreview(URL.createObjectURL(file)); }
  }

  function toggleJob(job: string) {
    setSelectedJobs((prev) => prev.includes(job) ? prev.filter((j) => j !== job) : [...prev, job]);
  }

  function handleCertKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if ((e.key === 'Enter' || e.key === ',') && certInput.trim()) {
      e.preventDefault();
      const tag = certInput.trim().replace(/,$/, '');
      if (tag && !certs.includes(tag)) setCerts((p) => [...p, tag]);
      setCertInput('');
    }
    if (e.key === 'Backspace' && !certInput && certs.length) setCerts((p) => p.slice(0, -1));
  }

  function removeCert(cert: string) { setCerts((p) => p.filter((c) => c !== cert)); }

  async function handleComplete() {
    setSaving(true); setSaveError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setSaveError('You are not signed in. Please go back and sign in first.'); return; }

      let photoUrl:     string | null = null;
      let postPhotoUrl: string | null = null;

      if (photoFile)     photoUrl     = await uploadAvatar(user.id, photoFile);
      if (postPhotoFile) postPhotoUrl = await uploadPostPhoto(user.id, postPhotoFile);

      const role = (sessionStorage.getItem('selectedRole') ?? 'worker') as 'worker' | 'client';

      const { error: profileError } = await supabase.from('users').upsert({
        id: user.id, email: user.email!, role,
        username: username.trim(), photo_url: photoUrl,
        bio: bio.trim() || null, job_types: selectedJobs, certifications: certs,
      });

      if (profileError) throw profileError;

      if (postPhotoUrl || postDescription.trim()) {
        console.info('[365 Connect] First post captured:', { postPhotoUrl, postDescription });
      }

      sessionStorage.removeItem('selectedRole');
      navigate('/home');
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save profile. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  const canContinue: Record<number, boolean> = {
    1: username.trim().length >= 2,
    2: true, 3: true,
    4: selectedJobs.length > 0,
    5: true,
    6: !!postPhotoPreview && postDescription.trim().length > 0,
  };

  const INPUT_BASE = "bg-white border border-[#DBDBDB] rounded-[12px] focus-within:border-black transition-colors";
  const TEXT_BASE  = "bg-transparent outline-none text-black text-[16px] font-medium placeholder:text-[#AAAAAA]";

  return (
    <div className="flex flex-col h-full bg-white text-black overflow-hidden">
      {/* Header */}
      <div className="flex items-center px-5 pt-12 pb-4">
        {step > 1 ? (
          <button onClick={handleBack}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-[#FAFAFA] border border-[#DBDBDB] mr-3 active:scale-95 transition-transform">
            <ChevronLeft size={20} className="text-black" />
          </button>
        ) : (
          <div className="w-9 h-9 mr-3" />
        )}
        <span className="text-[13px] text-[#737373] font-medium">Step {step} of {TOTAL_STEPS}</span>
      </div>

      {/* Progress bar */}
      <div className="mx-5 h-[3px] bg-[#DBDBDB] rounded-full overflow-hidden mb-8">
        <div className="h-full bg-black rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
      </div>

      {/* Step content */}
      <div className="flex-1 overflow-y-auto px-5 pb-4">

        {/* Step 1: Username */}
        {step === 1 && (
          <div className="flex flex-col">
            <h1 className="text-[26px] font-bold leading-tight mb-2">What's your @handle?</h1>
            <p className="text-[#737373] text-[14px] mb-8">This is how clients and workers find you on 365 Connect.</p>
            <div className={`flex items-center ${INPUT_BASE} px-4 h-[56px]`}>
              <span className="text-black font-semibold text-[18px] mr-1">@</span>
              <input autoFocus type="text" placeholder="yourhandle" value={username}
                onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_.]/g, '').toLowerCase())}
                className={TEXT_BASE + ' flex-1'} maxLength={30} />
            </div>
            {username.length > 0 && (
              <p className="text-[#737373] text-[12px] mt-2 ml-1">Your profile will be at @{username}</p>
            )}
          </div>
        )}

        {/* Step 2: Profile Photo */}
        {step === 2 && (
          <div className="flex flex-col items-center">
            <h1 className="text-[26px] font-bold leading-tight mb-2 self-start">Add a profile photo</h1>
            <p className="text-[#737373] text-[14px] mb-10 self-start">Show the world who you are.</p>
            <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
            <button onClick={() => photoInputRef.current?.click()}
              className="relative w-[160px] h-[160px] rounded-full bg-[#FAFAFA] border-2 border-dashed border-[#DBDBDB] flex items-center justify-center overflow-hidden active:scale-95 transition-transform">
              {photoPreview ? (
                <img src={photoPreview} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <div className="w-12 h-12 rounded-full bg-[#EFEFEF] flex items-center justify-center">
                    <Camera size={22} className="text-black" />
                  </div>
                  <span className="text-[12px] text-[#737373] font-medium">Tap to upload</span>
                </div>
              )}
            </button>
            {photoPreview && (
              <button onClick={() => photoInputRef.current?.click()} className="mt-5 text-[14px] text-[#0095F6] font-semibold">
                Change photo
              </button>
            )}
          </div>
        )}

        {/* Step 3: Bio */}
        {step === 3 && (
          <div className="flex flex-col">
            <h1 className="text-[26px] font-bold leading-tight mb-2">Write a short bio</h1>
            <p className="text-[#737373] text-[14px] mb-8">Tell clients what makes you great. Keep it concise.</p>
            <div className={`relative ${INPUT_BASE}`}>
              <textarea autoFocus
                placeholder="e.g. High-energy bartender with 5+ years in upscale venues. TIPS certified. Known for fast service and great vibes."
                value={bio} onChange={(e) => setBio(e.target.value)} maxLength={160} rows={5}
                className="w-full bg-transparent outline-none text-black text-[15px] leading-relaxed placeholder:text-[#AAAAAA] resize-none p-4 pb-8" />
              <span className="absolute bottom-3 right-4 text-[11px] text-[#737373]">{bio.length}/160</span>
            </div>
          </div>
        )}

        {/* Step 4: Job Types */}
        {step === 4 && (
          <div className="flex flex-col">
            <h1 className="text-[26px] font-bold leading-tight mb-2">What do you do?</h1>
            <p className="text-[#737373] text-[14px] mb-6">Select all roles that apply to you.</p>
            <div className="grid grid-cols-2 gap-3">
              {JOB_TYPES.map((job) => {
                const sel = selectedJobs.includes(job);
                return (
                  <button key={job} onClick={() => toggleJob(job)}
                    className={`relative flex items-center justify-between px-4 py-[14px] rounded-[12px] text-left transition-all active:scale-[0.97] ${
                      sel ? 'bg-black/5 border-2 border-black text-black' : 'bg-white border border-[#DBDBDB] text-[#737373]'
                    }`}>
                    <span className="text-[13px] font-semibold leading-snug pr-2">{job}</span>
                    {sel && (
                      <div className="w-5 h-5 rounded-full bg-black flex items-center justify-center flex-shrink-0">
                        <Check size={11} className="text-white" strokeWidth={3} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
            {selectedJobs.length > 0 && (
              <p className="text-black text-[12px] font-medium mt-4 text-center">
                {selectedJobs.length} role{selectedJobs.length > 1 ? 's' : ''} selected
              </p>
            )}
          </div>
        )}

        {/* Step 5: Certifications */}
        {step === 5 && (
          <div className="flex flex-col">
            <h1 className="text-[26px] font-bold leading-tight mb-2">Any certifications?</h1>
            <p className="text-[#737373] text-[14px] mb-8">Optional — add TIPS, ServSafe, CPR, Food Handler, or any others.</p>
            <div className={`${INPUT_BASE} p-3 min-h-[56px]`}>
              <div className="flex flex-wrap gap-2">
                {certs.map((cert) => (
                  <span key={cert} className="inline-flex items-center gap-1 bg-[#FAFAFA] border border-[#DBDBDB] text-black text-[13px] font-medium px-3 py-[6px] rounded-full">
                    {cert}
                    <button onClick={() => removeCert(cert)} className="ml-1 text-[#737373] hover:text-black transition-colors">
                      <X size={12} />
                    </button>
                  </span>
                ))}
                <input autoFocus type="text"
                  placeholder={certs.length === 0 ? 'Type and press Enter to add…' : 'Add another…'}
                  value={certInput} onChange={(e) => setCertInput(e.target.value)} onKeyDown={handleCertKeyDown}
                  className="flex-1 min-w-[140px] bg-transparent outline-none text-black text-[14px] placeholder:text-[#AAAAAA] py-[6px]" />
              </div>
            </div>
            {certs.length === 0 && (
              <p className="text-[#737373] text-[12px] mt-3 ml-1">You can always add these later from your profile.</p>
            )}
          </div>
        )}

        {/* Step 6: First Post */}
        {step === 6 && (
          <div className="flex flex-col">
            <h1 className="text-[26px] font-bold leading-tight mb-2">Share your first moment</h1>
            <p className="text-[#737373] text-[14px] mb-8">Upload a photo from a past event to show clients your experience.</p>

            <input ref={postPhotoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePostPhotoChange} />
            <button onClick={() => postPhotoInputRef.current?.click()}
              className="w-full aspect-[4/3] rounded-[12px] bg-[#FAFAFA] border border-dashed border-[#DBDBDB] flex items-center justify-center overflow-hidden active:scale-[0.98] transition-transform mb-5">
              {postPhotoPreview ? (
                <img src={postPhotoPreview} alt="Post" className="w-full h-full object-cover" />
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-14 h-14 rounded-full bg-[#EFEFEF] flex items-center justify-center">
                    <Plus size={24} className="text-black" />
                  </div>
                  <span className="text-[13px] text-[#737373] font-medium">Tap to upload photo</span>
                </div>
              )}
            </button>

            {postPhotoPreview && (
              <button onClick={() => postPhotoInputRef.current?.click()}
                className="text-[13px] text-[#0095F6] font-semibold mb-5 text-center">
                Change photo
              </button>
            )}

            <div className={INPUT_BASE}>
              <textarea placeholder="Describe what you were working — role, venue, event type…"
                value={postDescription} onChange={(e) => setPostDescription(e.target.value)}
                maxLength={300} rows={4}
                className="w-full bg-transparent outline-none text-black text-[15px] leading-relaxed placeholder:text-[#AAAAAA] resize-none p-4" />
            </div>

            {saveError && (
              <div className="mt-4 flex items-start gap-2 bg-red-50 border border-red-200 rounded-[12px] px-4 py-3">
                <AlertCircle size={16} className="text-red-500 flex-shrink-0 mt-[1px]" />
                <p className="text-red-600 text-[13px] leading-snug">{saveError}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer CTA */}
      <div className="px-5 pb-10 pt-4">
        {step < TOTAL_STEPS ? (
          <div className="flex flex-col gap-3">
            <button onClick={handleNext} disabled={!canContinue[step]}
              className="w-full bg-black text-white font-bold text-[16px] py-[18px] rounded-[8px] active:scale-[0.98] transition-transform disabled:opacity-30 disabled:cursor-not-allowed">
              Continue
            </button>
            {(step === 2 || step === 5) && (
              <button onClick={handleNext}
                className="w-full text-center text-[14px] text-[#737373] font-medium hover:text-black transition-colors py-2">
                {step === 2 ? 'Skip for now' : 'Skip — add later'}
              </button>
            )}
          </div>
        ) : (
          <button onClick={handleComplete} disabled={!canContinue[6] || saving}
            className="w-full bg-black text-white font-bold text-[16px] py-[18px] rounded-[8px] active:scale-[0.98] transition-transform disabled:opacity-30 disabled:cursor-not-allowed">
            {saving ? 'Saving profile…' : 'Complete Profile'}
          </button>
        )}
      </div>
    </div>
  );
}
