// "Tap +, tuck in a scrap": the Pocketful app, seen first-person, drawn in ink.
// You look straight down at your own screen. Your taps leave ink ripples; no hand is drawn.
//
//  + opens the capture sheet → pick a kind → the scrap draws itself (a note writes,
//  a photo develops, a receipt prints, a to-do gets ticked) → Tuck it in → it flies
//  onto today's page and is taped down. Tap a scrap to flip it to its private back.
//  Pockets files the whole page into November's folder.
//  Left alone, it plays the same flow with ghost taps; any real tap takes over.
//
//  ?debug  steps time by hand (window.__step), like the skill's run()
import { el, pen, shape, paint, inkDefs, f, PAPER } from './lib/ink.ts';
import { spring, ease, minJerk, clamp, lerp, seeded } from './lib/motion.ts';

const W = 360, H = 640;
const INK = '#25221F', INK_SOFT = '#6B645B';
const CLAY = '#C2563A', CLAY_SOFT = '#EDB7A6', BUTTER = '#F3DC8E', STICKY = '#F9E58E', SKY = '#C7D6E8', SCREEN = '#F4EFE6';
const TAPES = ['#F2C2AE', '#BCD7C6', '#C7D1EC', '#F2E1A4'];
const POCKETS = [['#F7D4DB', '#E9A9B7'], ['#95AFA0', '#6F8F7D'], ['#F3C48E', '#E39D58'], ['#F1DA90', '#DDBA55'], ['#E4B8EF', '#C98CD9'], ['#BEDEF3', '#8DBCE0']];
const DISPLAY = "'Archivo Black', 'Arial Black', sans-serif", SERIF = "'Instrument Serif', Georgia, serif";
const TYPE = "'Courier Prime', 'Courier New', monospace", HAND = "'Caveat', cursive";

const host = document.querySelector<HTMLElement>('[data-line-art]');
if (!host) throw new Error('line-art: no [data-line-art] host');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const R = seeded(31);

// ---------------------------------------------------------------- helpers
const rr = (x: number, y: number, w: number, h: number, r: number) =>
  `M${f(x + r)} ${f(y)} L${f(x + w - r)} ${f(y)} Q${f(x + w)} ${f(y)} ${f(x + w)} ${f(y + r)} L${f(x + w)} ${f(y + h - r)} Q${f(x + w)} ${f(y + h)} ${f(x + w - r)} ${f(y + h)} L${f(x + r)} ${f(y + h)} Q${f(x)} ${f(y + h)} ${f(x)} ${f(y + h - r)} L${f(x)} ${f(y + r)} Q${f(x)} ${f(y)} ${f(x + r)} ${f(y)}Z`;
interface TextOpts { anchor?: string; fill?: string; ls?: number; italic?: boolean; weight?: number }
function text(parent: Element, x: number, y: number, s: string, font: string, size: number, o: TextOpts = {}): SVGTextElement {
  const t = el('text', { x, y, 'font-family': font, 'font-size': size, fill: o.fill ?? 'currentColor', 'text-anchor': o.anchor ?? 'start' }, parent);
  if (o.ls) t.setAttribute('letter-spacing', String(o.ls));
  if (o.italic) t.setAttribute('font-style', 'italic');
  if (o.weight) t.setAttribute('font-weight', String(o.weight));
  t.textContent = s;
  return t;
}
/** A pen line that can be drawn on: progress 0 → 1 via setDraw(). */
function drawOn(p: SVGPathElement): SVGPathElement { p.setAttribute('pathLength', '1'); p.setAttribute('stroke-dasharray', '1 1'); p.setAttribute('stroke-dashoffset', '1'); return p; }
const setDraw = (p: SVGPathElement, u: number) => p.setAttribute('stroke-dashoffset', f(1 - clamp(u, 0, 1)));
const move = (g: Element, x: number, y: number) => g.setAttribute('transform', `translate(${f(x)} ${f(y)})`);
let uid = 0;

// ---------------------------------------------------------------- the device
const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'group', 'aria-label': 'An ink drawing of the Pocketful app, as if it were your own phone. Tap the orange plus to tuck in a scrap.' });
svg.style.color = INK;
const { filter, defs } = inkDefs(svg, 'pp');
host.appendChild(svg);
const clip = el('clipPath', { id: 'pp-screen' }, defs);
el('path', { d: rr(12, 12, W - 24, H - 24, 32) }, clip);

shape(svg, 1.6).setAttribute('d', rr(3, 3, W - 6, H - 6, 42));
const ink = el('g', { filter }, svg);
const screen = el('g', { 'clip-path': 'url(#pp-screen)' }, ink);
pen(ink, 0.7).setAttribute('d', rr(12, 12, W - 24, H - 24, 32));

