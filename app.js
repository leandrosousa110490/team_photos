
const page = document.body.dataset.page || "home";
const byId = (id) => document.getElementById(id);

const CONTACT = {
  name: "Alyssa Sousa",
  phoneDisplay: "305-898-9791",
  phoneLink: "+13058989791",
  email: "leoisdabest@yahoo.com"
};

const LIVE_PHRASES = [
  "Wedding Storytelling",
  "Party Highlights",
  "Family Portrait Moments",
  "Kids Milestone Magic",
  "Event Energy Coverage"
];

const LIVE_UPDATES = [
  "Pictures preserve the people, emotions, and stories we never want to forget.",
  "A single image can hold generations of love, laughter, and connection.",
  "Your gallery becomes a timeless memory bank that grows in value every year.",
  "From vows to birthdays, family hugs to final whistles, every frame keeps life close."
];

const revealObserver = new IntersectionObserver((entries, obs) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add("in");
      obs.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });

function reveal(root = document) {
  root.querySelectorAll(".reveal").forEach((el) => {
    if (!el.classList.contains("in")) {
      revealObserver.observe(el);
    }
  });
}

function money(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(value);
}

function rotatePhrase(target, phrases = LIVE_PHRASES, intervalMs = 2400) {
  if (!target || !phrases.length) {
    return;
  }
  let i = 0;
  target.textContent = phrases[i];
  window.setInterval(() => {
    i = (i + 1) % phrases.length;
    target.textContent = phrases[i];
  }, intervalMs);
}

function startPulseFeed(list, updates = LIVE_UPDATES, intervalMs = 2300) {
  if (!list || !updates.length) {
    return;
  }
  list.innerHTML = `<li>${updates[0]}</li><li>${updates[1]}</li><li>${updates[2]}</li>`;
  let i = 0;
  window.setInterval(() => {
    i = (i + 1) % updates.length;
    list.querySelector("li")?.remove();
    const li = document.createElement("li");
    li.textContent = updates[i];
    list.appendChild(li);
  }, intervalMs);
}

const LOCAL_SUBMISSION_KEY = "edgeframe-local-submissions";

function getPhotoUrl(seed, width = 1200, height = 900) {
  return `https://picsum.photos/seed/${encodeURIComponent(seed)}/${width}/${height}`;
}

function makePhotoFallback(label) {
  const safeLabel = String(label || "EdgeFrame Photo").replace(/[<>&]/g, "");
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 900" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#1060ff" />
          <stop offset="50%" stop-color="#1ab26b" />
          <stop offset="100%" stop-color="#ff5a1f" />
        </linearGradient>
      </defs>
      <rect width="1200" height="900" fill="url(#g)" />
      <circle cx="220" cy="170" r="190" fill="rgba(255,255,255,0.18)" />
      <circle cx="1020" cy="780" r="260" fill="rgba(9,20,46,0.22)" />
      <text x="600" y="470" fill="#ffffff" text-anchor="middle" font-family="Manrope, Arial, sans-serif" font-size="58" font-weight="800">${safeLabel}</text>
    </svg>
  `;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function setImageWithFallback(img, src, fallbackLabel) {
  if (!(img instanceof HTMLImageElement)) {
    return;
  }
  const fallbackSrc = makePhotoFallback(fallbackLabel);
  img.loading = "lazy";
  img.decoding = "async";
  img.referrerPolicy = "no-referrer";
  img.src = src;
  img.addEventListener("error", () => {
    if (img.dataset.fallbackApplied === "true") {
      return;
    }
    img.dataset.fallbackApplied = "true";
    img.src = fallbackSrc;
  }, { once: true });
}

let firebaseChecked = false;
let firestoreDb = null;

function getFirestoreDb() {
  if (firestoreDb) {
    return firestoreDb;
  }
  if (firebaseChecked) {
    return null;
  }

  firebaseChecked = true;

  const config = window.EDGEFRAME_FIREBASE_CONFIG;
  if (!config || !config.apiKey || String(config.apiKey).includes("REPLACE")) {
    return null;
  }

  if (!window.firebase || typeof window.firebase.initializeApp !== "function") {
    return null;
  }

  try {
    if (!window.firebase.apps.length) {
      window.firebase.initializeApp(config);
    }
    firestoreDb = window.firebase.firestore();
    return firestoreDb;
  } catch (error) {
    console.error("Firebase initialization failed:", error);
    return null;
  }
}

async function saveSubmission(collectionName, payload) {
  const submission = {
    ...payload,
    source: "edgeframe-website",
    page,
    contactName: CONTACT.name,
    createdAtClient: new Date().toISOString()
  };

  const db = getFirestoreDb();
  if (db) {
    try {
      const serverTimestamp = window.firebase?.firestore?.FieldValue?.serverTimestamp;
      await db.collection(collectionName).add({
        ...submission,
        createdAtServer: serverTimestamp ? serverTimestamp() : null
      });
      return { stored: "firebase" };
    } catch (error) {
      console.error("Firestore write failed. Falling back to local storage:", error);
    }
  }

  try {
    const existing = JSON.parse(localStorage.getItem(LOCAL_SUBMISSION_KEY) || "[]");
    const safeExisting = Array.isArray(existing) ? existing : [];
    safeExisting.push({
      id: (window.crypto && typeof window.crypto.randomUUID === "function")
        ? window.crypto.randomUUID()
        : `local-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      collection: collectionName,
      ...submission,
      createdAtServer: null
    });
    localStorage.setItem(LOCAL_SUBMISSION_KEY, JSON.stringify(safeExisting.slice(-200)));
    return { stored: "local", reason: db ? "firebase-write-failed" : "firebase-not-configured" };
  } catch (error) {
    console.error("Local submission fallback failed:", error);
    throw new Error("Unable to save submission.");
  }
}

