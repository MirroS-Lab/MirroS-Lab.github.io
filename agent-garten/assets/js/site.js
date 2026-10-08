// Shared playback policy for decorative videos, including the detached atlas decoder.
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
let motionPaused = reducedMotion.matches;
const watchedVideos = new Map();

function syncVideo(video, visible) {
  if (visible && !motionPaused && !document.hidden) {
    if (!video.getAttribute("src") && video.dataset.src) video.src = video.dataset.src;
    video.play().catch(() => {}); // Posters remain available if autoplay or decoding fails.
  } else {
    video.pause();
  }
}

const visibility = new IntersectionObserver((entries) => {
  for (const { target, isIntersecting } of entries) {
    const entry = watchedVideos.get(target);
    entry.visible = isIntersecting;
    syncVideo(entry.video, isIntersecting);
  }
}, { threshold: 0.15 });

function watchVideo(video, target = video) {
  watchedVideos.set(target, { video, visible: false });
  visibility.observe(target);
}

function syncMotion() {
  for (const { video, visible } of watchedVideos.values()) syncVideo(video, visible);
}

document.querySelectorAll("video[data-autoplay]").forEach((video) => watchVideo(video));

// Posters and stills are fetched as their block nears the viewport, not with the page.
const approaching = new Map();
const approach = new IntersectionObserver((entries) => {
  for (const { target, isIntersecting } of entries) {
    if (!isIntersecting) continue;
    approach.unobserve(target);
    approaching.get(target)();
    approaching.delete(target);
  }
}, { rootMargin: "800px 0px" });

function whenNear(target, load) {
  approaching.set(target, load);
  approach.observe(target);
}

document.querySelectorAll("video[data-poster]").forEach((video) => whenNear(video, () => { video.poster = video.dataset.poster; }));
reducedMotion.addEventListener("change", () => {
  motionPaused = reducedMotion.matches;
  syncMotion();
});
document.addEventListener("visibilitychange", syncMotion);
syncMotion();

// Mobile menu and section navigation.
(function navigation() {
  const button = document.querySelector(".menu-toggle");
  const nav = document.getElementById("primary-nav");
  const links = [...nav.querySelectorAll("a")];
  function setOpen(open) {
    button.setAttribute("aria-expanded", String(open));
    button.querySelector("span").textContent = open ? "−" : "＋";
    nav.classList.toggle("is-open", open);
  }
  button.addEventListener("click", () => setOpen(button.getAttribute("aria-expanded") !== "true"));
  nav.addEventListener("click", (event) => {
    const link = event.target.closest("a");
    if (!link) return;
    setOpen(false);
    const section = document.querySelector(link.hash);
    section.setAttribute("tabindex", "-1");
    section.focus({ preventScroll: true });
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && button.getAttribute("aria-expanded") === "true") {
      setOpen(false);
      button.focus();
    }
  });
  document.addEventListener("click", (event) => {
    if (!event.target.closest(".site-header")) setOpen(false);
  });
  document.addEventListener("focusin", (event) => {
    if (!event.target.closest(".site-header")) setOpen(false);
  });
  window.matchMedia("(max-width: 760px)").addEventListener("change", () => setOpen(false));

  const sections = links.map((link) => document.querySelector(link.hash));
  let scheduled = false;
  function updateActive() {
    const offset = document.querySelector(".site-header").offsetHeight + 100;
    let active = null;
    for (const section of sections) {
      if (section.getBoundingClientRect().top <= offset) active = section;
    }
    for (const link of links) {
      if (active && link.hash === `#${active.id}`) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    }
    scheduled = false;
  }
  window.addEventListener("scroll", () => {
    if (!scheduled) { scheduled = true; requestAnimationFrame(updateActive); }
  }, { passive: true });
  updateActive();
})();

// Paint only while a decoder is playing; paused clips keep their last frame.
function paintVideoFrames(video, draw) {
  let frame = null;
  const videoFrames = "requestVideoFrameCallback" in video;
  function renderFrame() {
    draw();
    frame = videoFrames ? video.requestVideoFrameCallback(renderFrame) : requestAnimationFrame(renderFrame);
  }
  function stopFrames() {
    if (frame === null) return;
    if (videoFrames) video.cancelVideoFrameCallback(frame);
    else cancelAnimationFrame(frame);
    frame = null;
  }
  video.addEventListener("play", () => { stopFrames(); renderFrame(); });
  video.addEventListener("pause", stopFrames);
  video.addEventListener("loadeddata", draw);
  video.addEventListener("seeked", draw);
  video.addEventListener("error", draw);
}