const todayG = el('g', {}, screen);
const pocketsG = el('g', {}, screen);
const statusG = el('g', {}, screen);
const barG = el('g', {}, screen);
const filingLayer = el('g', {}, screen);
const novFront = el('g', {}, screen);
const scrim = el('rect', { x: 0, y: 0, width: W, height: H, fill: INK, opacity: 0 }, screen);
const sheetG = el('g', {}, screen);
const flyLayer = el('g', {}, screen);
const toastG = el('g', { opacity: 0 }, screen);
const rippleG = el('g', { 'pointer-events': 'none' }, svg);

// status bar
text(statusG, 34, 36, '9:41', TYPE, 11, { weight: 700 });
pen(statusG, 0.8).setAttribute('d', `${rr(300, 27, 22, 11, 3)} M323.5 31 l0 3`);
el('rect', { x: 302.5, y: 29.5, width: 13, height: 6, rx: 1.4, fill: INK }, statusG);
pen(statusG, 1.3).setAttribute('d', 'M280 37 l0 -2.5 M284.5 37 l0 -5 M289 37 l0 -7.5');

// ---------------------------------------------------------------- today
el('rect', { x: 0, y: 0, width: W, height: H, fill: SCREEN }, todayG);
text(todayG, 28, 86, 'Today', DISPLAY, 30);
text(todayG, 30, 104, 'TUESDAY, 17 NOVEMBER', TYPE, 9, { ls: 1.6, fill: INK_SOFT, weight: 700 });
const counter = text(todayG, 334, 86, '', HAND, 17, { anchor: 'end', fill: INK_SOFT });

const pageG = el('g', {}, todayG);
const pageClipId = `pp-page-${uid++}`;
const pageClip = el('clipPath', { id: pageClipId }, defs);
el('path', { d: rr(20, 116, 320, 416, 8) }, pageClip);
shape(pageG, 1).setAttribute('d', rr(20, 116, 320, 416, 8));
{
  const grid = pen(pageG, 0.35);
  grid.setAttribute('clip-path', `url(#${pageClipId})`);
  grid.setAttribute('opacity', '0.5');
  let d = '';
  for (let x = 36; x < 340; x += 16) d += `M${x} 117 L${x} 531 `;
  for (let y = 132; y < 532; y += 16) d += `M21 ${y} L339 ${y} `;
  grid.setAttribute('d', d);
  const tape = paint(pageG, TAPES[2], 0.6);
  tape.setAttribute('d', rr(150, 108, 60, 15, 1.5));
  tape.setAttribute('transform', 'rotate(-3 180 116)');
}
const emptyHint = text(pageG, 180, 330, 'tap + to tuck in a scrap', HAND, 19, { anchor: 'middle', fill: INK_SOFT });
const pageScraps = el('g', {}, pageG);
const SLOTS: Array<[number, number, number]> = [[100, 196, -5], [258, 192, 4], [104, 326, 3], [262, 330, -4], [100, 456, -2], [258, 460, 5]];

// ---------------------------------------------------------------- pockets
el('rect', { x: 0, y: 0, width: W, height: H, fill: SCREEN }, pocketsG);
text(pocketsG, 28, 86, 'Pockets', DISPLAY, 30);
text(pocketsG, 30, 106, 'the year, month by month', SERIF, 17, { italic: true, fill: INK_SOFT });
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const NOV = 10;
const folderAt = (i: number): [number, number] => [80 + (i % 3) * 100, 168 + Math.floor(i / 3) * 98];
let novCount = 6;
let novLabel!: SVGTextElement;
const novPuffG = el('g', {}, novFront);
MONTHS.forEach((m, i) => {
  const [cx, cy] = folderAt(i);
  const [front, back] = POCKETS[i % POCKETS.length];
  const g = el('g', { opacity: i > NOV ? 0.42 : 1 }, pocketsG);
  paint(g, back, 0.9).setAttribute('d', `${rr(cx - 38, cy - 28, 76, 58, 7)} ${rr(cx - 38, cy - 35, 30, 12, 4)}`);
  if (i <= NOV) {
    for (const [dx, rot] of [[-10, -6], [9, 5]]) {
      const p = shape(g, 0.7);
      p.setAttribute('d', rr(cx + dx - 13, cy - 30, 26, 30, 1.5));
      p.setAttribute('transform', `rotate(${rot} ${cx + dx} ${cy - 15})`);
    }
  }
  const fg = i === NOV ? el('g', {}, novPuffG) : g;
  paint(fg, front, 0.9).setAttribute('d', rr(cx - 38, cy - 8, 76, 38, 6));
  const st = el('path', { d: rr(cx - 33, cy - 3, 66, 28, 4), fill: 'none', stroke: '#FFFFFF', 'stroke-width': 0.9, 'stroke-dasharray': '2.6 2', opacity: 0.85 }, fg);
  st.setAttribute('stroke-linecap', 'round');
  const count = i < NOV ? String(Math.round(R(6, 15))) : i === NOV ? String(novCount) : '';
  const c = text(fg, cx + 30, cy + 24, count, TYPE, 10, { anchor: 'end', weight: 700, fill: INK_SOFT });
  if (i === NOV) novLabel = c;
  text(g, cx, cy + 50, m, SERIF, 16, { anchor: 'middle', italic: true });
});

