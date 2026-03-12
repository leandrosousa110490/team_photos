(() => {
  "use strict";

  const byId = (id) => document.getElementById(id);

  let editor = null;

  function createPlaceholderImage() {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000">
        <defs>
          <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#1060ff" />
            <stop offset="50%" stop-color="#1ab26b" />
            <stop offset="100%" stop-color="#ff5a1f" />
          </linearGradient>
        </defs>
        <rect width="1600" height="1000" fill="url(#g)" />
        <circle cx="280" cy="240" r="220" fill="rgba(255,255,255,0.18)" />
        <circle cx="1360" cy="760" r="280" fill="rgba(15,30,68,0.22)" />
        <text x="800" y="510" fill="#ffffff" text-anchor="middle" font-family="Manrope, Arial, sans-serif" font-size="84" font-weight="800">
          EdgeFrame Editor
        </text>
      </svg>
    `;
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  }

  function ensureEditor() {
    if (editor) return editor;
    const root = byId("tuiEditorRoot");
    if (!root || !window.tui?.ImageEditor) return null;

    const originalImageUrl = createPlaceholderImage();
    editor = new window.tui.ImageEditor(root, {
      includeUI: {
        loadImage: {
          path: originalImageUrl,
          name: "EdgeFrame Template"
        },
        menu: ["crop", "flip", "rotate", "draw", "shape", "icon", "text", "mask", "filter"],
        initMenu: "filter",
        menuBarPosition: "bottom",
        uiSize: {
          width: "100%",
          height: "100%"
        }
      },
      cssMaxWidth: 4000,
      cssMaxHeight: 4000,
      usageStatistics: false,
      selectionStyle: {
        cornerSize: 18,
        rotatingPointOffset: 70
      }
    });
    // Allow layout to settle once after mount.
    window.setTimeout(() => {
      window.dispatchEvent(new Event("resize"));
    }, 120);
    return editor;
  }

  function reactToAuthState() {
    const dashboard = byId("dashboard");
    if (!dashboard) return;
    if (!dashboard.hidden) {
      ensureEditor();
    }
  }

  function setupAuthSync() {
    document.addEventListener("edgeframe-admin-auth", (event) => {
      if (event?.detail?.isAuthed) {
        ensureEditor();
      }
    });

    const dashboard = byId("dashboard");
    if (dashboard) {
      const observer = new MutationObserver(() => {
        reactToAuthState();
      });
      observer.observe(dashboard, { attributes: true, attributeFilter: ["hidden"] });
    }

    window.setTimeout(reactToAuthState, 30);
    window.setTimeout(reactToAuthState, 180);
    window.setTimeout(reactToAuthState, 380);
  }

  setupAuthSync();
})();
