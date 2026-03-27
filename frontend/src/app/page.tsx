'use client';

import { useState } from 'react';
import { TerminalShell } from '@/components/layout/TerminalShell';
import { StartupScreen } from '@/components/layout/StartupScreen';

export default function Home() {
  const [loading, setLoading] = useState(true);

  if (loading) {
    return <StartupScreen onComplete={() => setLoading(false)} />;
  }

  return <TerminalShell />;
}