// ---------------------------------------------------------------- bottom bar
shape(barG, 1).setAttribute('d', rr(22, 548, 316, 60, 30));
const bubble = paint(barG, BUTTER, 0.8);
const TABS: Array<{ key: string; x: number; icon: string }> = [
  { key: 'Desk', x: 64, icon: 'M-8 -7 h6.5 v6.5 h-6.5Z M1.5 -7 h6.5 v6.5 h-6.5Z M-8 2.5 h6.5 v6.5 h-6.5Z M1.5 2.5 h6.5 v6.5 h-6.5Z' },
  { key: 'Today', x: 122, icon: 'M-9 -6 Q-4.5 -9 0 -5.5 Q4.5 -9 9 -6 L9 7 Q4.5 4.5 0 8 Q-4.5 4.5 -9 7Z M0 -5.5 L0 8' },
  { key: 'Pockets', x: 182, icon: 'M-9 -6 L-3 -6 L-1 -3.5 L9 -3.5 L9 8 L-9 8Z M-9 -1 L9 -1' },
  { key: 'Board', x: 240, icon: 'M-6 -4 a2.4 2.4 0 1 0 0.1 0 M6 -4 a2.4 2.4 0 1 0 0.1 0 M0 7 a2.4 2.4 0 1 0 0.1 0 M-5 -1 L-1 5 M5 -1 L1 5' },
];
const tabG: Record<string, SVGGElement> = {};
for (const t of TABS) {
  const g = el('g', {}, barG);
  el('rect', { x: t.x - 28, y: 552, width: 56, height: 52, fill: 'transparent' }, g);
  const ic = pen(g, 1.2); ic.setAttribute('d', t.icon); ic.setAttribute('transform', `translate(${t.x} 571)`);
  text(g, t.x, 595, t.key, TYPE, 8.5, { anchor: 'middle', weight: 700 });
  tabG[t.key] = g;
}
const plusG = el('g', {}, barG);
paint(plusG, CLAY, 1).setAttribute('d', 'M278 578 a24 24 0 1 0 48 0 a24 24 0 1 0 -48 0');
el('path', { d: 'M302 567 L302 589 M291 578 L313 578', stroke: PAPER, 'stroke-width': 3, 'stroke-linecap': 'round', fill: 'none' }, plusG);
const PLUS: [number, number] = [302, 578];
el('circle', { cx: 302, cy: 578, r: 24, fill: 'none', stroke: CLAY, 'stroke-width': 2, class: 'la-pulse', 'pointer-events': 'none' }, barG);

// ---------------------------------------------------------------- capture sheet
const sheetBody = el('g', {}, sheetG);
shape(sheetBody, 1).setAttribute('d', `M12 290 Q12 270 32 270 L328 270 Q348 270 348 290 L348 652 L12 652Z`);
pen(sheetBody, 2).setAttribute('d', 'M164 282 L196 282');
text(sheetBody, 30, 314, 'Tuck something in', SERIF, 25, { italic: true });
const closeG = el('g', {}, sheetBody);
shape(closeG, 0.9).setAttribute('d', 'M309 306 a14 14 0 1 0 28 0 a14 14 0 1 0 -28 0');
pen(closeG, 1.3).setAttribute('d', 'M317.5 300 L328.5 312 M328.5 300 L317.5 312');
type Kind = 'note' | 'mood' | 'spend' | 'photo' | 'todo';
const KINDS: Array<[Kind, string]> = [['note', 'Note'], ['mood', 'Mood'], ['spend', 'Spend'], ['photo', 'Photo'], ['todo', 'To-do']];
const chips: Record<string, { g: SVGGElement; box: SVGPathElement; label: SVGTextElement; x: number }> = {};
KINDS.forEach(([k, label], i) => {
  const x = 20 + i * 65;
  const g = el('g', {}, sheetBody);
  const box = shape(g, 0.9); box.setAttribute('d', rr(x, 330, 60, 28, 14));
  const l = text(g, x + 30, 348, label, TYPE, 10, { anchor: 'middle', weight: 700 });
  chips[k] = { g, box, label: l, x: x + 30 };
});
const prompt = text(sheetBody, 180, 456, 'what happened today?', HAND, 20, { anchor: 'middle', fill: INK_SOFT });
const previewSlot = el('g', {}, sheetBody);
const tuckG = el('g', {}, sheetBody);
const tuckBox = paint(tuckG, CLAY_SOFT, 0.9); tuckBox.setAttribute('d', rr(24, 540, 312, 46, 10));
text(tuckG, 180, 568, 'TUCK IT IN', TYPE, 13, { anchor: 'middle', ls: 3, weight: 700, fill: PAPER });
const PREVIEW: [number, number] = [180, 448];

