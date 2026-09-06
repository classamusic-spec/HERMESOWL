import { useEffect, useMemo, useRef, useState } from 'react';
import { createSyntheticSpeech } from '../audio/SpeechMeter';
import { HermesOwlet, type HermesOwletHandle } from '../character/HermesOwlet';
import type { MicroAnimation } from '../character/controllers/MicroAnimationController';
import {
  PHASE_LABELS,
  type HermesEmotion,
  type HermesOwletPhase,
  type HermesOwletState,
} from '../character/state/HermesOwletState';
import { deriveAdaptivePresence } from '../character/state/adaptivePresence';
import { useHermesActivity } from '../bridge/useHermesActivity';
import { HermesOwletStage } from '../world/HermesOwletStage';
import './hermes-body.css';

type DashboardView = 'body' | 'signals';
type EmotionChoice = HermesEmotion | 'auto';

const PHASES: HermesOwletPhase[] = [
  'offline',
  'idle',
  'listening',
  'thinking',
  'tool_use',
  'speaking',
  'success',
  'interrupted',
  'error',
];

const EMOTIONS: EmotionChoice[] = ['auto', 'neutral', 'happy', 'curious', 'focused', 'excited', 'concerned'];

const PHASE_META: Record<HermesOwletPhase, { eyebrow: string; message: string; glyph: string }> = {
  offline: { eyebrow: 'Presence suspended', message: 'Waiting for a Hermes session', glyph: '○' },
  waking: { eyebrow: 'Neural link opening', message: 'Coming online', glyph: '✦' },
  idle: { eyebrow: 'Presence online', message: 'Here with you', glyph: '●' },
  listening: { eyebrow: 'Input received', message: 'Listening closely', glyph: '◉' },
  thinking: { eyebrow: 'Inference active', message: 'Thinking it through', glyph: '◇' },
  tool_use: { eyebrow: 'Tool channel active', message: 'Working in your world', glyph: '⌁' },
  speaking: { eyebrow: 'Response ready', message: 'Speaking with you', glyph: '◖' },
  success: { eyebrow: 'Run complete', message: 'Done and delivered', glyph: '✓' },
  interrupted: { eyebrow: 'Attention redirected', message: 'I’m listening', glyph: '!' },
  error: { eyebrow: 'Recovery mode', message: 'Something needs attention', glyph: '×' },
};

const formatTool = (tool: string | null): string => {
  if (!tool) return 'No active tool';
  return tool.replace(/^mcp__[^_]+__/, '').replaceAll('_', ' ');
};

const formatModel = (model: string): string => {
  const segments = model.split('/');
  return segments[segments.length - 1] || model;
};

const roleLabel = (role: string | null): string => {
  if (role === 'user') return 'Your message';
  if (role === 'assistant') return 'Hermes response';
  if (role === 'tool') return 'Tool result';
  return 'Session connected';
};

interface TimelineItem {
  key: string;
  label: string;
  detail: string;
  phase: HermesOwletPhase;
  time: string;
}

