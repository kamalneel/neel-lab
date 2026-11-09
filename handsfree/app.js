(() => {
  "use strict";
  const cfg = window.HANDSFREE_CONFIG || {};
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---------- Icons (Lucide, ISC licence; "mouth" is our own) ----------
  const ICON = {
    eye: '<path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/>',
    ear: '<path d="M6 8.5a6.5 6.5 0 1 1 13 0c0 6-6 6-6 10a3.5 3.5 0 1 1-7 0"/><path d="M15 8.5a2.5 2.5 0 0 0-5 0v1a2 2 0 1 1 0 4"/>',
    mouth: '<path d="M3 11.5c2.6-2.4 5.6-3 9-1.4 3.4-1.6 6.4-1 9 1.4-2.3 4.4-5.4 6.5-9 6.5s-6.7-2.1-9-6.5Z"/><path d="M3 11.5c5.5 1.8 12.5 1.8 18 0"/>',
    hand: '<path d="M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2"/><path d="M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2"/><path d="M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/>',
    mic: '<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/>',
    keyboard: '<path d="M10 8h.01"/><path d="M12 12h.01"/><path d="M14 8h.01"/><path d="M16 12h.01"/><path d="M18 8h.01"/><path d="M6 8h.01"/><path d="M7 16h10"/><path d="M8 12h.01"/><rect width="20" height="16" x="2" y="4" rx="2"/>',
    mouse: '<rect x="5" y="2" width="14" height="20" rx="7"/><path d="M12 6v4"/>',
    phone: '<rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/>',
    mail: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
    calendar: '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>',
    file: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
    message: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    video: '<path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5"/><rect x="2" y="6" width="14" height="12" rx="2"/>',
    sparkles: '<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/><path d="M20 3v4"/><path d="M22 5h-4"/><path d="M4 17v2"/><path d="M5 18H3"/>',
    play: '<path d="M6 4l14 8-14 8z" fill="currentColor" stroke="none"/>',
  };
  const svgIcon = (name) =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[name]}</svg>`;
  const icoAt = (name, x, y, s) =>
    `<g class="ico" transform="translate(${x - s / 2} ${y - s / 2}) scale(${s / 24})">${ICON[name]}</g>`;
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  document.querySelectorAll("[data-icon]").forEach((el) => { el.innerHTML = svgIcon(el.dataset.icon); });

  // ---------- Diagram model ----------
  const SENSES = [
    { id: "eyes", icon: "eye", label: "Eyes", verb: "see" },
    { id: "ears", icon: "ear", label: "Ears", verb: "listen" },
    { id: "mouth", icon: "mouth", label: "Mouth", verb: "speak" },
    { id: "hands", icon: "hand", label: "Hands" },
  ];
  const DEVICES = [
    { id: "talk", icon: "mic", label: "Talk", from: "mouth" },
    { id: "type", icon: "keyboard", label: "Type", from: "hands" },
    { id: "click", icon: "mouse", label: "Click", from: "hands" },
    { id: "tap", icon: "phone", label: "Tap", from: "hands" },
  ];
  const APPS = [
    { id: "email", icon: "mail", label: "Email", short: "Email" },
    { id: "calendar", icon: "calendar", label: "Calendar", short: "Calendar" },
    { id: "docs", icon: "file", label: "Documents", short: "Docs" },
    { id: "messages", icon: "message", label: "Messages", short: "Messages" },
    { id: "meetings", icon: "video", label: "Meetings", short: "Meetings" },
    { id: "ai", icon: "sparkles", label: "AI assistant", short: "AI chat" },
  ];
  const ALL = APPS.map((a) => a.id);
  // Today: which apps each way-in reaches, and how answers come back.
  const REACH = { type: ALL, click: ALL, tap: ["email", "calendar", "messages", "meetings"], talk: ["ai"] };
  const BACK = { eyes: ALL, ears: ["messages", "meetings", "ai"] };

  function layout(o) {
    const L = { o, sense: {}, dev: {}, app: {} };
    if (o === "h") {
      Object.assign(L, { W: 1000, H: 600, r: 30, devW: 150, devH: 52, appW: 190, appH: 56 });
      const sy = { eyes: 100, ears: 214, mouth: 328, hands: 490 };
      SENSES.forEach((s) => (L.sense[s.id] = { x: 92, y: sy[s.id] }));
      const dy = { talk: 114, type: 260, click: 370, tap: 480 };
      DEVICES.forEach((d) => (L.dev[d.id] = { x: 455, y: dy[d.id] }));
      APPS.forEach((a, i) => (L.app[a.id] = { x: 885, y: 72 + i * 96 }));
      L.layer = { x0: 385, x1: 535, y0: 52, y1: 576 };
      L.caps = [
        { x: 92, y: 22, t: "You", a: "middle" },
        { x: 455, y: 22, t: "Many ways in", a: "middle", g: "today" },
        { x: 460, y: 22, t: "One layer", a: "middle", g: "hf" },
        { x: 885, y: 22, t: "Your work", a: "middle" },
      ];
      L.senseOut = (s) => ({ x: s.x + L.r + 2, y: s.y });
      L.devIn = (d) => ({ x: d.x - L.devW / 2, y: d.y });
      L.devOut = (d) => ({ x: d.x + L.devW / 2, y: d.y });
      L.appIn = (a) => ({ x: a.x - L.appW / 2, y: a.y });
      L.layerIn = (p) => ({ x: L.layer.x0, y: Math.min(Math.max(p.y, L.layer.y0 + 30), L.layer.y1 - 30) });
      L.layerOut = (a) => ({ x: L.layer.x1, y: a.y });
    } else {
      Object.assign(L, { W: 400, H: 700, r: 26, devW: 84, devH: 46, appW: 56, appH: 56 });
      const sx = { eyes: 52, ears: 136, mouth: 220, hands: 340 };
      SENSES.forEach((s) => (L.sense[s.id] = { x: sx[s.id], y: 74 }));
      const dx = { talk: 53, type: 151, click: 249, tap: 347 };
      DEVICES.forEach((d) => (L.dev[d.id] = { x: dx[d.id], y: 330 }));
      APPS.forEach((a, i) => (L.app[a.id] = { x: 40 + i * 64, y: 596 }));
      L.layer = { x0: 12, x1: 388, y0: 300, y1: 360 };
      L.caps = [
        { x: 200, y: 20, t: "You", a: "middle" },
        { x: 200, y: 280, t: "Many ways in", a: "middle", g: "today" },
        { x: 200, y: 690, t: "Your work", a: "middle" },
      ];
      L.senseOut = (s) => ({ x: s.x, y: s.y + L.r + 32 });
      L.devIn = (d) => ({ x: d.x, y: d.y - L.devH / 2 });
      L.devOut = (d) => ({ x: d.x, y: d.y + L.devH / 2 });
      L.appIn = (a) => ({ x: a.x, y: a.y - L.appH / 2 });
      L.layerIn = (p) => ({ x: p.x, y: L.layer.y0 });
      L.layerOut = (a) => ({ x: a.x, y: L.layer.y1 });
    }
    return L;
  }

  const curve = (a, b, o) => {
    if (o === "h") {
      const m = (b.x - a.x) / 2;
      return `M${a.x} ${a.y}C${a.x + m} ${a.y} ${b.x - m} ${b.y} ${b.x} ${b.y}`;
    }
    const m = (b.y - a.y) / 2;
    return `M${a.x} ${a.y}C${a.x} ${a.y + m} ${b.x} ${b.y - m} ${b.x} ${b.y}`;
  };
  const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }); // exact t=.5 point of the curves above

  let wireCount = 0;
  function wire(d, kind, flowKind) {
    const i = wireCount++;
    // Today's flows run at uneven speeds (it should feel busy); HandsFree's run in step.
    const style = flowKind === "f-hf" ? "" :
      ` style="animation-duration:${(1.1 + ((i * 37) % 10) * 0.16).toFixed(2)}s;animation-delay:-${(((i * 53) % 17) / 10).toFixed(1)}s"`;
    return `<path class="wire ${kind}" d="${d}"/>` + (reduceMotion ? "" : `<path class="flow ${flowKind}" d="${d}"${style}/>`);
  }
  function pill(x, y, text, cls = "") {
    const w = text.length * 7.6 + 22, h = 26;
    return `<g class="pill ${cls}"><rect x="${x - w / 2}" y="${y - h / 2}" width="${w}" height="${h}" rx="13"/><text x="${x}" y="${y + 4.5}" text-anchor="middle">${esc(text)}</text></g>`;
  }

  function render(svg, o) {
    const L = layout(o);
    wireCount = 0;
    let today = "", hf = "", nodes = "", captions = "";

    // --- Today: hands and voice go through devices; answers come back by sight and sound.
    let tw = "";
    DEVICES.forEach((d) => {
      const from = L.senseOut(L.sense[d.from]);
      tw += wire(curve(from, L.devIn(L.dev[d.id]), o), d.from === "hands" ? "w-hand" : "w-in", d.from === "hands" ? "f-hand" : "f-in");
      REACH[d.id].forEach((a) => { tw += wire(curve(L.devOut(L.dev[d.id]), L.appIn(L.app[a]), o), "w-in", "f-in"); });
    });
    Object.entries(BACK).forEach(([s, apps]) => {
      apps.forEach((a) => { tw += wire(curve(L.appIn(L.app[a]), L.senseOut(L.sense[s]), o), "w-out", "f-in"); });
    });
    today += tw;
    DEVICES.forEach((d) => {
      const p = L.dev[d.id], w = L.devW, h = L.devH;
      const iconX = o === "h" ? p.x - w / 2 + 30 : p.x - w / 2 + 20;
      const textX = o === "h" ? p.x - w / 2 + 54 : p.x - w / 2 + 36;
      today += `<g class="dev"><rect class="node" x="${p.x - w / 2}" y="${p.y - h / 2}" width="${w}" height="${h}" rx="${h / 2}"/>${icoAt(d.icon, iconX, p.y, o === "h" ? 22 : 18)}<text class="lbl" x="${textX}" y="${p.y + 5.5}">${d.label}</text></g>`;
    });
    const talk = L.dev.talk;
    today += o === "h"
      ? `<text class="lbl-sm" x="${talk.x}" y="${talk.y + 46}" text-anchor="middle">only in a few apps</text>`
      : "";

    // --- HandsFree: eyes, ears and mouth talk to one layer; the layer talks to every app.
    ["eyes", "ears", "mouth"].forEach((sid) => {
      const s = L.senseOut(L.sense[sid]);
      const l = L.layerIn(s);
      // Flow direction: we speak into the layer; we see and hear what comes back.
      hf += wire(sid === "mouth" ? curve(s, l, o) : curve(l, s, o), "w-hf", "f-hf");
    });
    APPS.forEach((a) => { hf += wire(curve(L.layerOut(L.app[a.id]), L.appIn(L.app[a.id]), o), "w-hf", "f-hf"); });
    const ly = L.layer;
    const lcx = (ly.x0 + ly.x1) / 2, lcy = (ly.y0 + ly.y1) / 2;
    hf += `<g class="layer"><rect x="${ly.x0}" y="${ly.y0}" width="${ly.x1 - ly.x0}" height="${ly.y1 - ly.y0}" rx="${o === "h" ? 28 : 20}"/>` +
      `<text class="layer-name" x="${lcx}" y="${lcy + (o === "h" ? 2 : 0)}" text-anchor="middle">HandsFree</text>` +
      `<text class="layer-sub" x="${lcx}" y="${lcy + (o === "h" ? 24 : 20)}" text-anchor="middle">one layer for every app</text></g>`;
    ["eyes", "ears", "mouth"].forEach((sid) => {
      const s = L.senseOut(L.sense[sid]);
      const m = mid(s, L.layerIn(s));
      hf += pill(m.x, m.y, SENSES.find((x) => x.id === sid).verb);
    });
    const hands = L.sense.hands;
    hf += o === "h" ? pill(hands.x + 76, hands.y, "free") : pill(hands.x, hands.y + 92, "free");

    // --- Shared nodes: you, and your work.
    SENSES.forEach((s) => {
      const p = L.sense[s.id];
      nodes += `<g class="sense s-${s.id}"><circle cx="${p.x}" cy="${p.y}" r="${L.r}"/>${icoAt(s.icon, p.x, p.y, o === "h" ? 26 : 22)}` +
        `<text class="lbl" x="${p.x}" y="${p.y + L.r + 22}" text-anchor="middle">${s.label}</text></g>`;
    });
    APPS.forEach((a) => {
      const p = L.app[a.id], w = L.appW, h = L.appH;
      if (o === "h") {
        nodes += `<g class="app"><rect class="node" x="${p.x - w / 2}" y="${p.y - h / 2}" width="${w}" height="${h}" rx="14"/>${icoAt(a.icon, p.x - w / 2 + 30, p.y, 22)}<text class="lbl" x="${p.x - w / 2 + 54}" y="${p.y + 5.5}">${a.label}</text></g>`;
      } else {
        nodes += `<g class="app"><rect class="node" x="${p.x - w / 2}" y="${p.y - h / 2}" width="${w}" height="${h}" rx="14"/>${icoAt(a.icon, p.x, p.y, 24)}<text class="lbl-sm" x="${p.x}" y="${p.y + h / 2 + 20}" text-anchor="middle">${a.short}</text></g>`;
      }
    });
    L.caps.forEach((c) => {
      const t = `<text class="cap" x="${c.x}" y="${c.y}" text-anchor="${c.a}">${c.t}</text>`;
      if (c.g === "today") today += t; else if (c.g === "hf") hf += t; else captions += t;
    });

    svg.setAttribute("viewBox", `0 0 ${L.W} ${L.H}`);
    svg.classList.toggle("o-h", o === "h");
    svg.classList.toggle("o-v", o === "v");
    svg.innerHTML = `<g class="g-today">${today}</g><g class="g-hf">${hf}</g>${nodes}${captions}`;
  }

  document.querySelectorAll(".diagram").forEach((fig) => {
    const svg = fig.querySelector("svg");
    const labels = {
      today: "Today: your hands go through a keyboard, mouse and touchscreen to reach every app. Voice reaches only an AI assistant. Answers come back as screens and alerts.",
      hf: "With HandsFree: you see, speak and listen to one layer, and that layer works with every app. Your hands are free.",
    };
    const setMode = (mode) => {
      fig.dataset.mode = mode;
      svg.classList.toggle("mode-today", mode === "today");
      svg.classList.toggle("mode-hf", mode === "hf");
      svg.setAttribute("aria-label", labels[mode]);
      fig.querySelectorAll("[data-set]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.set === mode)));
      const cap = fig.querySelector("figcaption");
      if (cap && fig.hasAttribute("data-toggle")) {
        cap.textContent = mode === "hf"
          ? "With HandsFree: one way in, for everything. Your hands are free."
          : "Today: four ways in, a mix of ways back, and a different deal with every app.";
      }
    };
    let orient = null;
    const fit = () => {
      const o = fig.clientWidth < 760 ? "v" : "h";
      if (o !== orient) { orient = o; render(svg, o); }
    };
    fit();
    setMode(fig.dataset.mode || "today");
    if ("ResizeObserver" in window) new ResizeObserver(fit).observe(fig);
    else window.addEventListener("resize", fit);
    fig.querySelectorAll("[data-set]").forEach((b) => b.addEventListener("click", () => setMode(b.dataset.set)));
  });

  // ---------- Videos ----------
  const videos = document.getElementById("videos");
  if (videos) {
    const list = Array.isArray(cfg.videos) ? cfg.videos : [];
    if (!list.length) {
      videos.innerHTML = `<div class="video-frame video-empty"><div><div class="play" style="margin:0 auto 14px">${svgIcon("play")}</div><p>The first video is on its way.</p></div></div>`;
    } else {
      videos.innerHTML = list.map((v, i) => {
        const title = esc(v.title || "");
        let inner = "";
        if (v.youtubeId) {
          const id = encodeURIComponent(v.youtubeId);
          inner = `<button class="yt" data-yt="${id}" aria-label="Play: ${title}" style="background-image:url('https://i.ytimg.com/vi/${id}/hqdefault.jpg')"><span class="play">${svgIcon("play")}</span></button>`;
        } else if (v.src) {
          inner = `<video controls preload="metadata" src="${esc(v.src)}"${v.poster ? ` poster="${esc(v.poster)}"` : ""}></video>`;
        }
        return `<figure class="video-card" data-i="${i}"><div class="video-frame">${inner}</div>${title ? `<figcaption>${title}</figcaption>` : ""}</figure>`;
      }).join("");
      videos.addEventListener("click", (e) => {
        const b = e.target.closest("[data-yt]");
        if (!b) return;
        const f = document.createElement("iframe");
        f.src = `https://www.youtube-nocookie.com/embed/${b.dataset.yt}?autoplay=1&rel=0`;
        f.title = b.getAttribute("aria-label").replace(/^Play: /, "");
        f.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen";
        f.allowFullscreen = true;
        b.replaceWith(f);
      });
    }
  }

  // ---------- Early build ----------
  const form = document.getElementById("join-form");
  const early = document.getElementById("early-action");
  if (early) {
    const dl = cfg.download;
    if (dl && dl.url) {
      early.innerHTML = `<a class="btn btn-primary" href="${esc(dl.url)}">${esc(dl.label || "Download HandsFree")}</a>${dl.note ? `<p class="note">${esc(dl.note)}</p>` : ""}`;
    } else {
      early.innerHTML = `<div class="early-soon"><span class="dot" aria-hidden="true"></span><span>Not out yet. Ask for it, and you’ll get the download as soon as it’s ready.</span></div>` +
        `<p style="margin-top:16px"><button type="button" class="btn btn-primary" id="ask-early">Ask for the early build</button></p>`;
      document.getElementById("ask-early").addEventListener("click", () => {
        const box = form.querySelector('input[value="try"]');
        box.checked = true;
        form.querySelector('input[name="name"]').focus({ preventScroll: true });
        form.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
      });
    }
  }

  // ---------- Get involved form ----------
  if (form) {
    const status = form.querySelector(".form-status");
    const button = form.querySelector('button[type="submit"]');
    const say = (msg, ok = false) => { status.textContent = msg; status.classList.toggle("ok", ok); };
    const LABELS = { try: "Try it", share: "Share how I work", build: "Build with you" };

    form.addEventListener("input", (e) => e.target.removeAttribute("aria-invalid"));
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const name = String(fd.get("name") || "").trim();
      const email = String(fd.get("email") || "").trim();
      const nameEl = form.elements.name, emailEl = form.elements.email;
      if (fd.get("company")) { form.reset(); say("Thanks. You’re on the list.", true); return; }
      if (!name) { nameEl.setAttribute("aria-invalid", "true"); nameEl.focus(); say("Please add your name."); return; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { emailEl.setAttribute("aria-invalid", "true"); emailEl.focus(); say("Please add a valid email."); return; }

      const payload = { name, email, interests: fd.getAll("interests"), note: String(fd.get("note") || "").trim(), source: location.href };
      const first = name.split(/\s+/)[0];

      if (cfg.signupEndpoint) {
        button.disabled = true; say("Sending…");
        try {
          const r = await fetch(cfg.signupEndpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
          if (!r.ok) throw new Error(String(r.status));
          form.reset();
          say(`Thanks, ${first}. You’re on the list.`, true);
        } catch {
          say("That didn’t go through. Please try again in a minute.");
        } finally {
          button.disabled = false;
        }
      } else if (cfg.contactEmail) {
        const body = `Name: ${name}\nEmail: ${email}\nI'd like to: ${payload.interests.map((i) => LABELS[i]).join(", ") || "(not sure yet)"}\n\n${payload.note}`;
        location.href = `mailto:${cfg.contactEmail}?subject=${encodeURIComponent("HandsFree: count me in")}&body=${encodeURIComponent(body)}`;
        say("Your email app should open with this filled in. Hit send and you’re in.", true);
      } else {
        say("Sign-ups aren’t switched on yet. This is a draft of the site.");
      }
    });
  }

  // ---------- Footer GitHub (only once public) ----------
  const gh = document.getElementById("github-link");
  if (gh && cfg.githubUrl) { gh.href = cfg.githubUrl; gh.hidden = false; }

  // ---------- Reveal on scroll ----------
  const items = document.querySelectorAll(".reveal");
  if (!("IntersectionObserver" in window) || reduceMotion) {
    items.forEach((el) => el.classList.add("in"));
  } else {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
    items.forEach((el) => io.observe(el));
  }
})();