function initGlobal() {
  const header = byId("siteHeader");
  if (header) {
    window.addEventListener("scroll", () => {
      header.classList.toggle("scrolled", window.scrollY > 14);
    });
  }

  const menu = byId("menuToggle");
  const nav = byId("mainNav");
  if (menu && nav) {
    menu.addEventListener("click", () => {
      const open = menu.getAttribute("aria-expanded") === "true";
      menu.setAttribute("aria-expanded", String(!open));
      nav.classList.toggle("is-open", !open);
    });

    nav.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        menu.setAttribute("aria-expanded", "false");
        nav.classList.remove("is-open");
      });
    });
  }

  document.querySelectorAll("[data-nav]").forEach((link) => {
    if (link.dataset.nav === page) {
      link.classList.add("is-active");
    }
  });

  document.body.classList.add("accent-shift");

  const glow = byId("cursorGlow");
  if (glow) {
    window.addEventListener("pointermove", (event) => {
      glow.style.left = `${event.clientX}px`;
      glow.style.top = `${event.clientY}px`;
    });
  }

  reveal();
}
function initSharedLiveBand() {
  if (page !== "home") {
    return;
  }

  const main = document.querySelector("main");
  if (!main) {
    return;
  }

  const anchor = main.querySelector(".hero-home, .page-hero");
  if (!anchor) {
    return;
  }

  const section = document.createElement("section");
  section.className = "shared-live-band";
  section.innerHTML = `
    <div class="container reveal">
      <div class="live-band-shell">
        <div class="live-band-head">
          <h2>Live Creative Pulse</h2>
          <button class="btn btn-primary" type="button" data-open-quote-modal>Request Official Quote</button>
        </div>
        <div class="live-band-row">
          <p class="live-band-phrase">Images protect life memories across weddings, parties, family sessions, kids milestones, sports, and corporate events. Current focus: <strong data-shared-phrase>Wedding Storytelling</strong></p>
          <a class="btn btn-secondary" href="tel:${CONTACT.phoneLink}">Call ${CONTACT.phoneDisplay}</a>
        </div>
        <ul class="live-band-feed" data-shared-feed aria-live="polite"></ul>
      </div>
    </div>
  `;

  anchor.insertAdjacentElement("afterend", section);
  rotatePhrase(section.querySelector("[data-shared-phrase]"));
  startPulseFeed(section.querySelector("[data-shared-feed]"));
  reveal(section);
}

function initPageHeroNodeBackground() {
  const hero = document.querySelector(".page-hero");
  if (!hero) {
    return;
  }

  hero.classList.add("page-hero-network");
  let canvas = hero.querySelector(".page-hero-canvas");
  if (!(canvas instanceof HTMLCanvasElement)) {
    canvas = document.createElement("canvas");
    canvas.className = "page-hero-canvas";
    canvas.setAttribute("aria-hidden", "true");
    hero.prepend(canvas);
  }

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return;
  }

  const nodes = [];
  const count = 28;
  let width = 0;
  let height = 0;

  const resize = () => {
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    canvas.width = Math.floor(width * window.devicePixelRatio);
    canvas.height = Math.floor(height * window.devicePixelRatio);
    ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
  };

  const seed = () => {
    nodes.length = 0;
    for (let i = 0; i < count; i += 1) {
      nodes.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.72,
        vy: (Math.random() - 0.5) * 0.72,
        r: 1 + Math.random() * 1.6,
        p: Math.random() * Math.PI * 2
      });
    }
  };

  const draw = (time) => {
    const maxD = 165;
    ctx.clearRect(0, 0, width, height);

    nodes.forEach((n) => {
      n.x += n.vx;
      n.y += n.vy;
      if (n.x < 0 || n.x > width) n.vx *= -1;
      if (n.y < 0 || n.y > height) n.vy *= -1;
    });

    for (let i = 0; i < nodes.length; i += 1) {
      for (let j = i + 1; j < nodes.length; j += 1) {
        const a = nodes[i];
        const b = nodes[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < maxD) {
          const alpha = (1 - d / maxD) * 0.42;
          const pulse = 0.14 + Math.sin(time * 0.003 + a.p + b.p) * 0.12;
          ctx.strokeStyle = `rgba(15,76,219,${Math.max(0.06, alpha + pulse)})`;
          ctx.lineWidth = 1.35;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();

          if (Math.random() > 0.95) {
            const t = (Math.sin(time * 0.004 + a.p) + 1) / 2;
            const lx = a.x + (b.x - a.x) * t;
            const ly = a.y + (b.y - a.y) * t;
            ctx.fillStyle = "rgba(255,90,31,0.88)";
            ctx.beginPath();
            ctx.arc(lx, ly, 1.8, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    }

    nodes.forEach((n) => {
      ctx.fillStyle = "rgba(0,166,166,0.72)";
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      ctx.fill();
    });

    requestAnimationFrame(draw);
  };

  window.addEventListener("resize", () => {
    resize();
    seed();
  });

  resize();
  seed();
  requestAnimationFrame(draw);
}

function initCounters() {
  const values = [...document.querySelectorAll(".stat-value")];
  if (!values.length) {
    return;
  }

  let started = false;
  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting || started) {
        return;
      }
      started = true;
      values.forEach((el) => {
        const target = Number(el.dataset.target || 0);
        const suffix = el.dataset.suffix ?? "+";
        const start = performance.now();
        const duration = 1200;
        const tick = (now) => {
          const progress = Math.min((now - start) / duration, 1);
          const eased = 1 - Math.pow(1 - progress, 3);
          el.textContent = `${Math.floor(target * eased)}${suffix}`;
          if (progress < 1) {
            requestAnimationFrame(tick);
          } else {
            el.textContent = `${target}${suffix}`;
          }
        };
        requestAnimationFrame(tick);
      });
      obs.disconnect();
    });
  }, { threshold: 0.35 });
  observer.observe(values[0]);
}

