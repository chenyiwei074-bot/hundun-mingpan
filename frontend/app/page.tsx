'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { useQuestionDraft } from '@/components/assistant/QuestionDraftContext';
import { INTENTS } from '@/lib/tools/catalog';
import { WESTERN_INTENTS } from '@/lib/tools/western-catalog';
import { isLiveEntry, statusCounts } from '@/lib/tools/status';

type World = 'oriental' | 'western';

const doors: { world: World; href: string; headline: string; lead: string; cta: string }[] = [
  { world: 'oriental', href: '/oriental', headline: '观象入局', lead: '八字紫微 · 六爻梅花 · 风水星宿', cta: '进入东方' },
  { world: 'western', href: '/western', headline: '向星而问', lead: '占星 · 塔罗 · 月相与数字', cta: '进入西方' },
];

function eyebrowLine(world: World) {
  const count = statusCounts(world === 'oriental' ? INTENTS : WESTERN_INTENTS).total;
  return `${world === 'oriental' ? '东方体系' : '西方体系'} · ${count} 项工具`;
}

function eyebrowNames(world: World) {
  const names = (world === 'oriental' ? INTENTS : WESTERN_INTENTS)
    .flatMap(group => group.tools).filter(isLiveEntry).map(tool => tool.name);
  return `${names.slice(0, 3).join('、')} 等 ${names.length} 项`;
}

function AmbientScene({ world }: { world: World }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let mounted = true;
    let dispose = () => {};

    void import('three').then(THREE => {
      if (!mounted || !canvas.isConnected) return;
      try {
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 50);
        camera.position.z = 7;
        const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: 'low-power' });
        const mobile = window.matchMedia('(max-width: 760px)').matches;
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.25 : 1.5));
        const count = mobile ? 70 : 120;
        const positions = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
          positions[i * 3] = (Math.random() - 0.5) * 9;
          positions[i * 3 + 1] = (Math.random() - 0.5) * 6;
          positions[i * 3 + 2] = (Math.random() - 0.5) * 4 - 1;
        }
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        const pointMaterial = new THREE.PointsMaterial({
          color: world === 'oriental' ? 0xd9bd88 : 0xd4bced,
          size: 0.026,
          transparent: true,
          opacity: 0.65,
          depthWrite: false,
        });
        const points = new THREE.Points(geometry, pointMaterial);
        scene.add(points);
        const ringGeometry = new THREE.TorusGeometry(2.15, 0.007, 4, 100);
        const ringMaterial = new THREE.MeshBasicMaterial({
          color: world === 'oriental' ? 0xd9bd88 : 0xd4bced,
          transparent: true,
          opacity: 0.13,
        });
        const ring = new THREE.Mesh(ringGeometry, ringMaterial);
        ring.rotation.x = 1.1;
        scene.add(ring);
        const parent = canvas.parentElement;
        if (!parent) return;
        const resize = () => {
          const { width, height } = parent.getBoundingClientRect();
          renderer.setSize(width, height, false);
          camera.aspect = width / Math.max(height, 1);
          camera.updateProjectionMatrix();
        };
        const observer = new ResizeObserver(resize);
        observer.observe(parent);
        resize();
        let running = true;
        let frame = 0;
        const render = () => {
          if (!running) return;
          if (!document.hidden) {
            ring.rotation.z += 0.0005;
            points.rotation.y += 0.00012;
            renderer.render(scene, camera);
          }
          frame = requestAnimationFrame(render);
        };
        render();
        dispose = () => {
          running = false;
          cancelAnimationFrame(frame);
          observer.disconnect();
          geometry.dispose();
          pointMaterial.dispose();
          ringGeometry.dispose();
          ringMaterial.dispose();
          renderer.dispose();
        };
        if (!mounted) dispose();
      } catch {
        // The static scene remains visible when WebGL is unavailable.
      }
    });
    return () => { mounted = false; dispose(); };
  }, [world]);

  return <canvas ref={canvasRef} className="hd-door__webgl" aria-hidden="true" />;
}

export default function GatePage() {
  const { put } = useQuestionDraft();
  const [question, setQuestion] = useState('');
  const [chooseWorld, setChooseWorld] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const carryQuestion = (world: World) => {
    put(world, question.trim());
  };

  const onAsk = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!question.trim()) { inputRef.current?.focus(); return; }
    setChooseWorld(true);
  };

  return (
    <main className="gate-shell hd-home" data-mode="gate">
      <header className="gate-head hd-home__intro">
        <h1>混沌 · 选择东方或西方体系</h1>
        <p>东方术数与风水 · 西方神秘学工具箱</p>
      </header>
      <div className="gate-grid hd-door-row" aria-label="选择体系">
        {doors.map(door => (
          <Link key={door.world} href={door.href} className={'domain-card hd-door hd-door--' + door.world} data-mode={door.world}>
            <span className="hd-door__scene" aria-hidden="true" />
            <span className="hd-door__shade" aria-hidden="true" />
            <span className="domain-card__veil" aria-hidden="true" />
            <AmbientScene world={door.world} />
            <span className="hd-door__copy">
              <span className="hd-door__eyebrow domain-card__tally">{eyebrowLine(door.world)}</span>
              <span className="qn-eyebrow hd-door__sr-tally">{eyebrowNames(door.world)}</span>
              <span className="domain-card__title hd-door__title">{door.headline}</span>
              <span className="hd-door__lead">{door.lead}</span>
              <span className="domain-card__cta hd-door__cta">{door.cta}<span aria-hidden="true">↗</span></span>
            </span>
          </Link>
        ))}
      </div>
      <section className="hd-home__ask" aria-label="按问题寻找工具">
        <div className="hd-home__ask-label">
          <strong>有问题，直接问。</strong>
          <span>混沌会帮你找到合适的工具</span>
        </div>
        <form onSubmit={onAsk} className="hd-home__ask-form">
          <input ref={inputRef} value={question} onChange={e => { setQuestion(e.target.value); setChooseWorld(false); }}
            aria-label="你想了解什么" placeholder="写下此刻想了解的事……" maxLength={280} />
          <button type="submit">问一下 <span aria-hidden="true">↗</span></button>
        </form>
      </section>
      {chooseWorld && (
        <section className="hd-home__choice" aria-label="选择问题所属体系">
          <div>
            <strong>选择一种方法来问</strong>
            <p>每套体系会独立处理你的问题，不会把不同术数的结论混在一起。</p>
          </div>
          <div className="hd-home__choice-links">
            <Link href="/oriental" onClick={() => carryQuestion('oriental')}>用东方方法问 <span aria-hidden="true">↗</span></Link>
            <Link href="/western" onClick={() => carryQuestion('western')}>用西方方法问 <span aria-hidden="true">↗</span></Link>
          </div>
        </section>
      )}
    </main>
  );
}
