/**
 * Bottom sheet: put a booked shift on the worker's calendar. Two options —
 * an .ics file (Apple Calendar, Outlook, anything) and a Google Calendar link.
 * Same shape as the directions chooser on the shift screen.
 */
import { useId } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CalendarPlus, X } from 'lucide-react';
import { googleCalendarUrl, openIcs, type CalendarEvent } from '@/lib/calendar';
import { useToast } from '@/contexts/ToastContext';
import { useDialog } from '@/hooks/useDialog';

export function AddToCalendarSheet({ open, event, onClose }: {
  open: boolean;
  event: CalendarEvent | null;
  onClose: () => void;
}) {
  const { showToast } = useToast();
  const titleId = useId();
  const ref = useDialog<HTMLDivElement>(open && !!event, onClose);

  async function handleIcs() {
    if (!event) return;
    try {
      await openIcs(event);
      onClose();
    } catch {
      showToast('Could not create the calendar file.', 'error');
    }
  }

  return (
    <AnimatePresence>
      {open && event && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose} data-no-pull className="fixed inset-0 bg-black/40 z-[60]" />
          <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 400, damping: 38 }}
            ref={ref} data-no-pull role="dialog" aria-modal="true" aria-labelledby={titleId}
            className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-app z-[61] bg-white rounded-t-[20px] px-5 pt-4 pb-[calc(env(safe-area-inset-bottom)+20px)] shadow-2xl">
            <div className="flex items-center justify-between mb-1">
              <p id={titleId} className="font-bold text-[16px] text-[#111827]">Add to calendar</p>
              <button type="button" onClick={onClose} aria-label="Close" className="w-11 h-11 -mr-3 flex items-center justify-center">
                <X size={18} aria-hidden className="text-[#737373]" />
              </button>
            </div>
            <p className="text-[#737373] text-[13px] mb-4 truncate">
              {[event.jobType, event.companyName].filter(Boolean).join(' · ')} · reminder 2 hours before
            </p>
            <button type="button" onClick={() => void handleIcs()}
              className="w-full flex items-center gap-3 h-[52px] px-4 rounded-[12px] border border-[#E5E7EB] mb-2.5 active:bg-[#FAFAFA] text-left">
              <CalendarPlus size={16} className="text-[#0A1628] flex-shrink-0" />
              <span className="font-semibold text-[15px] text-[#111827]">Apple Calendar / Other (.ics)</span>
            </button>
            <a href={googleCalendarUrl(event)} target="_blank" rel="noreferrer" onClick={onClose}
              className="flex items-center gap-3 h-[52px] px-4 rounded-[12px] border border-[#E5E7EB] active:bg-[#FAFAFA]">
              <CalendarPlus size={16} className="text-[#0A1628] flex-shrink-0" />
              <span className="font-semibold text-[15px] text-[#111827]">Google Calendar</span>
            </a>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
