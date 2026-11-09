// The desk scene at the top of the page: an executive's day today (hands on keyboard,
// mouse and phone, a dozen apps) vs. with HandsFree (one way in: voice).
// Numbers come from HANDSFREE_CONFIG.day; set HANDSFREE_CONFIG.heroVideo to replace
// the drawing with a video.
(() => {
  "use strict";
  const host = document.getElementById("scene");
  const ICON = window.HFIcons;
  if (!host || !ICON) return;
  const cfg = window.HANDSFREE_CONFIG || {};
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // ---------- Video takes over if provided ----------
  if (cfg.heroVideo && cfg.heroVideo.src) {
    const v = cfg.heroVideo;
    host.innerHTML = `<div class="scene-stage scene-video"><video autoplay muted loop playsinline preload="metadata" src="${esc(v.src)}"${v.poster ? ` poster="${esc(v.poster)}"` : ""}></video></div>`;
    return;
  }

  const day = cfg.day || { apps: [], inputs: {}, appSwitches: 0 };
  const IN = Object.assign({ reading: 0, keyboard: 0, mouse: 0, phone: 0, voice: 0 }, day.inputs);
  const fmt = (m) => (m >= 60 ? `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m` : `${m}m`);
  const total = day.apps.reduce((s, a) => s + a.min, 0);
  const hands = IN.keyboard + IN.mouse + IN.phone;
  const ico = (name, x, y, s, cls = "") =>
    `<g class="sc-ico ${cls}" transform="translate(${x - s / 2} ${y - s / 2}) scale(${s / 24})">${ICON[name] || ""}</g>`;
  const svgIcon = (name) =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[name] || ""}</svg>`;

  const W = 1200, H = 720;

  // ---------- Laptop screen: screen time by app ----------
  function screen() {
    const apps = day.apps.slice(0, 8);
    const max = Math.max(...apps.map((a) => a.min), 1);
    let s = "";
    // window chrome + app tabs (the highlight jumps around: app switching)
    s += `<rect class="scr-bar" x="388" y="112" width="504" height="36" rx="6"/><rect class="scr-bar" x="388" y="130" width="504" height="18"/>`;
    s += [404, 418, 432].map((x) => `<circle class="dot" cx="${x}" cy="130" r="4.2"/>`).join("");
    s += `<rect class="tab-hl t-only" x="466" y="118" width="30" height="24" rx="6"/>`;
    apps.forEach((a, i) => { s += ico(a.icon, 481 + i * 36, 130, 14, "tab-ico"); });
    // header
    s += `<text class="scr-cap t-only" x="410" y="180">SCREEN TIME · TODAY</text>`;
    s += `<text class="scr-cap hf-only" x="410" y="180">SAME WORK · ONE WAY IN</text>`;
    s += `<text class="scr-big t-only" x="872" y="186" text-anchor="end">${fmt(total)}</text>`;
    s += `<g class="hf-only">${ico("mic", 766, 176, 22, "scr-mic")}<text class="scr-big scr-voice" x="872" y="186" text-anchor="end">Voice</text></g>`;
    // rows
    apps.forEach((a, i) => {
      const y = 222 + i * 27;
      const w = Math.max(8, (a.min / max) * 220);
      s += `<g class="row">${ico(a.icon, 418, y, 15, "row-ico")}` +
        `<text class="scr-t" x="436" y="${y + 4.5}">${esc(a.name)}</text>` +
        `<rect class="track" x="600" y="${y - 5}" width="220" height="10" rx="5"/>` +
        `<rect class="bar" x="600" y="${y - 5}" width="${w.toFixed(1)}" height="10" rx="5" style="transition-delay:${i * 60}ms"/>` +
        `<text class="scr-t scr-num" x="872" y="${y + 4.5}" text-anchor="end">${fmt(a.min)}</text></g>`;
    });
    // notifications that keep arriving
    const toast = (txt, icon, cls) =>
      `<g class="toast ${cls} t-only"><rect x="690" y="384" width="190" height="44" rx="10"/>${ico(icon, 712, 406, 16, "toast-ico")}<text class="scr-t" x="730" y="411">${txt}</text></g>`;
    s += toast("117 emails today", "mail", "toast-a") + toast("153 chat messages", "message", "toast-b");
    return s;
  }

  // ---------- External keyboard ----------
  function keyboard() {
    const top = 532, bot = 606, tl = 452, tr = 812, bl = 432, br = 832;
    let s = `<polygon class="kb" points="${tl},${top} ${tr},${top} ${br},${bot} ${bl},${bot}"/>`;
    const rows = [14, 13, 12, [1, 1, 1, 6, 1, 1, 1]];
    let i = 0;
    rows.forEach((row, r) => {
      const units = Array.isArray(row) ? row : Array(row).fill(1);
      const y = 540 + r * 16, h = 11.5, t = (y + h / 2 - top) / (bot - top);
      const L = tl + (bl - tl) * t + 12, R = tr + (br - tr) * t - 12, gap = 3;
      const unitW = (R - L - gap * (units.length - 1)) / units.reduce((a, b) => a + b, 0);
      let x = L;
      units.forEach((u) => {
        const w = unitW * u;
        const hit = (i * 7919) % 10 < 4;
        const st = hit ? ` style="animation-duration:${(1.1 + ((i * 31) % 15) / 10).toFixed(1)}s;animation-delay:-${((i * 17) % 23) / 10}s"` : "";
        s += `<rect class="key${hit ? " hit" : ""}" x="${x.toFixed(1)}" y="${y}" width="${w.toFixed(1)}" height="${h}" rx="2.5"${st}/>`;
        x += w + gap; i++;
      });
    });
    return s;
  }

  // ---------- Mouse ----------
  const mouse = () =>
    `<g class="mouse"><g class="mouse-move">` +
    `<ellipse class="kb" cx="0" cy="0" rx="22" ry="31"/>` +
    `<path class="click" d="M0,-30 C-12,-30 -21,-20 -21.5,-7 L0,-7 Z"/>` +
    `<line class="seam" x1="0" y1="-30" x2="0" y2="-7"/><rect class="wheel" x="-2.5" y="-23" width="5" height="10" rx="2.5"/>` +
    `</g></g>`;

  // ---------- Phone lying on the desk ----------
  const phone = () =>
    `<g class="phone"><g class="phone-buzz">` +
    `<rect class="ph-body" x="-31" y="-57" width="62" height="114" rx="11"/>` +
    `<rect class="ph-screen" x="-27" y="-51" width="54" height="102" rx="7"/>` +
    `<rect class="bub" x="-22" y="-44" width="30" height="9" rx="4.5"/><rect class="bub me" x="-6" y="-31" width="28" height="9" rx="4.5"/><rect class="bub" x="-22" y="-18" width="22" height="9" rx="4.5"/>` +
    `<g class="typing"><circle cx="-16" cy="-1" r="2"/><circle cx="-10" cy="-1" r="2"/><circle cx="-4" cy="-1" r="2"/></g>` +
    [0, 1, 2].map((r) => Array.from({ length: 6 }, (_, c) => `<rect class="ph-key" x="${-23 + c * 7.8}" y="${12 + r * 10}" width="6" height="7.5" rx="1.5"/>`).join("")).join("") +
    `</g><circle class="badge" cx="27" cy="-53" r="8"/></g>`;

  // ---------- The executive, seen from behind ----------
  const person = () => {
    // arms first (the head and back sit in front of them)
    const armL = `<g class="arm t-only"><path class="sleeve" d="M262 700 Q 400 640 512 596"/><ellipse class="skin" cx="522" cy="590" rx="19" ry="10.5" transform="rotate(-18 522 590)"/></g>`;
    const armRk = `<g class="arm arm-kbd t-only"><path class="sleeve" d="M470 700 Q 600 650 690 596"/><ellipse class="skin" cx="700" cy="590" rx="19" ry="10.5" transform="rotate(-24 700 590)"/></g>`;
    const armRm = `<g class="arm arm-mouse t-only"><path class="sleeve" d="M470 700 Q 720 670 884 600"/><g class="mouse-move-hand"><ellipse class="skin" cx="900" cy="584" rx="18" ry="11" transform="rotate(-30 900 584)"/></g></g>`;
    return armL + armRk + armRm +
      `<rect class="skin" x="340" y="636" width="40" height="54" rx="12"/>` +
      `<path class="suit" d="M150 720 C 168 690 214 676 300 668 L 420 668 C 506 676 552 690 570 720 Z"/>` +
      `<path class="shirt" d="M314 675 C 334 662 386 662 406 675 L 403 684 C 386 673 334 673 317 684 Z"/>` +
      `<ellipse class="skin" cx="309" cy="612" rx="8" ry="13"/><ellipse class="skin" cx="411" cy="612" rx="8" ry="13"/>` +
      `<ellipse class="skin" cx="360" cy="606" rx="50" ry="56"/>` +
      `<path class="hair" d="M308 630 C 298 572 320 546 360 544 C 400 546 422 572 412 630 C 410 645 392 653 360 654 C 328 653 310 645 308 630 Z"/>` +
      `<rect class="chair" x="226" y="694" width="268" height="44" rx="20"/>`;
  };

  // ---------- HandsFree layer: voice going to the screen ----------
  const waves = () => {
    const cx = 392, cy = 566;
    const arc = (r, i) => {
      const a0 = (-78 * Math.PI) / 180, a1 = (-28 * Math.PI) / 180;
      const x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0), x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
      return `<path class="wave" style="animation-delay:${i * 0.35}s" d="M${x0.toFixed(1)} ${y0.toFixed(1)} A ${r} ${r} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)}"/>`;
    };
    return `<g class="hf-only waves">${[46, 74, 102].map(arc).join("")}</g>`;
  };

  // ---------- Callouts: how the day is spent, by input ----------
  const CARD_W = 204, CARD_H = 80;
  const CALLOUTS = [
    { k: "reading", icon: "eye", label: "Reading screens", today: IN.reading, hf: "Or listen", x: 36, y: 60, to: [388, 214] },
    { k: "voice", icon: "mic", label: "Voice commands", today: IN.voice, hf: "Everything", x: 36, y: 222, to: [330, 566], hi: true },
    { k: "phone", icon: "phone", label: "Phone typing", today: IN.phone, hf: "0m", x: 36, y: 384, to: [168, 486] },
    { k: "switch", icon: "shuffle", label: "App switches", todayText: `~${Number(day.appSwitches || 0).toLocaleString("en-US")}`, hf: "None", x: 960, y: 60, to: [700, 130] },
    { k: "mouse", icon: "mouse", label: "Mouse", today: IN.mouse, hf: "0m", x: 960, y: 318, to: [904, 540] },
    { k: "keyboard", icon: "keyboard", label: "Keyboard", today: IN.keyboard, hf: "0m", x: 760, y: 626, to: [790, 606] },
  ];
  function edge(c) {
    const cx = c.x + CARD_W / 2, cy = c.y + CARD_H / 2, [tx, ty] = c.to;
    const dx = tx - cx, dy = ty - cy;
    const s = Math.min(Math.abs((CARD_W / 2) / (dx || 1e-6)), Math.abs((CARD_H / 2) / (dy || 1e-6)));
    return [cx + dx * s, cy + dy * s];
  }
  const leaders = CALLOUTS.map((c) => {
    const [x, y] = edge(c);
    return `<g class="leader l-${c.k}"><line x1="${x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${c.to[0]}" y2="${c.to[1]}"/><circle cx="${c.to[0]}" cy="${c.to[1]}" r="4"/></g>`;
  }).join("");

  const cards = CALLOUTS.map((c) =>
    `<div class="callout c-${c.k}${c.hi ? " c-hi" : ""}" style="left:${(c.x / W) * 100}%;top:${(c.y / H) * 100}%">` +
    `<div class="c-head">${svgIcon(c.icon)}<span>${c.label}</span></div>` +
    `<div class="c-val"><span class="v-today"${c.today != null ? ` data-min="${c.today}"` : ""}>${c.todayText || fmt(c.today)}</span><span class="v-hf">${c.hf}</span></div>` +
    `</div>`).join("");

  // ---------- Assemble ----------
  const svg =
    `<svg class="scene-svg" viewBox="0 0 ${W} ${H}" aria-hidden="true">` +
    `<defs><radialGradient id="sc-glow" cx="50%" cy="40%" r="60%"><stop offset="0" class="glow-in"/><stop offset="1" class="glow-out"/></radialGradient></defs>` +
    `<rect class="wall" width="${W}" height="${H}"/><ellipse cx="640" cy="300" rx="520" ry="330" fill="url(#sc-glow)"/>` +
    `<polygon class="desk" points="150,470 1050,470 1200,${H} 0,${H}"/><polygon class="desk-lip" points="150,470 1050,470 1053,476 147,476"/>` +
    // laptop
    `<rect class="bezel" x="372" y="96" width="536" height="360" rx="16"/>` +
    `<rect class="scr" x="388" y="112" width="504" height="328" rx="6"/>` + screen() +
    `<rect class="scr-glow hf-only" x="385" y="109" width="510" height="334" rx="8"/>` +
    `<polygon class="metal" points="360,452 920,452 962,488 318,488"/><polygon class="metal-dark" points="318,488 962,488 956,496 324,496"/>` +
    `<g class="gear">${keyboard()}<g transform="translate(905 572)">${mouse()}</g><g transform="translate(176 532) rotate(-16)">${phone()}</g></g>` +
    leaders + person() + waves() +
    `</svg>`;

  host.innerHTML =
    `<div class="scene-stage">${svg}<div class="callouts">${cards}</div></div>` +
    `<div class="scene-bar">` +
    `<div class="toggle scene-toggle" role="group" aria-label="Compare">` +
    `<button type="button" data-set="today" aria-pressed="true"><span>Today</span><i class="prog"></i></button>` +
    `<button type="button" data-set="hf" aria-pressed="false"><span>With HandsFree</span><i class="prog"></i></button></div>` +
    `<p class="scene-sum"><span class="t-only">Hands on keyboard, mouse and phone: <strong>${fmt(hands)}</strong> a day.</span>` +
    `<span class="hf-only">Hands: <strong>0m</strong>. One way in: you speak, it works. Speaking is about 3× faster than typing.</span></p>` +
    `</div>`;

  const stage = host.querySelector(".scene-stage");
  const svgEl = host.querySelector(".scene-svg");
  host.setAttribute("aria-label", `An illustrative executive day: ${fmt(total)} on screen across ${day.apps.length} apps; ${fmt(IN.keyboard)} on the keyboard, ${fmt(IN.mouse)} on the mouse, ${fmt(IN.reading)} reading, ${fmt(IN.phone)} typing on the phone, and ${fmt(IN.voice)} of voice commands.`);

  // Narrow screens: crop to the desk, and the callouts drop below as a grid.
  const fit = () => {
    const narrow = stage.clientWidth < 720;
    svgEl.setAttribute("viewBox", narrow ? "120 70 900 650" : `0 0 ${W} ${H}`);
    stage.classList.toggle("narrow", narrow);
  };
  fit();
  if ("ResizeObserver" in window) new ResizeObserver(fit).observe(stage); else window.addEventListener("resize", fit);

  // ---------- Modes ----------
  const buttons = host.querySelectorAll("[data-set]");
  const setMode = (mode) => {
    host.dataset.mode = mode;
    buttons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.set === mode)));
  };
  setMode("today");

  // Count the numbers up the first time the scene is seen, then cycle Today ↔ HandsFree.
  const countUp = () => {
    host.classList.add("shown");
    if (reduce) return;
    host.querySelectorAll(".v-today[data-min]").forEach((el) => {
      const end = Number(el.dataset.min), t0 = performance.now(), dur = 1400;
      const tick = (t) => {
        const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3);
        el.textContent = fmt(Math.round(end * e));
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  };

  const DUR = { today: 9000, hf: 6500 };
  let timer = null, auto = !reduce, visible = false;
  const schedule = () => {
    clearTimeout(timer);
    if (!auto || !visible) { host.classList.remove("auto"); return; }
    host.classList.add("auto");
    const mode = host.dataset.mode;
    host.style.setProperty("--cycle", `${DUR[mode]}ms`);
    // restart the progress bar animation on the active button
    host.querySelectorAll(".prog").forEach((p) => { p.style.animation = "none"; void p.offsetWidth; p.style.animation = ""; });
    timer = setTimeout(() => { setMode(mode === "today" ? "hf" : "today"); schedule(); }, DUR[mode]);
  };
  buttons.forEach((b) => b.addEventListener("click", () => { auto = false; schedule(); setMode(b.dataset.set); }));

  if ("IntersectionObserver" in window) {
    let first = true;
    new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        visible = en.isIntersecting;
        if (visible && first) { first = false; countUp(); }
        schedule();
      });
    }, { threshold: 0.35 }).observe(host);
  } else { countUp(); }
})();
