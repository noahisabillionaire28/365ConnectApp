/**
 * ImageCropper — Instagram-style photo crop modal.
 *
 * Props
 * ─────
 * imageSrc      object URL of the file the user selected
 * onDone        called with (blob, previewUrl) after the user taps "Done"
 * onCancel      called when the user taps "Cancel" — parent should clear cropSrc
 * defaultAspect initial aspect ratio (default 1 = square)
 *
 * Features
 * ────────
 * • Pinch-to-zoom (mobile) and scroll-wheel zoom (desktop) via react-easy-crop
 * • Drag to reposition
 * • Aspect ratio selector: Square 1:1 | Portrait 4:5 | Landscape 16:9
 * • Canvas-based crop extraction — output is a Blob (JPEG, quality 0.92)
 */
import { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import type { Area } from 'react-easy-crop';

// ── Canvas crop helper ────────────────────────────────────────────────────────
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload  = () => resolve(img);
    img.onerror = reject;
    img.src     = src;
  });
}

async function getCroppedBlob(imageSrc: string, pixelCrop: Area): Promise<Blob> {
  const img    = await loadImage(imageSrc);
  const canvas = document.createElement('canvas');
  canvas.width  = pixelCrop.width;
  canvas.height = pixelCrop.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  ctx.drawImage(
    img,
    pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height,
    0,           0,           pixelCrop.width, pixelCrop.height,
  );
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      blob => (blob ? resolve(blob) : reject(new Error('Canvas toBlob failed'))),
      'image/jpeg',
      0.92,
    );
  });
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface AspectOption {
  label: string;
  ratio: number;
}

const ASPECTS: AspectOption[] = [
  { label: 'Square 1:1',   ratio: 1       },
  { label: 'Portrait 4:5', ratio: 4 / 5   },
  { label: 'Landscape 16:9', ratio: 16 / 9 },
];

export interface ImageCropperProps {
  imageSrc:      string;
  onDone:        (blob: Blob, previewUrl: string) => void;
  onCancel:      () => void;
  defaultAspect?: number; // default 1
}

// ── Component ─────────────────────────────────────────────────────────────────
export function ImageCropper({
  imageSrc,
  onDone,
  onCancel,
  defaultAspect = 1,
}: ImageCropperProps) {
  const [crop,              setCrop]             = useState({ x: 0, y: 0 });
  const [zoom,              setZoom]             = useState(1);
  const [aspect,            setAspect]           = useState(defaultAspect);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [applying,          setApplying]         = useState(false);

  const onCropComplete = useCallback((_: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels);
  }, []);

  async function handleDone() {
    if (!croppedAreaPixels) return;
    setApplying(true);
    try {
      const blob       = await getCroppedBlob(imageSrc, croppedAreaPixels);
      const previewUrl = URL.createObjectURL(blob);
      onDone(blob, previewUrl);
    } catch {
      // Fallback: return original unchanged
      const res  = await fetch(imageSrc);
      const blob = await res.blob();
      onDone(blob, imageSrc);
    } finally {
      setApplying(false);
    }
  }

  const selectedAspect = ASPECTS.find(a => Math.abs(a.ratio - aspect) < 0.001);

  return (
    // Full-screen modal — sits above all content
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: '#000' }}
      aria-modal="true"
      role="dialog"
      aria-label="Crop image"
    >
      {/* ── Top bar ────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 pt-12 pb-3 flex-shrink-0">
        <button
          type="button"
          onClick={onCancel}
          className="text-white text-[15px] font-medium py-2 pr-4"
          aria-label="Cancel crop"
        >
          Cancel
        </button>
        <span className="text-white text-[15px] font-semibold">Crop photo</span>
        <button
          type="button"
          onClick={handleDone}
          disabled={applying}
          className="text-[#0095F6] text-[15px] font-bold py-2 pl-4 disabled:opacity-40"
          aria-label="Confirm crop"
        >
          {applying ? 'Saving…' : 'Done'}
        </button>
      </div>

      {/* ── Crop area ──────────────────────────────────────────────────────── */}
      <div className="relative flex-1" style={{ minHeight: 0 }}>
        <Cropper
          image={imageSrc}
          crop={crop}
          zoom={zoom}
          aspect={aspect}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={onCropComplete}
          style={{
            containerStyle: { background: '#111' },
            cropAreaStyle:  { border: '2px solid rgba(255,255,255,0.85)' },
          }}
        />
      </div>

      {/* ── Aspect ratio selector ──────────────────────────────────────────── */}
      <div className="flex-shrink-0 pb-10 pt-4 px-5">
        <div className="flex items-center justify-center gap-3">
          {ASPECTS.map(opt => {
            const active = selectedAspect?.ratio === opt.ratio ||
              (!selectedAspect && Math.abs(opt.ratio - aspect) < 0.001);
            return (
              <button
                key={opt.label}
                type="button"
                onClick={() => setAspect(opt.ratio)}
                className="flex-1 h-[38px] rounded-full text-[12px] font-semibold transition-all active:scale-95"
                style={{
                  background: active ? '#FFFFFF'            : 'rgba(255,255,255,0.12)',
                  color:      active ? '#000000'            : '#FFFFFF',
                  border:     active ? '1px solid #FFFFFF'  : '1px solid rgba(255,255,255,0.2)',
                }}
                aria-pressed={active}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
        <p className="text-center text-[11px] mt-3 text-white/40">
          Pinch or scroll to zoom · drag to reposition
        </p>
      </div>
    </div>
  );
}