function initHome() {
  initCounters();

  rotatePhrase(byId("rotatingPhrase"));
  startPulseFeed(byId("pulseFeed"));

  const spotlightKicker = byId("spotlightKicker");
  const spotlightTitle = byId("spotlightTitle");
  const spotlightDescription = byId("spotlightDescription");
  const spotlightPrev = byId("spotlightPrev");
  const spotlightNext = byId("spotlightNext");

  if (spotlightKicker && spotlightTitle && spotlightDescription && spotlightPrev && spotlightNext) {
    const cards = [
      ["Weddings", "Signature Wedding Story Pack", "Ceremony highlights, candid reception moments, and timeless portraits delivered in a cinematic gallery."],
      ["Parties", "Celebration Energy Pack", "Birthday and private-event coverage with candid moments, detail shots, and same-day highlight previews."],
      ["Family & Kids", "Family Legacy Pack", "Natural family portraits, playful kids sessions, and lifestyle storytelling in one polished set."]
    ];
    let i = 0;
    const draw = () => {
      spotlightKicker.textContent = cards[i][0];
      spotlightTitle.textContent = cards[i][1];
      spotlightDescription.textContent = cards[i][2];
    };
    spotlightPrev.addEventListener("click", () => {
      i = (i - 1 + cards.length) % cards.length;
      draw();
    });
    spotlightNext.addEventListener("click", () => {
      i = (i + 1) % cards.length;
      draw();
    });
    window.setInterval(() => {
      i = (i + 1) % cards.length;
      draw();
    }, 5000);
  }

  const canvas = byId("heroCanvas");
  if (!(canvas instanceof HTMLCanvasElement)) {
    return;
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return;
  }

  const nodes = [];
  const count = 38;
  let width = 0;
  let height = 0;

  const resize = () => {
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    canvas.width = Math.floor(width * window.devicePixelRatio);
    canvas.height = Math.floor(height * window.devicePixelRatio);
    ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
  };

  const seed = () => {
    nodes.length = 0;
    for (let i = 0; i < count; i += 1) {
      nodes.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.85,
        vy: (Math.random() - 0.5) * 0.85,
        r: 1.2 + Math.random() * 1.8,
        p: Math.random() * Math.PI * 2
      });
    }
  };

  const draw = (time) => {
    const maxD = 175;
    ctx.clearRect(0, 0, width, height);

    nodes.forEach((n) => {
      n.x += n.vx;
      n.y += n.vy;
      if (n.x < 0 || n.x > width) n.vx *= -1;
      if (n.y < 0 || n.y > height) n.vy *= -1;
    });

    for (let i = 0; i < nodes.length; i += 1) {
      for (let j = i + 1; j < nodes.length; j += 1) {
        const a = nodes[i];
        const b = nodes[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < maxD) {
          const alpha = (1 - d / maxD) * 0.5;
          const pulse = 0.18 + Math.sin(time * 0.003 + a.p + b.p) * 0.14;
          ctx.strokeStyle = `rgba(15,76,219,${Math.max(0.08, alpha + pulse)})`;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();

          if (Math.random() > 0.94) {
            const t = (Math.sin(time * 0.004 + a.p) + 1) / 2;
            const lx = a.x + (b.x - a.x) * t;
            const ly = a.y + (b.y - a.y) * t;
            ctx.fillStyle = "rgba(255,90,31,0.95)";
            ctx.beginPath();
            ctx.arc(lx, ly, 2.1, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    }

    nodes.forEach((n) => {
      ctx.fillStyle = "rgba(0,166,166,0.85)";
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      ctx.fill();
    });

    requestAnimationFrame(draw);
  };

  window.addEventListener("resize", () => {
    resize();
    seed();
  });
  resize();
  seed();
  requestAnimationFrame(draw);
}

function initGallery() {
  const grid = byId("galleryGrid");
  const row = byId("filterRow");
  const search = byId("gallerySearch");
  const reels = byId("reelGrid");
  if (!grid || !row || !search || !reels) {
    return;
  }

  const items = [
    { title: "Golden Hour Vows", category: "Wedding", event: "Coastal Ceremony", location: "Malibu, CA", image: getPhotoUrl("edgeframe-wedding-vows") },
    { title: "Dance Floor Energy", category: "Parties", event: "Milestone Birthday", location: "Miami, FL", image: getPhotoUrl("edgeframe-party-dance") },
    { title: "Lakeside Family Portraits", category: "Family", event: "Family Session", location: "Seattle, WA", image: getPhotoUrl("edgeframe-family-lakeside") },
    { title: "Playful Little Explorers", category: "Kids", event: "Kids Lifestyle Session", location: "Austin, TX", image: getPhotoUrl("edgeframe-kids-play") },
    { title: "Friday Night Lights", category: "Sports", event: "Regional Finals", location: "Columbus, OH", image: getPhotoUrl("edgeframe-sports-finals") },
    { title: "Elegant Corporate Gala", category: "Corporate", event: "Annual Awards Night", location: "Chicago, IL", image: getPhotoUrl("edgeframe-corporate-gala") },
    { title: "Backyard Celebration", category: "Parties", event: "Engagement Party", location: "Phoenix, AZ", image: getPhotoUrl("edgeframe-party-engagement") },
    { title: "Sunset Engagement Story", category: "Wedding", event: "Engagement Session", location: "San Diego, CA", image: getPhotoUrl("edgeframe-engagement-sunset") }
  ];

  const state = { filter: "All", query: "", idx: 0, visible: [...items] };
  const filters = ["All", ...new Set(items.map((x) => x.category))];
  const lightbox = byId("lightbox");
  const lightboxImage = byId("lightboxImage");
  const lightboxCaption = byId("lightboxCaption");
  let lightboxItems = state.visible;

  const renderCaption = (item) => {
    if (!item) {
      return "";
    }
    if (item.event && item.location) {
      return `${item.title} | ${item.event} | ${item.location}`;
    }
    if (item.event) {
      return `${item.title} | ${item.event}`;
    }
    return item.title || "Gallery Image";
  };

  const drawLightbox = () => {
    if (!lightboxImage || !lightboxCaption || !lightboxItems.length) {
      return;
    }
    const current = lightboxItems[state.idx];
    if (!current) {
      return;
    }
    lightboxImage.src = current.image;
    lightboxCaption.textContent = renderCaption(current);
  };

  const openLightbox = (items, index) => {
    if (!items.length) {
      return;
    }
    lightboxItems = items;
    state.idx = index;
    drawLightbox();
    lightbox?.classList.add("is-open");
  };

  const derive = () => {
    const q = state.query.trim().toLowerCase();
    state.visible = items.filter((it) => (
      (state.filter === "All" || it.category === state.filter)
      && (!q || `${it.title} ${it.event} ${it.location} ${it.category}`.toLowerCase().includes(q))
    ));
  };

  const renderFilters = () => {
    row.innerHTML = "";
    filters.forEach((f) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `filter-btn ${state.filter === f ? "is-active" : ""}`;
      btn.textContent = f;
      btn.addEventListener("click", () => {
        state.filter = f;
        derive();
        renderFilters();
        renderGrid();
      });
      row.appendChild(btn);
    });
  };

  const renderGrid = () => {
    grid.innerHTML = "";
    if (!state.visible.length) {
      grid.innerHTML = "<p>No matching sessions found.</p>";
      return;
    }
    state.visible.forEach((it, i) => {
      const card = document.createElement("article");
      card.className = "gallery-card reveal";
      const imageWrap = document.createElement("div");
      imageWrap.className = "gallery-image-wrap";

      const image = document.createElement("img");
      image.alt = it.title;
      setImageWithFallback(image, it.image, it.title);

      const chip = document.createElement("span");
      chip.className = "sport-chip";
      chip.textContent = it.category;

      imageWrap.append(image, chip);

      const content = document.createElement("div");
      content.className = "gallery-content";

      const title = document.createElement("h3");
      title.className = "gallery-title";
      title.textContent = it.title;

      const meta = document.createElement("p");
      meta.className = "gallery-meta";
      meta.textContent = `${it.event} | ${it.location}`;

      content.append(title, meta);
      card.append(imageWrap, content);
      card.addEventListener("click", () => {
        openLightbox(state.visible, i);
      });
      grid.appendChild(card);
    });
    reveal(grid);
  };

  search.addEventListener("input", () => {
    state.query = search.value;
    derive();
    renderGrid();
  });

  document.querySelectorAll(".view-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".view-btn").forEach((x) => x.classList.remove("is-active"));
      btn.classList.add("is-active");
      grid.classList.toggle("is-dense", btn.dataset.view === "dense");
    });
  });

  byId("lightboxClose")?.addEventListener("click", () => lightbox?.classList.remove("is-open"));
  byId("lightboxPrev")?.addEventListener("click", () => {
    state.idx = (state.idx - 1 + lightboxItems.length) % lightboxItems.length;
    drawLightbox();
  });
  byId("lightboxNext")?.addEventListener("click", () => {
    state.idx = (state.idx + 1) % lightboxItems.length;
    drawLightbox();
  });

  reels.innerHTML = [
    ["Wedding Story Reels", "Ceremony to reception highlights in one cinematic timeline."],
    ["Family Memory Cards", "Natural portraits and candid interactions for keepsakes."],
    ["Celebration Recaps", "Party highlights edited for social and albums."]
  ].map((x) => `<article class=\"reel-card\"><h3>${x[0]}</h3><p>${x[1]}</p></article>`).join("");

  derive();
  renderFilters();
  renderGrid();
  initAutoScrollGallery(openLightbox);
}

