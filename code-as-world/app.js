if (window.lucide) {
  window.lucide.createIcons({ attrs: { "stroke-width": 1.8 } });
}

async function copyTextToClipboard(value) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return;
    } catch {
      // Fall back when clipboard access is exposed but not permitted.
    }
  }

  const textArea = document.createElement("textarea");
  textArea.value = value;
  textArea.setAttribute("readonly", "");
  textArea.style.position = "fixed";
  textArea.style.inset = "0 auto auto 0";
  textArea.style.opacity = "0";
  textArea.style.pointerEvents = "none";
  document.body.append(textArea);
  textArea.select();

  try {
    if (!document.execCommand("copy")) throw new Error("Copy command was rejected");
  } finally {
    textArea.remove();
  }
}

function setupBibtexCopy() {
  const button = document.querySelector("[data-bibtex-copy]");
  const code = document.querySelector("[data-bibtex-code]");
  const label = button?.querySelector("[data-bibtex-copy-label]");
  if (!button || !code || !label) return;

  let resetTimer = 0;
  const setState = (state) => {
    const copied = state === "copied";
    const failed = state === "error";
    button.classList.toggle("is-copied", copied);
    button.classList.toggle("is-error", failed);
    label.textContent = copied ? "Copied" : failed ? "Try again" : "Copy";
    const accessibleLabel = copied
      ? "BibTeX citation copied"
      : failed
        ? "Copy failed, try again"
        : "Copy BibTeX citation";
    button.setAttribute("aria-label", accessibleLabel);
    button.title = accessibleLabel;
  };

  button.addEventListener("click", async () => {
    window.clearTimeout(resetTimer);
    button.disabled = true;
    try {
      await copyTextToClipboard(code.textContent.trim());
      setState("copied");
    } catch {
      setState("error");
    } finally {
      button.disabled = false;
      resetTimer = window.setTimeout(() => setState("idle"), 2400);
    }
  });
}

function setupOverviewInsightCards() {
  for (const card of document.querySelectorAll(".overview-insight-card")) {
    const toggleCard = () => {
      const flipped = !card.classList.contains("is-flipped");
      card.classList.toggle("is-flipped", flipped);
      card.setAttribute("aria-pressed", String(flipped));
    };

    card.addEventListener("click", toggleCard);
    card.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      toggleCard();
    });
  }
}

const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

function setupSectionNavigation() {
  const header = document.querySelector(".site-header");
  if (!header) return;

  const updateHeaderHeight = () => {
    const height = Math.ceil(header.getBoundingClientRect().height);
    document.documentElement.style.setProperty("--header-height", `${height}px`);
    return height;
  };

  const scrollToHash = (hash, { updateHistory = false, behavior = "smooth" } = {}) => {
    if (!hash || hash === "#") return;

    let section;
    try {
      section = document.querySelector(hash);
    } catch {
      return;
    }
    if (!section) return;

    const headerHeight = updateHeaderHeight();
    const content = section.querySelector("[data-scroll-target]") || section;
    const top = hash === "#top"
      ? 0
      : window.scrollY + content.getBoundingClientRect().top - headerHeight - 20;
    window.scrollTo({ top: Math.max(0, top), behavior });

    if (updateHistory) {
      const nextUrl = `${window.location.pathname}${window.location.search}${hash}`;
      if (window.location.hash === hash) window.history.replaceState(null, "", nextUrl);
      else window.history.pushState(null, "", nextUrl);
    }
  };

  updateHeaderHeight();
  new ResizeObserver(updateHeaderHeight).observe(header);

  const navigationLinks = document.querySelectorAll(
    '.site-header a[href^="#"], .hero-actions a[href^="#"]',
  );
  for (const link of navigationLinks) {
    link.addEventListener("click", (event) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname !== window.location.pathname) return;
      event.preventDefault();
      scrollToHash(url.hash, {
        updateHistory: true,
        behavior: reducedMotionQuery.matches ? "instant" : "smooth",
      });
    });
  }

  window.addEventListener("popstate", () => {
    scrollToHash(window.location.hash, {
      behavior: reducedMotionQuery.matches ? "instant" : "smooth",
    });
  });

  if (window.location.hash) {
    requestAnimationFrame(() => scrollToHash(window.location.hash, { behavior: "instant" }));
    document.fonts.ready.then(() => {
      requestAnimationFrame(() => scrollToHash(window.location.hash, { behavior: "instant" }));
    });
  }
}

function setupHeroVideo() {
  const heroWall = document.querySelector("[data-hero-wall]");
  const heroVideo = heroWall?.querySelector("[data-hero-video]");
  if (!heroWall || !heroVideo) return;

  let visible = true;
  const refreshPlayback = () => {
    const shouldPlay = visible && !document.hidden && !reducedMotionQuery.matches;
    if (shouldPlay) heroVideo.play().catch(() => {});
    else heroVideo.pause();
  };

  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    refreshPlayback();
  }, { threshold: 0.01 }).observe(heroWall);
  document.addEventListener("visibilitychange", refreshPlayback);
  reducedMotionQuery.addEventListener?.("change", refreshPlayback);
  refreshPlayback();
}

function setupBenchmarkVideo() {
  const video = document.querySelector("#benchmark-chart-video");
  if (!video) return;

  let wasVisible = false;
  const showCompletedFrame = () => {
    const finish = () => {
      video.currentTime = Math.max(video.duration || 6.7, 0) - 0.05;
    };
    if (video.readyState >= 1) finish();
    else video.addEventListener("loadedmetadata", finish, { once: true });
  };

  new IntersectionObserver(([entry]) => {
    const visible = entry.isIntersecting && entry.intersectionRatio >= 0.45;
    if (visible && !wasVisible) {
      if (reducedMotionQuery.matches) {
        video.pause();
        showCompletedFrame();
      } else {
        video.currentTime = 0;
        video.play().catch(() => {});
      }
    } else if (!visible) {
      video.pause();
    }
    wasVisible = visible;
  }, { threshold: 0.45 }).observe(video);
}

setupBibtexCopy();
setupOverviewInsightCards();
setupSectionNavigation();
setupHeroVideo();
setupBenchmarkVideo();