// toast
const toastBox = el('path', { d: rr(34, 563, 232, 30, 15), fill: INK }, toastG);
const toastText = text(toastG, 150, 582, '', TYPE, 10, { anchor: 'middle', weight: 700, fill: PAPER });
void toastBox;

// ---------------------------------------------------------------- scraps
interface Scrap {
  kind: Kind; g: SVGGElement; front: SVGGElement; back: SVGGElement; tape: SVGPathElement;
  update(u: number): void; prog: number; x: number; y: number; rot: number; s: number;
  slot: number; land: ReturnType<typeof spring>; flip: ReturnType<typeof spring>; flipped: boolean;
  fly?: { from: [number, number, number, number]; t: number };
}
const SIZE: Record<Kind, [number, number]> = { note: [104, 86], mood: [90, 94], spend: [80, 100], photo: [90, 106], todo: [90, 90] };

function scribble(y: number, x0: number, x1: number): string {
  let d = `M${f(x0)} ${f(y)}`, x = x0;
  while (x < x1) {
    const w = R(3.2, 5.2), h = R(4, 7.5);
    d += ` q${f(w * 0.3)} ${f(-h)} ${f(w * 0.55)} ${f(-h * 0.2)} q${f(w * 0.2)} ${f(h * 0.5)} ${f(w * 0.45)} ${f(h * 0.2)}`;
    x += w;
    if (R(0, 1) < 0.16) { x += 4.5; d += ` m4.5 0`; }
  }
  return d;
}