function initAutoScrollGallery(openLightbox) {
  const track = byId("autoGalleryTrack");
  if (!track) {
    return;
  }

  const discoverFromDirectory = async () => {
    try {
      const response = await fetch("assets/gallery/", { cache: "no-store" });
      if (!response.ok) {
        return [];
      }
      const html = await response.text();
      const matches = [...html.matchAll(/gallary(\d+)\.(jpg|jpeg|png|webp|avif)/gi)];
      const unique = new Map();
      matches.forEach((match) => {
        const index = Number(match[1]);
        const fileName = `gallary${index}.${match[2].toLowerCase()}`;
        unique.set(index, `assets/gallery/${fileName}`);
      });
      return [...unique.entries()].sort((a, b) => a[0] - b[0]).map((entry) => entry[1]);
    } catch {
      return [];
    }
  };

  const renderCards = (images) => {
    const mapped = images.map((src, idx) => ({
      title: `Memory Highlight ${idx + 1}`,
      event: "Gallery Stream",
      image: src
    }));

    track.innerHTML = "";
    mapped.forEach((item, idx) => {
      const card = document.createElement("article");
      card.className = "auto-gallery-card reveal";

      const image = document.createElement("img");
      image.alt = item.title;
      setImageWithFallback(image, item.image, item.title);
      card.appendChild(image);

      card.addEventListener("click", () => {
        if (typeof openLightbox === "function") {
          openLightbox(mapped, idx);
        }
      });
      track.appendChild(card);
    });

    reveal(track);
  };

  const fallback = [
    getPhotoUrl("edgeframe-stream-1"),
    getPhotoUrl("edgeframe-stream-2"),
    getPhotoUrl("edgeframe-stream-3"),
    getPhotoUrl("edgeframe-stream-4"),
    getPhotoUrl("edgeframe-stream-5"),
    getPhotoUrl("edgeframe-stream-6")
  ];

  const load = async () => {
    const discovered = await discoverFromDirectory();
    renderCards(discovered.length ? discovered : fallback);
  };

  void load();
}

function initServices() {
  const panel = byId("packagePanel");
  const process = byId("processCard");
  if (!panel || !process) {
    return;
  }

  const packs = {
    wedding: ["Signature Wedding", "Full wedding-day storytelling with emotional moments and elegant portraits.", ["Preparation, ceremony, and reception coverage", "Couple and family portrait direction", "Curated online gallery"]],
    events: ["Celebration Events", "Birthdays, parties, and private events captured with candid energy and style.", ["Candid and posed coverage blend", "Detail and decor storytelling", "Fast highlight previews"]],
    family: ["Family & Kids", "Lifestyle portraits and playful sessions with a warm, natural look.", ["Family group and individual portraits", "Kids milestone moments", "Retouched final gallery"]]
  };
  const steps = {
    brief: ["Creative Brief + Session Plan", "We align on mood, key moments, groupings, and timeline before the shoot."],
    capture: ["Live Capture", "On-site direction and candid coverage with a smooth client experience."],
    edit: ["Edit Pipeline", "Color-balanced edits and careful curation for consistency."],
    deliver: ["Delivery", "Organized online gallery and print-ready files."]
  };
  const drawPack = (k) => {
    panel.innerHTML = `<h2>${packs[k][0]}</h2><p>${packs[k][1]}</p><ul>${packs[k][2].map((x) => `<li>${x}</li>`).join("")}</ul>`;
  };
  const drawStep = (k) => {
    process.innerHTML = `<h3>${steps[k][0]}</h3><p>${steps[k][1]}</p>`;
  };
  document.querySelectorAll(".tab-btn").forEach((btn) => btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((x) => x.classList.remove("is-active"));
    btn.classList.add("is-active");
    drawPack(btn.dataset.package);
  }));

  document.querySelectorAll(".process-step").forEach((btn) => btn.addEventListener("click", () => {
    document.querySelectorAll(".process-step").forEach((x) => x.classList.remove("is-active"));
    btn.classList.add("is-active");
    drawStep(btn.dataset.step);
  }));

  drawPack("wedding");
  drawStep("brief");
  initServicesDynamicContent();
}

