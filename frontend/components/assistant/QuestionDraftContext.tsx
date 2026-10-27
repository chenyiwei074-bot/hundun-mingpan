'use client';

import { createContext, useCallback, useContext, useRef } from 'react';
import type { Mode } from '@/lib/assistant/types';

type QuestionDraft = { put: (mode: Mode, text: string) => void; take: (mode: Mode) => string };
const Context = createContext<QuestionDraft | null>(null);

export function QuestionDraftProvider({ children }: { children: React.ReactNode }) {
  const draft = useRef<Partial<Record<Mode, string>>>({});
  const put = useCallback((mode: Mode, text: string) => { draft.current[mode] = text; }, []);
  const take = useCallback((mode: Mode) => {
    const value = draft.current[mode] || '';
    delete draft.current[mode];
    return value;
  }, []);
  return <Context.Provider value={{ put, take }}>{children}</Context.Provider>;
}

export function useQuestionDraft() {
  const context = useContext(Context);
  if (!context) throw new Error('QuestionDraftProvider is required');
  return context;
}