function makeScrap(kind: Kind): Scrap {
  const g = el('g', {}, flyLayer);
  const front = el('g', {}, g), back = el('g', { opacity: 0 }, g);
  const [w, h] = SIZE[kind];
  let update: (u: number) => void = () => {};
  if (kind === 'note') {
    shape(front, 1).setAttribute('d', rr(-w / 2, -h / 2, w, h, 3));
    pen(front, 0.4).setAttribute('d', [-22, -8, 6, 20, 34].map((y) => `M-44 ${y} L44 ${y}`).join(' '));
    paint(front, 'none', 0.7).setAttribute('d', 'M-36 -42 L-36 42');
    front.lastElementChild!.setAttribute('stroke', CLAY);
    const lines = [drawOn(pen(front, 1)), drawOn(pen(front, 1)), drawOn(pen(front, 1))];
    lines[0].setAttribute('d', scribble(-10, -30, 36)); lines[1].setAttribute('d', scribble(4, -30, 30)); lines[2].setAttribute('d', scribble(18, -30, 10));
    update = (u) => lines.forEach((l, i) => setDraw(l, (u - i * 0.3) / 0.4));
  } else if (kind === 'mood') {
    shape(front, 1).setAttribute('d', rr(-w / 2, -h / 2, w, h, 3));
    const sw = paint(front, BUTTER, 0.8); sw.setAttribute('d', rr(-37, -39, 74, 54, 2));
    const sun = drawOn(pen(front, 1.2)); sun.setAttribute('d', 'M-7 -12 a7 7 0 1 0 14 0 a7 7 0 1 0 -14 0');
    const rays = drawOn(pen(front, 1.1));
    rays.setAttribute('d', Array.from({ length: 8 }, (_, i) => { const a = (i / 8) * Math.PI * 2; return `M${f(Math.cos(a) * 11)} ${f(-12 + Math.sin(a) * 11)} L${f(Math.cos(a) * 15)} ${f(-12 + Math.sin(a) * 15)}`; }).join(' '));
    const word = text(front, 0, 36, 'sunny, proud', HAND, 16, { anchor: 'middle' });
    update = (u) => { sw.setAttribute('opacity', f(clamp(u * 3, 0, 1))); setDraw(sun, (u - 0.15) / 0.4); setDraw(rays, (u - 0.45) / 0.35); word.setAttribute('opacity', f(clamp((u - 0.7) / 0.3, 0, 1))); };
  } else if (kind === 'spend') {
    const id = `pp-print-${uid++}`;
    const cp = el('clipPath', { id }, defs);
    const cr = el('rect', { x: -60, y: -60, width: 120, height: 0 }, cp);
    const inner = el('g', { 'clip-path': `url(#${id})` }, front);
    let zig = `M-40 -50 L40 -50 L40 42`;
    for (let i = 0; i < 8; i++) zig += ` L${f(40 - (i + 0.5) * 10)} ${i % 2 ? 42 : 48}`;
    shape(inner, 1).setAttribute('d', zig + ' L-40 42Z');
    text(inner, 0, -34, '* RECEIPT *', TYPE, 8.5, { anchor: 'middle', weight: 700, ls: 1.5 });
    const dash = pen(inner, 0.5); dash.setAttribute('d', 'M-32 -25 L32 -25 M-32 11 L32 11'); dash.setAttribute('stroke-dasharray', '2 2');
    text(inner, -32, -10, 'lunch', TYPE, 10.5);
    text(inner, 32, -10, '12', TYPE, 10.5, { anchor: 'end' });
    text(inner, -32, 2, 'FOOD', TYPE, 7.5, { fill: INK_SOFT, ls: 1 });
    text(inner, -32, 28, 'TOTAL', TYPE, 10, { weight: 700 });
    text(inner, 32, 28, '$12', TYPE, 10, { anchor: 'end', weight: 700 });
    update = (u) => cr.setAttribute('height', f(12 + clamp(u, 0, 1) * 108));
  } else if (kind === 'photo') {
    shape(front, 1).setAttribute('d', rr(-w / 2, -h / 2, w, h, 2));
    const pic = paint(front, SKY, 0.6); pic.setAttribute('d', rr(-37, -45, 74, 66, 1));
    const sun = drawOn(pen(front, 1)); sun.setAttribute('d', 'M14 -30 a6 6 0 1 0 12 0 a6 6 0 1 0 -12 0');
    const hills = drawOn(pen(front, 1.2)); hills.setAttribute('d', 'M-37 16 L-17 -8 L-5 4 L9 -16 L37 12');
    const cap = text(front, 0, 43, 'lake walk', HAND, 15, { anchor: 'middle' });
    update = (u) => { pic.setAttribute('opacity', f(0.15 + 0.85 * ease(clamp(u * 1.4, 0, 1)))); setDraw(hills, (u - 0.2) / 0.45); setDraw(sun, (u - 0.55) / 0.3); cap.setAttribute('opacity', f(clamp((u - 0.75) / 0.25, 0, 1))); };
  } else {
    paint(front, STICKY, 0.9).setAttribute('d', 'M-45 -45 L45 -45 L45 31 L31 45 L-45 45Z');
    pen(front, 0.8).setAttribute('d', 'M45 31 L31 31 L31 45');
    shape(front, 1).setAttribute('d', rr(-33, -27, 15, 15, 3));
    text(front, -12, -14, 'water', HAND, 18);
    text(front, -12, 6, 'the fern', HAND, 18);
    const tick = drawOn(pen(front, 2)); tick.setAttribute('stroke', CLAY); tick.setAttribute('d', 'M-30 -20 L-26 -15 L-17 -28');
    const strike = drawOn(pen(front, 1)); strike.setAttribute('d', 'M-13 -19 L26 -21');
    update = (u) => { setDraw(tick, (u - 0.35) / 0.3); setDraw(strike, (u - 0.7) / 0.3); };
  }
  // the private back, lined paper
  shape(back, 1).setAttribute('d', rr(-w / 2, -h / 2, w, h, 3));
  pen(back, 0.4).setAttribute('d', Array.from({ length: Math.floor(h / 14) }, (_, i) => `M${f(-w / 2 + 6)} ${f(-h / 2 + 14 + i * 14)} L${f(w / 2 - 6)} ${f(-h / 2 + 14 + i * 14)}`).join(' '));
  text(back, 0, -6, 'thoughts on', HAND, 15, { anchor: 'middle', fill: INK_SOFT });
  text(back, 0, 10, 'the back stay', HAND, 15, { anchor: 'middle', fill: INK_SOFT });
  text(back, 0, 26, 'private', HAND, 15, { anchor: 'middle', fill: CLAY });
  const tape = paint(g, TAPES[uid % TAPES.length], 0.5);
  tape.setAttribute('d', rr(-17, -h / 2 - 6, 34, 12, 1.2));
  tape.setAttribute('opacity', '0');
  el('rect', { x: -w / 2, y: -h / 2, width: w, height: h, fill: 'transparent' }, g);
  const s: Scrap = { kind, g, front, back, tape, update, prog: 0, x: 0, y: 0, rot: 0, s: 1, slot: -1, land: spring(260, 13), flip: spring(90, 13), flipped: false };
  g.addEventListener('click', (e) => {
    if (s.slot < 0 || s.fly || view !== 'today') return;
    e.stopPropagation(); touched(); s.flipped = !s.flipped;
  });
  return s;
}
function placeScrap(s: Scrap): void {
  const flipX = Math.cos(Math.PI * clamp(s.flip.x, 0, 1));
  const sx = Math.max(0.02, Math.abs(flipX)), back = s.flip.x > 0.5;
  s.front.setAttribute('opacity', back ? '0' : '1'); s.back.setAttribute('opacity', back ? '1' : '0');
  const squash = 1 + s.land.x;
  s.g.setAttribute('transform', `translate(${f(s.x)} ${f(s.y)}) rotate(${f(s.rot)}) scale(${f(s.s * sx * (2 - squash))} ${f(s.s * squash)})`);
}