function initServicesDynamicContent() {
  const title = byId("serviceDynamicTitle");
  const text = byId("serviceDynamicText");
  const tag = byId("serviceLiveTag");
  const metricOne = byId("serviceMetricOne");
  const metricTwo = byId("serviceMetricTwo");
  const feed = byId("serviceLiveFeed");
  if (!title || !text || !tag || !metricOne || !metricTwo || !feed) {
    return;
  }

  const cards = [
    {
      tag: "Wedding Focus",
      title: "Romantic storytelling built around every key moment.",
      text: "From first look to final dance, we direct lightly and preserve emotion so every chapter feels personal and timeless.",
      metricOne: "98%",
      metricTwo: "24h"
    },
    {
      tag: "Celebration Focus",
      title: "Party energy captured with clean, vibrant visual rhythm.",
      text: "We blend candid reactions, decor details, and group portraits to deliver galleries that feel alive from start to finish.",
      metricOne: "96%",
      metricTwo: "18h"
    },
    {
      tag: "Family & Kids Focus",
      title: "Natural portraits that keep the joy and personality intact.",
      text: "Our approach keeps sessions relaxed so smiles, connection, and playful moments feel real in every delivered frame.",
      metricOne: "99%",
      metricTwo: "20h"
    }
  ];

  const updates = [
    "Creative brief confirmed with timeline and must-capture moments.",
    "Lighting map optimized for ceremony, portraits, and candid flow.",
    "Live capture team synchronized for smooth multi-angle coverage.",
    "Preview set exported for same-day family and guest sharing."
  ];

  let i = 0;
  const renderCard = () => {
    const card = cards[i];
    tag.textContent = card.tag;
    title.textContent = card.title;
    text.textContent = card.text;
    metricOne.textContent = card.metricOne;
    metricTwo.textContent = card.metricTwo;
  };

  feed.innerHTML = `<li>${updates[0]}</li><li>${updates[1]}</li><li>${updates[2]}</li>`;
  let feedIndex = 0;
  window.setInterval(() => {
    feedIndex = (feedIndex + 1) % updates.length;
    feed.querySelector("li")?.remove();
    const li = document.createElement("li");
    li.textContent = updates[feedIndex];
    feed.appendChild(li);
  }, 2300);

  window.setInterval(() => {
    i = (i + 1) % cards.length;
    renderCard();
  }, 3800);

  renderCard();
}

function initResultsHeroExperience() {
  const video = byId("resultsHeroVideo");
  const overlay = byId("resultsVideoOverlay");
  if (!(video instanceof HTMLVideoElement) || !overlay) {
    return;
  }

  const photos = [...overlay.querySelectorAll(".overlay-photo")];
  if (!photos.length) {
    return;
  }

  const randomize = (photo) => {
    const x = 8 + Math.random() * 72;
    const y = 10 + Math.random() * 64;
    const rotate = -8 + Math.random() * 16;
    photo.style.left = `${x}%`;
    photo.style.top = `${y}%`;
    photo.style.setProperty("--photo-rotate", `${rotate}deg`);
  };

  let activeIndex = 0;
  let timer = null;

  const show = (idx) => {
    photos.forEach((photo, i) => {
      const active = i === idx;
      photo.classList.toggle("is-active", active);
      if (active) {
        randomize(photo);
      }
    });
  };

  const start = () => {
    if (timer) {
      return;
    }
    timer = window.setInterval(() => {
      activeIndex = (activeIndex + 1) % photos.length;
      show(activeIndex);
    }, 1700);
  };

  const stop = () => {
    if (!timer) {
      return;
    }
    window.clearInterval(timer);
    timer = null;
  };

  photos.forEach(randomize);
  show(0);
  start();

  video.addEventListener("play", start);
  video.addEventListener("pause", stop);
  video.addEventListener("ended", () => {
    activeIndex = 0;
    show(activeIndex);
    start();
  });
}