export function HermesBodyDashboard(): JSX.Element {
  const owlRef = useRef<HermesOwletHandle | null>(null);
  const previousActivityKey = useRef('');
  const { activity, linkState } = useHermesActivity();

  const [view, setView] = useState<DashboardView>('body');
  const [liveMode, setLiveMode] = useState(true);
  const [manualPhase, setManualPhase] = useState<HermesOwletPhase>('idle');
  const [emotion, setEmotion] = useState<EmotionChoice>('auto');
  const [dark, setDark] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [world, setWorld] = useState(true);
  const [followPointer, setFollowPointer] = useState(true);
  const [snapshot, setSnapshot] = useState<HermesOwletState | null>(null);
  const [fps, setFps] = useState(0);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);

  const liveConnected = liveMode && linkState === 'live' && activity.connected;
  const phase = liveMode ? (activity.connected ? activity.phase : 'offline') : manualPhase;
  const meta = PHASE_META[phase];
  const adaptivePresence = deriveAdaptivePresence(phase);
  const activeEmotion = emotion === 'auto' ? adaptivePresence.emotion : emotion;
  const currentTool = phase === 'tool_use' ? formatTool(activity.toolName) : 'Standing by';

  const sessionLabel = useMemo(() => {
    if (linkState === 'connecting') return 'Finding Hermes Desktop…';
    if (!activity.connected) return 'No active desktop session';
    return activity.sessionTitle;
  }, [activity.connected, activity.sessionTitle, linkState]);

  useEffect(() => {
    let frames = 0;
    let previous = performance.now();
    let raf = 0;
    const tick = (now: number): void => {
      frames += 1;
      if (now - previous >= 1000) {
        setFps(Math.round((frames * 1000) / (now - previous)));
        frames = 0;
        previous = now;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    if (phase !== 'speaking') {
      owlRef.current?.setSpeechLevel(0);
      return;
    }

    const wave = createSyntheticSpeech(4);
    const started = performance.now();
    let raf = 0;
    const tick = (now: number): void => {
      owlRef.current?.setSpeechLevel(wave((now - started) / 1000));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      owlRef.current?.setSpeechLevel(0);
    };
  }, [phase]);

  useEffect(() => {
    if (!activity.connected) return;
    const key = `${activity.lastMessageId ?? 'session'}:${activity.phase}:${activity.toolName ?? ''}`;
    if (key === previousActivityKey.current) return;
    previousActivityKey.current = key;

    const detail = activity.phase === 'tool_use' ? formatTool(activity.toolName) : PHASE_META[activity.phase].message;
    setTimeline((current) => [
      {
        key,
        label: roleLabel(activity.lastRole),
        detail,
        phase: activity.phase,
        time: new Date(activity.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
      ...current,
    ].slice(0, 8));
  }, [activity]);

  const play = (animation: MicroAnimation): void => owlRef.current?.play(animation);

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>): void => {
    if (!followPointer || reducedMotion) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) / bounds.width - 0.5) * 2;
    const y = ((event.clientY - bounds.top) / bounds.height - 0.5) * 2;
    owlRef.current?.setGaze(Math.max(-1, Math.min(1, x)), Math.max(-1, Math.min(1, y)));
  };

  const releasePointer = (): void => {
    if (followPointer) owlRef.current?.releaseGaze();
  };

  const setPointerTracking = (enabled: boolean): void => {
    setFollowPointer(enabled);
    if (!enabled) owlRef.current?.releaseGaze();
  };

  const choosePhase = (next: HermesOwletPhase): void => {
    setLiveMode(false);
    setManualPhase(next);
  };

  return (
    <div className={`body-shell ${dark ? 'body-shell--dark' : 'body-shell--light'} body-shell--mood-${adaptivePresence.mood}`}>
      <header className="body-topbar">
        <div className="body-brand" aria-label="XAVI Hermes Owlet">
          <span className="body-brand__sigil">✦</span>
          <span>
            <strong>XAVI</strong>
            <small>HERMES BODY</small>
          </span>
        </div>

        <div className="body-session" title={sessionLabel}>
          <span className={`body-session__light body-session__light--${linkState}`} />
          <span>
            <small>{liveConnected ? 'LIVE CONVERSATION' : liveMode ? 'LINK STATUS' : 'SANDBOX MODE'}</small>
            <strong>{sessionLabel}</strong>
          </span>
        </div>

        <div className="body-topbar__actions">
          <span className="body-model">{formatModel(activity.model)}</span>
          <button
            type="button"
            className="icon-button"
            aria-label={dark ? 'Use light interface' : 'Use dark interface'}
            onClick={() => setDark((current) => !current)}
          >
            {dark ? '☼' : '◐'}
          </button>
        </div>
      </header>

      <div className="body-frame">
        <nav className="body-nav" aria-label="Owlet dashboard">
          <button
            type="button"
            className={view === 'body' ? 'is-active' : ''}
            onClick={() => setView('body')}
            aria-label="Body view"
            aria-pressed={view === 'body'}
          >
            <span>◉</span>
            <small>BODY</small>
          </button>
          <button
            type="button"
            className={view === 'signals' ? 'is-active' : ''}
            onClick={() => setView('signals')}
            aria-label="Signals view"
            aria-pressed={view === 'signals'}
          >
            <span>⌁</span>
            <small>SIGNALS</small>
          </button>
          <a href="?view=simulator" aria-label="Open animation lab">
            <span>◇</span>
            <small>LAB</small>
          </a>
          <div className="body-nav__spacer" />
          <div className={`body-nav__link-state ${liveConnected ? 'is-live' : ''}`}>
            <span />
            <small>{liveConnected ? 'LINKED' : 'LOCAL'}</small>
          </div>
        </nav>

        <main className="body-workspace">
          {view === 'body' ? (
            <div className="presence-layout">
              <section className="presence-card" aria-labelledby="presence-title">
                <div className="presence-card__header">
                  <div>
                    <span className="eyebrow">{meta.eyebrow}</span>
                    <h1 id="presence-title">{meta.message}</h1>
                  </div>
                  <div className="presence-card__status" aria-live="polite">
                    <div className={`mood-chip mood-chip--${adaptivePresence.mood}`} title={adaptivePresence.cue}>
                      <i aria-hidden="true" />
                      {adaptivePresence.label}
                    </div>
                    <div className={`phase-chip phase-chip--${phase}`}>
                      <span>{meta.glyph}</span>
                      {PHASE_LABELS[phase]}
                    </div>
                  </div>
                </div>

                <div
                  className={`presence-stage ${world ? '' : 'presence-stage--plain'}`}
                  onPointerMove={onPointerMove}
                  onPointerLeave={releasePointer}
                >
                  {world ? (
                    <HermesOwletStage
                      ref={owlRef}
                      phase={phase}
                      emotion={activeEmotion}
                      reducedMotion={reducedMotion || 'auto'}
                      onState={setSnapshot}
                      scale={0.72}
                      focus={{ x: 0.5, y: 0.53 }}
                    />
                  ) : (
                    <div className="presence-stage__character">
                      <HermesOwlet
                        ref={owlRef}
                        phase={phase}
                        emotion={activeEmotion}
                        reducedMotion={reducedMotion || 'auto'}
                        onState={setSnapshot}
                      />
                    </div>
                  )}
                  <div className="presence-reticle" aria-hidden="true"><span /><span /><span /><span /></div>
                  <div className="presence-caption">
                    <span>{phase === 'tool_use' ? 'ACTIVE CHANNEL' : 'EMOTIONAL SIGNAL'}</span>
                    <strong>{phase === 'tool_use' ? currentTool : adaptivePresence.label}</strong>
                  </div>
                </div>

                <div className="presence-actions" aria-label="Owlet interactions">
                  <button type="button" onClick={() => owlRef.current?.blink()}><span>◉</span> Blink</button>
                  <button type="button" onClick={() => play('tinyNod')}><span>⌄</span> Nod</button>
                  <button type="button" onClick={() => play('curiousTilt')}><span>◇</span> Curious</button>
                  <button type="button" onClick={() => play('sparkle')}><span>✦</span> Spark</button>
                </div>
              </section>

              <aside className="presence-sidebar">
                <section className="hud-card hud-card--session">
                  <div className="hud-card__heading">
                    <span className="eyebrow">Neural link</span>
                    <span className={`link-pill link-pill--${linkState}`}>
                      <i /> {liveConnected ? 'Live' : linkState === 'connecting' ? 'Linking' : 'Local'}
                    </span>
                  </div>
                  <h2>{sessionLabel}</h2>
                  <p>
                    {liveConnected
                      ? 'Owlet is following this Hermes Desktop session without reading message content.'
                      : 'Switch to the live link when Hermes Desktop is available, or direct the body manually.'}
                  </p>
                  <button
                    type="button"
                    className={`mode-switch ${liveMode ? 'is-live' : ''}`}
                    onClick={() => setLiveMode((current) => !current)}
                    aria-pressed={liveMode}
                  >
                    <span>{liveMode ? 'Live reactions' : 'Manual direction'}</span>
                    <i aria-hidden="true" />
                  </button>
                </section>

                <section className="hud-card">
                  <div className="hud-card__heading">
                    <span className="eyebrow">Vitals</span>
                    <span className={fps >= 55 ? 'vital-ok' : 'vital-warn'}>{fps < 10 ? 'PAUSED' : `${fps} FPS`}</span>
                  </div>
                  <div className="vitals-grid">
                    <div><small>MESSAGES</small><strong>{activity.messageCount}</strong></div>
                    <div><small>TOOLS</small><strong>{activity.toolCallCount}</strong></div>
                    <div><small>VOICE</small><strong>{Math.round((snapshot?.speechLevel ?? 0) * 100)}%</strong></div>
                    <div><small>MOOD</small><strong>{adaptivePresence.label.toUpperCase()}</strong></div>
                  </div>
                </section>

                <section className="hud-card">
                  <div className="hud-card__heading"><span className="eyebrow">Presence</span></div>
                  <div className="preference-list">
                    <label><span>World field<small>Reactive atmosphere</small></span><input aria-label="World field" type="checkbox" checked={world} onChange={(event) => setWorld(event.target.checked)} /></label>
                    <label><span>Eye contact<small>Follow your pointer</small></span><input aria-label="Eye contact" type="checkbox" checked={followPointer} onChange={(event) => setPointerTracking(event.target.checked)} /></label>
                    <label><span>Quiet motion<small>Reduce ambient movement</small></span><input aria-label="Quiet motion" type="checkbox" checked={reducedMotion} onChange={(event) => setReducedMotion(event.target.checked)} /></label>
                  </div>
                </section>
              </aside>
            </div>
          ) : (
            <div className="signals-layout">
              <section className="signal-hero">
                <span className="eyebrow">Conversation telemetry</span>
                <h1>The shape of our exchange.</h1>
                <p>Only activity metadata is projected here. Your words, tool arguments, and results remain outside the body layer.</p>
                <div className="signal-orb" aria-hidden="true"><span /><span /><span /></div>
              </section>

              <section className="hud-card signal-card">
                <div className="hud-card__heading"><span className="eyebrow">Recent signals</span><span>{timeline.length} events</span></div>
                <ol className="timeline">
                  {timeline.length ? timeline.map((item) => (
                    <li key={item.key}>
                      <i className={`timeline__dot timeline__dot--${item.phase}`} />
                      <span><strong>{item.label}</strong><small>{item.detail}</small></span>
                      <time>{item.time}</time>
                    </li>
                  )) : <li className="timeline__empty">Signals will appear as this conversation moves.</li>}
                </ol>
              </section>

              <section className="hud-card signal-card">
                <div className="hud-card__heading"><span className="eyebrow">Direction deck</span><span>{liveMode ? 'live locked' : 'manual'}</span></div>
                <div className="phase-deck">
                  {PHASES.map((item) => (
                    <button
                      key={item}
                      type="button"
                      className={!liveMode && manualPhase === item ? 'is-active' : ''}
                      aria-pressed={!liveMode && manualPhase === item}
                      onClick={() => choosePhase(item)}
                    >
                      <span>{PHASE_META[item].glyph}</span>{PHASE_LABELS[item]}
                    </button>
                  ))}
                </div>
                <button type="button" className="return-live" disabled={!activity.connected} onClick={() => setLiveMode(true)}>
                  <span>●</span> Return to live conversation
                </button>
              </section>

              <section className="hud-card signal-card">
                <div className="hud-card__heading"><span className="eyebrow">Expression layer</span><span>{emotion === 'auto' ? `auto · ${adaptivePresence.label}` : emotion}</span></div>
                <div className="emotion-deck">
                  {EMOTIONS.map((item) => (
                    <button
                      key={item}
                      type="button"
                      className={emotion === item ? 'is-active' : ''}
                      aria-pressed={emotion === item}
                      onClick={() => setEmotion(item)}
                    >
                      {item}
                    </button>
                  ))}
                </div>
                <dl className="signal-readout">
                  <div><dt>Gaze</dt><dd>{snapshot ? `${snapshot.gazeX.toFixed(2)} / ${snapshot.gazeY.toFixed(2)}` : '—'}</dd></div>
                  <div><dt>Halo energy</dt><dd>{snapshot ? `${Math.round(snapshot.haloGlow * 100)}%` : '—'}</dd></div>
                  <div><dt>Headphones</dt><dd>{snapshot ? `${Math.round(snapshot.headphoneGlow * 100)}%` : '—'}</dd></div>
                  <div><dt>Beak drive</dt><dd>{snapshot ? `${Math.round(snapshot.beakOpen * 100)}%` : '—'}</dd></div>
                </dl>
              </section>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