// ---------------------------------------------------------------- state
let view: 'today' | 'pockets' = 'today';
let sheetOpen = false;
let preview: Scrap | null = null;
let flying: Scrap | null = null;
const placed: Scrap[] = [];
let filing = -1, fileN = 0;
let toastT = -1;
let idle = 5, autoWait = 0.4, autoKind = 0;
const sheetS = spring(150, 19), viewS = spring(110, 17), bubbleX = spring(140, 18, 122), puff = spring(200, 9), pressPlus = spring(300, 16);

function toast(s: string): void { toastText.textContent = s; toastT = 0; }
function setCounter(): void { counter.textContent = placed.length ? `${placed.length} ${placed.length === 1 ? 'scrap' : 'scraps'} tucked in` : ''; emptyHint.setAttribute('opacity', placed.length ? '0' : '1'); }

function sheetA11y(): void {
  sheetG.setAttribute('aria-hidden', String(!sheetOpen));
  sheetG.querySelectorAll('[role="button"]').forEach((b) => b.setAttribute('tabindex', sheetOpen ? '0' : '-1'));
}
function openSheet(): void { if (view !== 'today' || flying || filing >= 0) return; pressPlus.kick(-4); sheetOpen = true; sheetA11y(); }
function closeSheet(): void { sheetOpen = false; chooseNone(); sheetA11y(); }
function chooseNone(): void { if (preview) { preview.g.remove(); preview = null; } paintChips(null); }
function choose(k: Kind): void {
  if (!sheetOpen) return;
  if (preview) preview.g.remove();
  preview = makeScrap(k); previewSlot.appendChild(preview.g);
  preview.x = PREVIEW[0]; preview.y = PREVIEW[1]; preview.s = 1.35;
  paintChips(k);
}
function paintChips(k: Kind | null): void {
  for (const [key] of KINDS) {
    const on = key === k, c = chips[key];
    c.box.setAttribute('fill', on ? INK : PAPER); c.box.classList.toggle('pp', !on);
    c.label.setAttribute('fill', on ? PAPER : 'currentColor');
  }
  prompt.setAttribute('opacity', k ? '0' : '1');
}
function tuck(): void {
  if (!preview || preview.prog < 0.55 || flying) return;
  const slot = SLOTS.findIndex((_, i) => !placed.some((p) => p.slot === i));
  if (slot < 0) { toast('Page full. Tap Pockets to file it'); return; }
  const s = preview; preview = null;
  const sheetY = (1 - sheetS.x) * 380;
  flyLayer.appendChild(s.g);
  s.slot = slot; s.prog = Math.max(s.prog, 0.55);
  s.fly = { from: [PREVIEW[0], PREVIEW[1] + sheetY, 0, 1.35], t: 0 };
  flying = s;
  sheetOpen = false; paintChips(null); sheetA11y();
}
function goPockets(): void {
  if (view === 'pockets' || flying || filing >= 0) return;
  closeSheet(); view = 'pockets';
  if (placed.length) { filing = 0; fileN = placed.length; filingLayer.appendChild(pageG); }
}
function goToday(): void { if (view === 'today' || filing >= 0) return; view = 'today'; }

// ---------------------------------------------------------------- touch: buttons, ripples, ghost taps
const ripples: Array<{ c: SVGCircleElement; dot: SVGCircleElement; t: number }> = [];
function ripple(x: number, y: number): void {
  const c = el('circle', { cx: f(x), cy: f(y), r: 6, fill: 'none', stroke: INK, 'stroke-width': 1.4 }, rippleG);
  const dot = el('circle', { cx: f(x), cy: f(y), r: 11, fill: INK, opacity: 0.16 }, rippleG);
  ripples.push({ c, dot, t: 0 });
}
function touched(): void { idle = 0; host!.classList.add('touched'); }
function button(g: SVGGElement, label: string, fn: () => void): void {
  g.setAttribute('role', 'button'); g.setAttribute('tabindex', '0'); g.setAttribute('aria-label', label);
  g.style.cursor = 'pointer';
  g.addEventListener('click', (e) => { e.stopPropagation(); touched(); fn(); });
  g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); touched(); fn(); } });
}
button(plusG, 'Tuck in a scrap', openSheet);
button(closeG, 'Close', closeSheet);
button(tuckG, 'Tuck it in', tuck);
for (const [k, label] of KINDS) button(chips[k].g, label, () => choose(k));
button(tabG.Today, 'Today', goToday);
button(tabG.Pockets, 'Pockets', goPockets);
for (const k of ['Desk', 'Board']) { tabG[k].style.cursor = 'default'; tabG[k].addEventListener('click', touched); }
scrim.addEventListener('click', () => { touched(); closeSheet(); });
svg.addEventListener('pointerdown', (e) => {
  const m = svg.getScreenCTM(); if (!m) return;
  const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
  if (p.x > 12 && p.x < W - 12 && p.y > 12 && p.y < H - 12) ripple(p.x, p.y);
  touched();
});

