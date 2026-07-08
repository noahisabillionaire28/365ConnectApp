// Unified wizard — all post-shift flows (client and staffer) use /post-shift/step1–5
import { useEffect } from 'react';
import { useLocation } from 'wouter';

export function StafferPostStep1Screen() {
  const [, navigate] = useLocation();
  useEffect(() => { navigate('/post-shift/step1', { replace: true }); }, [navigate]);
  return null;
}
