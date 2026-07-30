"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Apple 式滚动渐现 — 元素进入视口时触发动画
 * @param threshold 0-1，元素可见比例达到此值时触发
 * @param once 是否只触发一次
 */
export function useInView<T extends HTMLElement = HTMLDivElement>(threshold = 0.15, once = true) {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          if (once) observer.unobserve(el);
        } else if (!once) {
          setInView(false);
        }
      },
      { threshold }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold, once]);

  return { ref, inView };
}

/**
 * 交错延迟 — 子元素依次出现的 stagger
 * @param index 子元素序号
 * @param baseDelay 基础延迟 ms
 */
export function staggerDelay(index: number, baseDelay = 80) {
  return { animationDelay: `${index * baseDelay}ms` };
}

/**
 * 悬浮卡片 — hover 时微微抬起
 */
export const cardHoverClass =
  "transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-md";