function ghost(x: number, y: number, fn: () => void): void { ripple(x, y); fn(); }
function autoStep(): void {
  if (view === 'pockets') { ghost(122, 578, goToday); autoWait = 1.4; return; }
  if (placed.length >= 4) { ghost(182, 578, goPockets); autoWait = 3.4; return; }
  if (!sheetOpen) { ghost(PLUS[0], PLUS[1], openSheet); autoWait = 0.9; return; }
  if (!preview) { const k = (['photo', 'note', 'todo', 'spend', 'mood'] as Kind[])[autoKind++ % 5]; ghost(chips[k].x, 344, () => choose(k)); autoWait = 1.6; return; }
  if (preview.prog >= 1) { ghost(180, 563, tuck); autoWait = 1.8; }
}

// ---------------------------------------------------------------- start with a lived-in page
for (const [k, slot] of [['photo', 0], ['note', 1]] as Array<[Kind, number]>) {
  const s = makeScrap(k); pageScraps.appendChild(s.g);
  s.update(1); s.prog = 1; s.slot = slot;
  [s.x, s.y, s.rot] = SLOTS[slot]; s.s = 0.86; s.tape.setAttribute('opacity', '1');
  placed.push(s); placeScrap(s);
}
setCounter();
paintChips(null);
sheetA11y();

// ---------------------------------------------------------------- the loop
let visible = true;
if ('IntersectionObserver' in window) new IntersectionObserver((en) => { visible = en[0].isIntersecting; }).observe(host);

