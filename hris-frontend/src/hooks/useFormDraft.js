import { useState, useEffect, useRef, useCallback } from 'react';

const DRAFT_TTL = 24 * 60 * 60 * 1000;

export default function useFormDraft(draftKey, form, { enabled, onRestore } = {}) {
  const [draft, setDraft] = useState(null);
  const timer = useRef(null);

  useEffect(() => {
    if (!enabled) return;
    try {
      const raw = localStorage.getItem(`draft_${draftKey}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Date.now() - parsed.savedAt < DRAFT_TTL && parsed.data) {
          setDraft(parsed);
        } else {
          localStorage.removeItem(`draft_${draftKey}`);
        }
      }
    } catch {}
  }, [draftKey, enabled]);

  useEffect(() => {
    if (!enabled) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      try {
        localStorage.setItem(`draft_${draftKey}`, JSON.stringify({ data: form, savedAt: Date.now() }));
      } catch {}
    }, 1000);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [form, draftKey, enabled]);

  const clearDraft = useCallback(() => {
    try { localStorage.removeItem(`draft_${draftKey}`); } catch {}
    setDraft(null);
  }, [draftKey]);

  const restoreDraft = useCallback(() => {
    if (draft?.data && onRestore) onRestore(draft.data);
    setDraft(null);
  }, [draft, onRestore]);

  const dismissDraft = useCallback(() => {
    try { localStorage.removeItem(`draft_${draftKey}`); } catch {}
    setDraft(null);
  }, [draftKey]);

  return { draft, clearDraft, restoreDraft, dismissDraft };
}