// One 3 × 2 atlas keeps geometry and rendered styles synchronized.
(function explorer() {
  const root = document.getElementById("explorer");
  const canvas = root.querySelector("canvas");
  const ctx = canvas.getContext("2d");
  const handle = document.getElementById("handle");
  const tags = { left: document.getElementById("tag-left"), right: document.getElementById("tag-right") };
  const width = canvas.width, height = canvas.height;
  const state = { left: 0, right: 3, split: 0.5 };
  const video = document.createElement("video");
  Object.assign(video, { muted: true, loop: true, playsInline: true, preload: "none" });
  video.dataset.src = root.dataset.src;
  const poster = new Image();
  poster.addEventListener("load", draw);
  whenNear(root, () => { poster.src = root.dataset.poster; });

  function draw() {
    const value = Math.round(state.split * 100);
    handle.style.left = `${value}%`;
    handle.setAttribute("aria-valuenow", value);
    handle.setAttribute("aria-valuetext", `${value}% code world`);
    const source = video.readyState >= 2 && !video.error ? video : poster;
    const sourceWidth = source === video ? video.videoWidth : poster.naturalWidth;
    const sourceHeight = source === video ? video.videoHeight : poster.naturalHeight;
    if (!sourceWidth || !sourceHeight || !ctx) return;
    const tw = sourceWidth / 3, th = sourceHeight / 2;
    const split = Math.round(state.split * width);
    const lc = state.left % 3, lr = Math.floor(state.left / 3);
    const rc = state.right % 3, rr = Math.floor(state.right / 3);
    if (split > 0) ctx.drawImage(source, lc * tw, lr * th, state.split * tw, th, 0, 0, split, height);
    if (split < width) ctx.drawImage(source, (rc + state.split) * tw, rr * th, (1 - state.split) * tw, th, split, 0, width - split, height);
  }

  paintVideoFrames(video, draw);
  watchVideo(video, root);

  function setSplit(clientX) {
    const rect = root.getBoundingClientRect();
    state.split = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    draw();
  }
  let dragging = false;
  root.addEventListener("pointerdown", (event) => {
    if (!event.isPrimary || event.button !== 0) return;
    dragging = true;
    root.setPointerCapture(event.pointerId);
    handle.focus({ preventScroll: true });
    setSplit(event.clientX);
  });
  root.addEventListener("pointermove", (event) => { if (dragging) setSplit(event.clientX); });
  for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) root.addEventListener(type, () => { dragging = false; });
  handle.addEventListener("keydown", (event) => {
    const steps = { ArrowLeft: -0.05, ArrowRight: 0.05, PageDown: -0.1, PageUp: 0.1 };
    if (event.key === "Home") state.split = 0;
    else if (event.key === "End") state.split = 1;
    else if (event.key in steps) state.split = Math.min(1, Math.max(0, state.split + steps[event.key]));
    else return;
    event.preventDefault();
    draw();
  });
  document.querySelectorAll(".explorer-controls .seg").forEach((group) => {
    group.addEventListener("click", (event) => {
      const button = event.target.closest("button");
      if (!button) return;
      group.querySelectorAll("button").forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
      state[group.dataset.side] = Number(button.dataset.layer);
      tags[group.dataset.side].textContent = button.textContent;
      draw();
    });
  });
})();