function initResultsChart() {
  const canvas = byId("resultsChart");
  if (!(canvas instanceof HTMLCanvasElement)) {
    return;
  }

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return;
  }

  let tooltip = document.querySelector(".chart-tooltip");
  if (!tooltip) {
    tooltip = document.createElement("div");
    tooltip.className = "chart-tooltip";
    document.body.appendChild(tooltip);
  }

  const data = [72, 76, 79, 83, 86, 89, 92, 95];
  const labels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug"];
  let points = [];
  let hover = -1;

  const draw = () => {
    const ratio = window.devicePixelRatio || 1;
    const width = canvas.clientWidth || canvas.width;
    const height = canvas.clientHeight || canvas.height;

    canvas.width = Math.floor(width * ratio);
    canvas.height = Math.floor(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

    const pad = { t: 24, r: 20, b: 42, l: 36 };
    const chartW = width - pad.l - pad.r;
    const chartH = height - pad.t - pad.b;
    const min = Math.min(...data) - 5;
    const max = Math.max(...data) + 5;

    ctx.clearRect(0, 0, width, height);

    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.lineWidth = 1;
    for (let y = 0; y <= 4; y += 1) {
      const yy = pad.t + (chartH / 4) * y;
      ctx.beginPath();
      ctx.moveTo(pad.l, yy);
      ctx.lineTo(width - pad.r, yy);
      ctx.stroke();
    }

    points = data.map((value, i) => {
      const x = pad.l + (i / (data.length - 1)) * chartW;
      const y = pad.t + ((max - value) / (max - min)) * chartH;
      return { x, y, value, label: labels[i] };
    });

    const grad = ctx.createLinearGradient(0, pad.t, 0, pad.t + chartH);
    grad.addColorStop(0, "rgba(16,96,255,0.35)");
    grad.addColorStop(1, "rgba(26,178,107,0.02)");

    ctx.beginPath();
    points.forEach((p, i) => {
      if (i === 0) {
        ctx.moveTo(p.x, p.y);
      } else {
        const prev = points[i - 1];
        const cx = (prev.x + p.x) / 2;
        ctx.quadraticCurveTo(prev.x, prev.y, cx, (prev.y + p.y) / 2);
      }
      if (i === points.length - 1) {
        ctx.lineTo(p.x, p.y);
      }
    });

    ctx.lineTo(width - pad.r, height - pad.b);
    ctx.lineTo(pad.l, height - pad.b);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.beginPath();
    points.forEach((p, i) => {
      if (i === 0) {
        ctx.moveTo(p.x, p.y);
      } else {
        const prev = points[i - 1];
        const cx = (prev.x + p.x) / 2;
        ctx.quadraticCurveTo(prev.x, prev.y, cx, (prev.y + p.y) / 2);
      }
      if (i === points.length - 1) {
        ctx.lineTo(p.x, p.y);
      }
    });
    ctx.strokeStyle = "#39b683";
    ctx.lineWidth = 3;
    ctx.stroke();

    points.forEach((p, i) => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, hover === i ? 6.5 : 5, 0, Math.PI * 2);
      ctx.fillStyle = hover === i ? "#ff5a1f" : "#1060ff";
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.9)";
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = "rgba(232,239,255,0.85)";
      ctx.font = "700 11px Manrope, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(labels[i], p.x, height - 16);
    });
  };

  const setHover = (event) => {
    const rect = canvas.getBoundingClientRect();
    const mx = event.clientX - rect.left;
    const my = event.clientY - rect.top;

    let nextHover = -1;
    let best = 18;
    points.forEach((p, i) => {
      const d = Math.hypot(mx - p.x, my - p.y);
      if (d < best) {
        best = d;
        nextHover = i;
      }
    });

    if (nextHover !== hover) {
      hover = nextHover;
      draw();
    }

    if (hover >= 0 && tooltip) {
      const p = points[hover];
      tooltip.textContent = `${p.label}: ${p.value}% of clients said photos increased joy and memory connection`;
      tooltip.classList.add("is-visible");
      tooltip.style.left = `${event.clientX}px`;
      tooltip.style.top = `${event.clientY}px`;
    } else if (tooltip) {
      tooltip.classList.remove("is-visible");
    }
  };

  draw();
  canvas.addEventListener("pointermove", setHover);
  canvas.addEventListener("pointerleave", () => {
    hover = -1;
    draw();
    tooltip?.classList.remove("is-visible");
  });
  window.addEventListener("resize", draw);
}

function initResults() {
  initCounters();
  initResultsHeroExperience();
  initResultsChart();

  const quote = document.querySelector(".testimonial-quote");
  const meta = document.querySelector(".testimonial-meta");
  const prev = byId("testimonialPrev");
  const next = byId("testimonialNext");
  if (quote && meta && prev && next) {
    const list = [
      ["Our wedding gallery felt cinematic and deeply personal.", "R. and T. Morgan"],
      ["The birthday party photos were vibrant and full of real moments.", "K. Alvarez"],
      ["Family and kids portraits came out natural and beautiful.", "J. Patel"]
    ];
    let i = 0;
    const draw = () => {
      quote.textContent = `\"${list[i][0]}\"`;
      meta.textContent = list[i][1];
    };
    prev.addEventListener("click", () => {
      i = (i - 1 + list.length) % list.length;
      draw();
    });
    next.addEventListener("click", () => {
      i = (i + 1) % list.length;
      draw();
    });
    window.setInterval(() => {
      i = (i + 1) % list.length;
      draw();
    }, 5200);
  }

  const info = byId("venueInfo");
  const venues = {
    wedding: ["Wedding Venue Coverage", "Timeline-aware ceremony coverage with elegant portrait direction."],
    party: ["Birthday Party Coverage", "Candid moments, guest interactions, and celebration highlights."],
    family: ["Family Outdoor Coverage", "Natural lifestyle portraits and candid family storytelling."],
    sports: ["Sports Arena Coverage", "Fast-action moments and crowd energy captured cleanly."]
  };

  document.querySelectorAll(".venue-btn").forEach((btn) => btn.addEventListener("click", () => {
    document.querySelectorAll(".venue-btn").forEach((x) => x.classList.remove("is-active"));
    btn.classList.add("is-active");
    const v = venues[btn.dataset.venue];
    if (v && info) {
      info.innerHTML = `<h3>${v[0]}</h3><p>${v[1]}</p>`;
    }
  }));
}

function prefillQuoteFromEstimator(form) {
  const session = byId("sportSelect");
  const hours = byId("hoursInput");
  const estimate = byId("estimatePrice");

  if (session) {
    const select = form.querySelector("select[name='eventType']");
    if (select) {
      select.value = session.value;
    }
  }

  if (hours) {
    const coverage = form.querySelector("input[name='coverageHours']");
    if (coverage) {
      coverage.value = hours.value;
    }
  }

  if (estimate) {
    const budget = form.querySelector("select[name='budgetRange']");
    if (budget) {
      const numeric = Number(String(estimate.textContent || "").replace(/[^0-9]/g, ""));
      if (numeric < 1500) budget.value = "under-1500";
      else if (numeric < 3000) budget.value = "1500-3000";
      else if (numeric < 5000) budget.value = "3000-5000";
      else budget.value = "5000-plus";
    }
  }
}

