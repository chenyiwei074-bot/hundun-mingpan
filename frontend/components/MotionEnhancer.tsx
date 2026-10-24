'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { getRevealDelay } from '@/lib/ui/motion';

export default function MotionEnhancer() {
  const pathname = usePathname();

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let revealObserver: IntersectionObserver | null = null;

    if (!reducedMotion.matches && 'IntersectionObserver' in window) {
      revealObserver = new IntersectionObserver(entries => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const element = entry.target as HTMLElement;
          element.classList.add('is-motion-visible');
          element.dataset.motionReveal = 'visible';
          revealObserver?.unobserve(element);
        }
      }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });
    }

    const observe = (element: HTMLElement, index: number) => {
      if (element.dataset.motionReveal) return;
      element.dataset.motionReveal = 'pending';
      element.classList.add('qn-scroll-reveal');
      element.style.setProperty('--qn-reveal-delay', getRevealDelay(index));

      if (reducedMotion.matches || !revealObserver) {
        element.classList.add('is-motion-visible');
        element.dataset.motionReveal = 'visible';
      } else {
        revealObserver.observe(element);
      }
    };

    const registerPageBlocks = () => {
      let index = 0;
      document.querySelectorAll<HTMLElement>('main').forEach(main => {
        for (const child of Array.from(main.children)) {
          const element = child as HTMLElement;
          if (
            element.matches('script, style, .sr-only, [aria-hidden="true"]') ||
            element.classList.contains('qn-rise') ||
            element.classList.contains('gate-grid')
          ) continue;
          observe(element, index++);
        }

        for (const card of main.querySelectorAll<HTMLElement>('.qn-card, .domain-card')) {
          if (
            card.classList.contains('qn-rise') ||
            card.matches('.sr-only, [aria-hidden="true"]') ||
            card.parentElement?.closest('.qn-card, .qn-scroll-reveal')
          ) continue;
          observe(card, index++);
        }
      });
    };

    registerPageBlocks();
    const mutationObserver = new MutationObserver(registerPageBlocks);
    mutationObserver.observe(document.body, { childList: true, subtree: true });

    return () => {
      mutationObserver.disconnect();
      revealObserver?.disconnect();
      document.querySelectorAll<HTMLElement>('[data-motion-reveal]').forEach(element => {
        element.classList.remove('qn-scroll-reveal', 'is-motion-visible');
        element.style.removeProperty('--qn-reveal-delay');
        delete element.dataset.motionReveal;
      });
    };
  }, [pathname]);

  return null;
}