// One decoder supplies both fixed views. Only the code-view mask moves during a wipe.
(function gallery() {
  const root = document.getElementById("gallery");
  const status = document.getElementById("gallery-status");
  let items;
  try {
    // Inline catalog also works with file:// and previews that block JSON requests.
    items = JSON.parse(document.getElementById("gallery-data").textContent);
  } catch {
    status.textContent = "The world gallery could not be loaded. Please reload the page to try again.";
    return;
  }

  items.forEach((item) => {
    const card = document.createElement("figure");
    card.className = "card";
    card.dataset.world = item.id;
    const clip = document.createElement("button");
    clip.type = "button";
    clip.className = "clip";
    clip.setAttribute("aria-label", `${item.title}: show code world`);
    clip.setAttribute("aria-pressed", "false");
    const which = document.createElement("span");
    which.className = "which";
    which.setAttribute("aria-hidden", "true");
    which.innerHTML = '<span class="render">Rendered</span><span class="code">Code world</span>';
    const video = document.createElement("video");
    Object.assign(video, { muted: true, loop: true, playsInline: true, preload: "none" });
    video.dataset.src = item.video;
    const rendered = document.createElement("canvas");
    const code = document.createElement("canvas");
    for (const canvas of [rendered, code]) {
      canvas.width = 832;
      canvas.height = 468;
      canvas.setAttribute("aria-hidden", "true");
    }
    rendered.className = "clip-rendered";
    code.className = "clip-code";
    const renderedCtx = rendered.getContext("2d");
    const codeCtx = code.getContext("2d");
    const poster = new Image();
    function draw() {
      const source = video.readyState >= 2 && !video.error ? video : poster;
      const width = source === video ? video.videoWidth : poster.naturalWidth;
      const height = source === video ? video.videoHeight : poster.naturalHeight;
      if (!width || !height || !renderedCtx || !codeCtx) return;
      const half = width / 2;
      renderedCtx.drawImage(source, half, 0, half, height, 0, 0, rendered.width, rendered.height);
      codeCtx.drawImage(source, 0, 0, half, height, 0, 0, code.width, code.height);
    }
    poster.addEventListener("load", draw);
    whenNear(clip, () => { poster.src = item.poster; });
    paintVideoFrames(video, draw);
    const cue = document.createElement("span");
    cue.className = "clip-cue";
    cue.textContent = "↔";
    cue.setAttribute("aria-hidden", "true");
    clip.append(rendered, code, which, cue);
    const caption = document.createElement("figcaption");
    caption.className = "card-meta";
    const title = document.createElement("h3");
    title.textContent = item.title;
    caption.append(title);
    card.append(clip, caption);

    let pinned = false, hovered = false;
    function updateView() {
      const showCode = pinned || hovered;
      card.classList.toggle("show-code", showCode);
      clip.setAttribute("aria-pressed", String(showCode));
      clip.setAttribute("aria-label", `${item.title}: show ${showCode ? "rendered view" : "code world"}`);
    }
    clip.addEventListener("pointerenter", (event) => {
      if (event.pointerType === "mouse" && matchMedia("(hover: hover)").matches) { hovered = true; updateView(); }
    });
    clip.addEventListener("pointerleave", () => { hovered = false; updateView(); });
    clip.addEventListener("click", () => {
      pinned = !(pinned || hovered);
      hovered = false;
      updateView();
    });
    root.appendChild(card);
    watchVideo(video, clip);
  });
  status.hidden = true;
})();

// Clipboard failure selects the citation so it remains easy to copy manually.
let citationReset;
document.getElementById("copy-bibtex").addEventListener("click", async (event) => {
  const button = event.currentTarget;
  const label = button.querySelector("span");
  const code = document.getElementById("bibtex");
  clearTimeout(citationReset);
  button.disabled = true;
  button.classList.remove("is-copied", "is-error");
  try {
    await navigator.clipboard.writeText(code.textContent);
    label.textContent = "Copied";
    button.classList.add("is-copied");
    button.setAttribute("aria-label", "BibTeX citation copied");
  } catch {
    const range = document.createRange();
    range.selectNodeContents(code);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    label.textContent = "Selected — copy manually";
    button.classList.add("is-error");
    button.setAttribute("aria-label", "Citation selected; copy manually");
  } finally {
    button.disabled = false;
    button.title = button.getAttribute("aria-label");
  }
  citationReset = setTimeout(() => {
    label.textContent = "Copy";
    button.classList.remove("is-copied", "is-error");
    button.setAttribute("aria-label", "Copy BibTeX citation");
    button.title = "Copy BibTeX citation";
  }, 2400);
});

// Files the agents read or wrote: any [data-file] button opens the raw text in a dialog.
(function agentFiles() {
  const dialog = document.getElementById("file-dialog");
  const store = JSON.parse(document.getElementById("agent-files").textContent);
  const title = dialog.querySelector("h3"), body = dialog.querySelector("pre");
  let opener = null;
  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-file]");
    const file = button && store[button.dataset.file];
    if (!file) return;
    opener = button;
    title.textContent = file.name;
    body.textContent = file.content;
    body.scrollTop = 0;
    dialog.showModal();
    document.documentElement.style.overflow = "hidden";
  });
  dialog.querySelector(".file-dialog-close").addEventListener("click", () => dialog.close());
  // A click on the backdrop lands on the dialog element itself, outside its box.
  dialog.addEventListener("click", (event) => {
    if (event.target !== dialog) return;
    const box = dialog.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close();
  });
  dialog.addEventListener("close", () => {
    document.documentElement.style.overflow = "";
    if (opener) opener.focus({ preventScroll: true });
  });
})();

// World cards: switch the clip between rounds; the score curve highlights the round shown.
(function worldRounds() {
  document.querySelectorAll(".world").forEach((card) => {
    const video = card.querySelector("video");
    const buttons = [...card.querySelectorAll(".world-switch button")];
    buttons.forEach((button) => button.addEventListener("click", () => {
      if (button.getAttribute("aria-pressed") === "true") return;
      buttons.forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
      card.dataset.round = button.dataset.round;
      const playing = !video.paused;
      video.dataset.poster = button.dataset.poster;
      video.poster = button.dataset.poster;
      video.src = button.dataset.video;
      video.load();
      if (playing) video.play().catch(() => {});
    }));
  });
})();