function ensureQuoteModal() {
  let modal = byId("quoteModal");
  if (modal) {
    return modal;
  }

  modal = document.createElement("div");
  modal.className = "quote-modal";
  modal.id = "quoteModal";
  modal.setAttribute("aria-hidden", "true");
  modal.hidden = true;
  modal.innerHTML = `
    <div class="quote-backdrop" data-close-quote-modal></div>
    <section class="quote-dialog" role="dialog" aria-modal="true" aria-labelledby="quoteModalTitle">
      <button class="quote-close" type="button" aria-label="Close quote form" data-close-quote-modal>&times;</button>
      <div class="quote-content">
        <p class="eyebrow">Official Quote Request</p>
        <h2 id="quoteModalTitle">Plan Your Session With ${CONTACT.name}</h2>
        <p class="quote-intro">Choose a request type, then share details so we can respond quickly with the right support.</p>
        <form id="quoteForm" class="quote-form">
          <fieldset class="quote-request-type">
            <legend>Request Type</legend>
            <label class="quote-type-option">
              <input type="radio" name="requestType" value="quote" checked />
              <span class="quote-type-copy">
                <strong>Quote</strong>
                <small>Full pricing + session plan</small>
              </span>
            </label>
            <label class="quote-type-option">
              <input type="radio" name="requestType" value="questions" />
              <span class="quote-type-copy">
                <strong>Questions</strong>
                <small>Quick Q&A before booking</small>
              </span>
            </label>
          </fieldset>

          <div class="quote-grid">
            <label data-shared-field>Full Name
              <input name="fullName" type="text" autocomplete="name" required />
            </label>
            <label data-shared-field>Email
              <input name="email" type="email" autocomplete="email" required />
            </label>
            <label data-shared-field>Phone
              <input name="phone" type="tel" autocomplete="tel" required />
            </label>
            <label data-quote-only>Event Type
              <select name="eventType" required>
                <option value="wedding">Wedding</option>
                <option value="party">Party</option>
                <option value="family">Family</option>
                <option value="kids">Kids</option>
                <option value="sports">Sports</option>
                <option value="corporate">Corporate</option>
              </select>
            </label>
            <label data-quote-only>Event Date
              <input name="eventDate" type="date" required />
            </label>
            <label data-quote-only>City or Venue
              <input name="venue" type="text" placeholder="Miami Beach Convention Center" required />
            </label>
            <label data-quote-only>Coverage Hours
              <input name="coverageHours" type="number" min="1" max="16" value="4" required />
            </label>
            <label data-quote-only>Budget Range
              <select name="budgetRange" required>
                <option value="under-1500">Under $1,500</option>
                <option value="1500-3000">$1,500 - $3,000</option>
                <option value="3000-5000">$3,000 - $5,000</option>
                <option value="5000-plus">$5,000+</option>
              </select>
            </label>
          </div>

          <label id="quoteMessageLabel">Questions and Message
            <span id="quoteMessageRequirement" class="field-meta">Optional for quote requests.</span>
            <textarea name="message" placeholder="Optional: tell us your goals or any special details."></textarea>
          </label>
          <p class="field-meta" id="quoteContactRequirement"></p>

          <div class="quote-options" data-quote-only>
            <label class="quote-option"><input type="checkbox" name="needs" value="same-day-previews" /> Same-day previews</label>
            <label class="quote-option"><input type="checkbox" name="needs" value="album-design" /> Album design</label>
            <label class="quote-option"><input type="checkbox" name="needs" value="social-reels" /> Social reels</label>
            <label class="quote-option"><input type="checkbox" name="needs" value="multi-location" /> Multi-location coverage</label>
          </div>

          <label data-quote-only>Preferred Contact Method
            <select name="preferredContact" required>
              <option value="phone">Phone Call</option>
              <option value="email">Email</option>
              <option value="text">Text Message</option>
            </select>
          </label>

          <p class="quote-status" id="quoteStatus" aria-live="polite"></p>
          <button class="btn btn-primary" type="submit" id="quoteSubmitButton">Send Quote Request</button>
        </form>
      </div>
    </section>
  `;
  document.body.appendChild(modal);
  return modal;
}

