import { useEffect } from 'react';
import { useLocation } from 'wouter';
export function StafferPostStep5Screen() {
  const [, navigate] = useLocation();
  useEffect(() => { navigate('/post-shift/step1', { replace: true }); }, [navigate]);
  return null;
}