function frame(t: number, dt: number): void {
  if (!visible && t > 0.1) return;
  idle += dt;

  // sheet and scrim
  const so = sheetS.step(sheetOpen ? 1 : 0, dt);
  move(sheetG, 0, (1 - so) * 380);
  scrim.setAttribute('opacity', f(clamp(so, 0, 1) * 0.16));
  scrim.setAttribute('pointer-events', so > 0.05 ? 'auto' : 'none');
  const pp = 1 + pressPlus.step(0, dt) * 0.02;
  plusG.setAttribute('transform', `translate(${PLUS[0]} ${PLUS[1]}) scale(${f(pp)}) translate(${-PLUS[0]} ${-PLUS[1]})`);

  // the scrap being made draws itself
  if (preview) {
    preview.prog = Math.min(1, preview.prog + dt / 1.1);
    preview.update(preview.prog); placeScrap(preview);
  }
  const ready = !!preview && preview.prog >= 0.55;
  tuckBox.setAttribute('fill', ready ? CLAY : CLAY_SOFT);

  // flying onto the page
  if (flying && flying.fly) {
    const s = flying, fl = s.fly!;
    fl.t += dt;
    if (s.prog < 1) { s.prog = Math.min(1, s.prog + dt / 1.1); s.update(s.prog); }
    const u = minJerk(clamp(fl.t / 0.75, 0, 1)), arc = Math.sin(Math.PI * u);
    const [tx, ty, tr] = SLOTS[s.slot];
    s.x = lerp(fl.from[0], tx, u); s.y = lerp(fl.from[1], ty, u) - arc * 70;
    s.rot = lerp(fl.from[2], tr, u) + arc * 14; s.s = lerp(fl.from[3], 0.86, u) + arc * 0.1;
    if (fl.t >= 0.75) {
      s.update(1); s.prog = 1; s.fly = undefined; flying = null;
      pageScraps.appendChild(s.g); s.land.kick(-2.6);
      placed.push(s); setCounter(); toast('Tucked into today’s page');
    }
    placeScrap(s);
  }
  for (const s of placed) {
    s.land.step(0, dt); s.flip.step(s.flipped ? 1 : 0, dt);
    if (s.land.x !== 0 || s.flip.x !== 0) placeScrap(s);
    const tOp = Number(s.tape.getAttribute('opacity'));
    if (tOp < 1) s.tape.setAttribute('opacity', f(Math.min(1, tOp + dt * 5)));
  }

  // switching screens
  const v = viewS.step(view === 'pockets' ? 1 : 0, dt);
  move(todayG, -v * 120, 0);
  move(pocketsG, (1 - v) * W, 0);
  const bx = bubbleX.step(view === 'pockets' ? 182 : 122, dt);
  bubble.setAttribute('d', rr(bx - 27, 554, 54, 48, 24));

  // filing the page into November
  const pz = puff.step(0, dt);
  const [nx, ny] = folderAt(NOV);
  novFront.setAttribute('transform', `translate(${f((1 - v) * W)} 0)`);
  novFront.setAttribute('opacity', f(v * v * v));
  novPuffG.setAttribute('transform', `translate(${nx} ${ny}) scale(${f(1 + pz * 0.08)} ${f(1 - pz * 0.04)}) translate(${-nx} ${-ny})`);
  if (filing >= 0) {
    filing += dt;
    const a = clamp(filing / 0.45, 0, 1), b = minJerk(clamp((filing - 0.45) / 0.8, 0, 1)), c = ease(clamp((filing - 1.25) / 0.3, 0, 1));
    const sc = lerp(1 - 0.08 * a, 0.16, b);
    const cx = lerp(180, nx, b), cy = lerp(324, ny - 16, b) + c * 18;
    pageG.setAttribute('transform', `translate(${f(cx)} ${f(cy)}) rotate(${f(-6 * b)}) scale(${f(sc)}) translate(-180 -324)`);
    pageG.setAttribute('opacity', f(1 - c));
    if (filing >= 1.55) {
      filing = -1; puff.kick(5); novCount += fileN; novLabel.textContent = String(novCount);
      toast('Filed in November’s pocket');
      for (const s of placed) s.g.remove();
      placed.length = 0; setCounter();
      pageG.removeAttribute('transform'); pageG.setAttribute('opacity', '1');
      todayG.appendChild(pageG);
    }
  }

  // toast
  if (toastT >= 0) {
    toastT += dt;
    const show = toastT < 0.25 ? ease(toastT / 0.25) : toastT < 1.9 ? 1 : 1 - ease((toastT - 1.9) / 0.3);
    toastG.setAttribute('opacity', f(show));
    toastG.setAttribute('transform', `translate(0 ${f((1 - show) * 14)})`);
    if (toastT > 2.2) toastT = -1;
  }

  // ripples: your fingertip on the glass
  for (let i = ripples.length - 1; i >= 0; i--) {
    const r = ripples[i]; r.t += dt;
    const u = clamp(r.t / 0.55, 0, 1);
    r.c.setAttribute('r', f(6 + 22 * ease(u))); r.c.setAttribute('opacity', f(1 - u));
    r.dot.setAttribute('r', f(11 * (1 - clamp(r.t / 0.3, 0, 1)) + 0.01));
    if (u >= 1) { r.c.remove(); r.dot.remove(); ripples.splice(i, 1); }
  }

  // left alone, it shows you around
  if (!reduce && idle > 5 && !flying && filing < 0 && (!preview || preview.prog >= 1)) {
    autoWait -= dt;
    if (autoWait <= 0) autoStep();
  }
}

// Same clock as the skill's run(), but it keeps responding to taps under reduced motion
// (only the self-playing demo is switched off there).
const q = new URLSearchParams(location.search);
if (q.has('debug')) {
  let t = 0;
  frame(t, 1 / 60);
  window.__step = (s = 1) => { for (let i = 0, n = Math.round(s * 60); i < n; i++) frame((t += 1 / 60), 1 / 60); return t; };
} else {
  const t0 = performance.now(); let prev = 0;
  // The self-playing demo moves only while the page scrolls: every pixel scrolled buys a little
  // animation time. Once you tap the phone it runs on real time until you leave it alone again.
  let budget = 0, lastY = scrollY;
  addEventListener('scroll', () => { budget = Math.min(budget + Math.abs(scrollY - lastY) * 0.009, 0.35); lastY = scrollY; }, { passive: true });
  const tick = (now: number) => {
    const t = (now - t0) / 1000, real = Math.min(0.05, t - prev); prev = t;
    let dt = real;
    if (!reduce && idle >= 5) { dt = Math.min(budget, real); budget -= dt; }
    frame(t, dt); requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

declare global { interface Window { __pocketPhone?: { state: () => object; plus: () => void; choose: (k: Kind) => void; tuck: () => void; pockets: () => void; today: () => void } } }
window.__pocketPhone = {
  state: () => ({ view, sheetOpen, placed: placed.length, flying: !!flying, filing, novCount, preview: preview?.prog ?? null, idle }),
  plus: openSheet, choose, tuck, pockets: goPockets, today: goToday,
};