function initQuoteModal() {
  const modal = ensureQuoteModal();
  const form = byId("quoteForm");
  const status = byId("quoteStatus");
  const submitButton = byId("quoteSubmitButton");
  const messageField = form?.querySelector("textarea[name='message']");
  const emailField = form?.querySelector("input[name='email']");
  const phoneField = form?.querySelector("input[name='phone']");
  const messageRequirement = byId("quoteMessageRequirement");
  const contactRequirement = byId("quoteContactRequirement");
  const requestTypeOptions = form?.querySelectorAll("input[name='requestType']");
  const quoteOnlyBlocks = form?.querySelectorAll("[data-quote-only]");
  const quoteOnlyControls = form?.querySelectorAll("[data-quote-only] input, [data-quote-only] select, [data-quote-only] textarea");

  if (
    !form
    || !status
    || !submitButton
    || !messageField
    || !emailField
    || !phoneField
    || !requestTypeOptions?.length
    || !quoteOnlyBlocks
    || !quoteOnlyControls
  ) {
    return;
  }

  quoteOnlyControls.forEach((control) => {
    control.dataset.baseRequired = control.required ? "true" : "false";
  });

  const getRequestType = () => String(form.querySelector("input[name='requestType']:checked")?.value || "quote");

  const getSubmitLabel = () => (getRequestType() === "questions" ? "Send Question" : "Send Quote Request");

  const syncContactValidation = () => {
    if (getRequestType() !== "questions") {
      emailField.setCustomValidity("");
      phoneField.setCustomValidity("");
      return true;
    }
    const hasEmail = emailField.value.trim().length > 0;
    const hasPhone = phoneField.value.trim().length > 0;
    const valid = hasEmail || hasPhone;
    const message = valid ? "" : "Enter at least one contact method: email or phone.";
    emailField.setCustomValidity(message);
    phoneField.setCustomValidity(message);
    return valid;
  };

  const syncRequestTypeFields = () => {
    const isQuestionsMode = getRequestType() === "questions";

    quoteOnlyBlocks.forEach((block) => {
      block.hidden = isQuestionsMode;
      block.classList.toggle("is-hidden-by-mode", isQuestionsMode);
    });

    quoteOnlyControls.forEach((control) => {
      const baseRequired = control.dataset.baseRequired === "true";
      control.required = !isQuestionsMode && baseRequired;
    });

    emailField.required = !isQuestionsMode;
    phoneField.required = !isQuestionsMode;

    messageField.required = isQuestionsMode;
    messageField.placeholder = isQuestionsMode
      ? "Tell us what you want to ask and how we can help."
      : "Optional: tell us your goals or any special details.";

    if (messageRequirement) {
      messageRequirement.textContent = isQuestionsMode
        ? "Required for question requests."
        : "Optional for quote requests.";
    }

    if (contactRequirement) {
      contactRequirement.textContent = isQuestionsMode
        ? "For questions: include at least one contact method (email or phone)."
        : "For quote requests: include both email and phone so we can confirm details faster.";
    }

    requestTypeOptions.forEach((option) => {
      option.closest(".quote-type-option")?.classList.toggle("is-selected", option.checked);
    });

    syncContactValidation();
    submitButton.textContent = getSubmitLabel();
  };

  const openModal = () => {
    if (page === "book") {
      prefillQuoteFromEstimator(form);
    }
    syncRequestTypeFields();
    modal.hidden = false;
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  };

  const closeModal = () => {
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    window.setTimeout(() => {
      if (!modal.classList.contains("is-open")) {
        modal.hidden = true;
      }
    }, 220);
  };

  document.querySelectorAll("[data-open-quote-modal]").forEach((trigger) => {
    trigger.addEventListener("click", openModal);
  });

  modal.querySelectorAll("[data-close-quote-modal]").forEach((el) => {
    el.addEventListener("click", closeModal);
  });

  requestTypeOptions.forEach((option) => {
    option.addEventListener("change", syncRequestTypeFields);
  });

  [emailField, phoneField].forEach((field) => {
    field.addEventListener("input", syncContactValidation);
    field.addEventListener("blur", syncContactValidation);
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && modal.classList.contains("is-open")) {
      closeModal();
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    submitButton.disabled = true;
    submitButton.textContent = "Sending...";
    status.className = "quote-status";
    status.textContent = getRequestType() === "questions" ? "Saving your question..." : "Saving your request...";

    if (!syncContactValidation()) {
      submitButton.disabled = false;
      submitButton.textContent = getSubmitLabel();
      status.className = "quote-status is-error";
      status.textContent = "Please add at least one contact method: email or phone.";
      form.reportValidity();
      return;
    }

    try {
      const formData = new FormData(form);
      const payload = {
        requestType: String(formData.get("requestType") || "quote"),
        fullName: String(formData.get("fullName") || "").trim(),
        email: String(formData.get("email") || "").trim(),
        phone: String(formData.get("phone") || "").trim(),
        eventType: String(formData.get("eventType") || ""),
        eventDate: String(formData.get("eventDate") || ""),
        venue: String(formData.get("venue") || "").trim(),
        coverageHours: Number(formData.get("coverageHours") || 0),
        budgetRange: String(formData.get("budgetRange") || ""),
        message: String(formData.get("message") || "").trim(),
        needs: formData.getAll("needs"),
        preferredContact: String(formData.get("preferredContact") || "")
      };

      const targetCollection = payload.requestType === "questions" ? "question_requests" : "quote_requests";
      if (payload.requestType === "questions") {
        payload.eventType = "";
        payload.eventDate = "";
        payload.venue = "";
        payload.coverageHours = 0;
        payload.budgetRange = "";
        payload.needs = [];
        payload.preferredContact = payload.email ? "email" : "phone";
      }

      const result = await saveSubmission(targetCollection, payload);
      status.className = "quote-status is-success";
      if (result.stored === "firebase") {
        status.textContent = payload.requestType === "questions"
          ? "Question sent to Firebase. Alyssa will respond soon."
          : "Quote request sent to Firebase. Alyssa will contact you soon.";
        form.reset();
        syncRequestTypeFields();
        window.setTimeout(closeModal, 1200);
      } else {
        status.className = "quote-status is-warning";
        status.textContent = result.reason === "firebase-write-failed"
          ? "Saved on this device only. Firebase write was blocked (check Firestore rules)."
          : "Saved on this device only. Add Firebase web config to send requests to Firestore.";
      }
    } catch {
      status.className = "quote-status is-error";
      status.textContent = "We could not save your request right now. Please try again.";
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = getSubmitLabel();
    }
  });

  syncRequestTypeFields();
}

function initBook() {
  const session = byId("sportSelect");
  const hours = byId("hoursInput");
  const hoursValue = byId("hoursValue");
  const deliverable = byId("deliverableSelect");
  const month = byId("monthSelect");
  const price = byId("estimatePrice");
  const meta = byId("estimateMeta");
  const availability = byId("availabilityMeter");
  const form = byId("bookingForm");
  if (!session || !hours || !hoursValue || !deliverable || !month || !price || !meta || !availability || !form) {
    return;
  }

  const rates = { wedding: 420, party: 290, family: 250, kids: 240, sports: 300, corporate: 360 };
  const multipliers = { standard: 1, social: 1.24, full: 1.55 };
  const load = { jan: "Medium", feb: "Medium", mar: "High", apr: "High", may: "High", jun: "High", jul: "High", aug: "High", sep: "High", oct: "High", nov: "Medium", dec: "Medium" };

  const refresh = () => {
    const base = rates[session.value] || 260;
    const total = Math.round((base * Number(hours.value) + (Number(hours.value) > 6 ? 140 : 80)) * (multipliers[deliverable.value] || 1));
    price.textContent = money(total);
    meta.textContent = `${session.options[session.selectedIndex].text} | ${hours.value} hours | ${deliverable.options[deliverable.selectedIndex].text}`;
    availability.textContent = `Availability: ${load[month.value] || "Medium"}`;
  };

  hours.addEventListener("input", () => {
    hoursValue.textContent = hours.value;
    refresh();
  });
  [session, deliverable, month].forEach((x) => x.addEventListener("change", refresh));

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    refresh();
    byId("estimateCard")?.scrollIntoView({ behavior: "smooth", block: "center" });

    const payload = {
      sessionType: session.value,
      coverageHours: Number(hours.value),
      deliverable: deliverable.value,
      month: month.value,
      estimateText: price.textContent,
      availability: availability.textContent
    };

    try {
      await saveSubmission("estimate_requests", payload);
    } catch (error) {
      // Keep estimator UX smooth when database is not yet configured.
    }
  });

  document.querySelectorAll(".faq-item").forEach((item, i, arr) => {
    item.querySelector(".faq-question")?.addEventListener("click", () => {
      const open = item.classList.contains("is-open");
      arr.forEach((x) => x.classList.remove("is-open"));
      if (!open) {
        item.classList.add("is-open");
      }
    });
    if (i === 0) {
      item.classList.add("is-open");
    }
  });

  refresh();
}

initGlobal();
initPageHeroNodeBackground();
initSharedLiveBand();
initQuoteModal();
if (page === "home") initHome();
if (page === "gallery") initGallery();
if (page === "services") initServices();
if (page === "results") initResults();
if (page === "book") initBook();
