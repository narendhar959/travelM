/* ============================================================
   TravelMate — Cinematic transition engine
   ------------------------------------------------------------
   A single reusable system that gives every travel category its
   own motion identity, plays it while navigating to the real
   existing pages, and reuses the same artwork for booking-success
   animations. No external libraries: SVG + CSS + Web Animations.

   Public API
     window.travelGoto(type)                  -> animate then navigate
     window.TravelTransitions.goTo(type)
     window.TravelTransitions.playSuccess(type, options)
     window.TravelTransitions.runServiceAnimation(type, options)
     window.TravelTransitions.prefersReducedMotion()
   ============================================================ */
(function () {
  "use strict";

  var REVEAL_KEY = "travelmate_transition";
  var NAV_FALLBACK = 1400;   // hard safety: never block navigation longer than this
  var running = false;

  /* ----------------------------------------------------------
     Category registry — page, label, caption, motion duration
     ---------------------------------------------------------- */
  var SERVICE = {
    flight:    { page: "flights.html",    label: "Flights",   caption: "Taking off",        dur: 1150, stage: "tt-stage-flight" },
    train:     { page: "trains.html",     label: "Trains",    caption: "Departing",         dur: 1200, stage: "tt-stage-train" },
    cab:       { page: "cabs.html",       label: "Cabs",      caption: "On the way",        dur: 1200, stage: "tt-stage-ride" },
    cruise:    { page: "cruise.html",     label: "Cruise",    caption: "Setting sail",      dur: 1250, stage: "tt-stage-cruise" },
    bus:       { page: "buses.html",      label: "Buses",     caption: "Rolling out",       dur: 1100, stage: "tt-stage-ride" },
    tour:      { page: "tours.html",      label: "Trip planner", caption: "Building your itinerary", dur: 2200, stage: "tt-stage-tour" },
    hotel:     { page: "hotels.html",     label: "Hotels",    caption: "Checking in",       dur: 1200, stage: "tt-stage-hotel" },
    insurance: { page: "insurance.html",  label: "Insurance", caption: "Covered",           dur: 1150, stage: "tt-stage-insurance" },
    generic:   { page: "main.html",       label: "TravelMate",caption: "TravelMate",        dur: 700,  stage: "tt-stage-generic" }
  };

  var TYPE_LABELS = {
    flight: "Flight", train: "Train", cab: "Cab", bus: "Bus",
    cruise: "Cruise", hotel: "Hotel", tour: "Tour package",
    insurance: "Insurance", generic: "Booking"
  };

  /* ----------------------------------------------------------
     SVG artwork (shared by transitions and success animations)
     ---------------------------------------------------------- */
  var ART = {
    flight:
      '<svg viewBox="0 0 240 112" width="220" aria-hidden="true">' +
        '<g fill="#ffffff">' +
          '<path d="M8 62 C60 44 122 30 198 12 L208 26 C152 44 96 60 44 76 Z"/>' +
          '<path d="M100 52 L152 86 L170 80 L132 40 Z"/>' +
          '<path d="M124 44 L100 92 L118 94 L150 50 Z" fill="#d5f3f3"/>' +
          '<path d="M198 12 L232 6 L216 32 L202 30 Z" fill="#eafbfb"/>' +
        '</g>' +
        '<circle cx="62" cy="66" r="5" fill="#0b8b95"/>' +
      '</svg>',

    train:
      '<svg viewBox="0 0 420 150" width="400" aria-hidden="true">' +
        '<rect x="8" y="44" width="182" height="78" rx="14" fill="#eaf8f8"/>' +
        '<g fill="#1d9aa3">' +
          '<rect x="26" y="60" width="34" height="26" rx="6"/>' +
          '<rect x="70" y="60" width="34" height="26" rx="6"/>' +
          '<rect x="114" y="60" width="34" height="26" rx="6"/>' +
          '<rect x="152" y="60" width="24" height="26" rx="6"/>' +
        '</g>' +
        '<path d="M196 44 h150 a20 20 0 0 1 20 20 v46 a10 10 0 0 1 -10 10 h-160 z" fill="#ffffff"/>' +
        '<rect x="216" y="58" width="52" height="34" rx="8" fill="#0b6d78"/>' +
        '<rect x="286" y="28" width="16" height="30" rx="4" fill="#eaf8f8"/>' +
        '<circle cx="352" cy="94" r="9" fill="#ffd166"/>' +
        '<g fill="#123c3c">' +
          '<circle class="tt-wheel" cx="52" cy="124" r="15"/>' +
          '<circle class="tt-wheel" cx="112" cy="124" r="15"/>' +
          '<circle class="tt-wheel" cx="176" cy="124" r="15"/>' +
          '<circle class="tt-wheel" cx="250" cy="124" r="15"/>' +
          '<circle class="tt-wheel" cx="330" cy="124" r="15"/>' +
        '</g>' +
        '<g fill="#8fd6da">' +
          '<circle cx="52" cy="124" r="5"/><circle cx="112" cy="124" r="5"/>' +
          '<circle cx="176" cy="124" r="5"/><circle cx="250" cy="124" r="5"/>' +
          '<circle cx="330" cy="124" r="5"/>' +
        '</g>' +
      '</svg>',

    cab:
      '<svg viewBox="0 0 120 200" width="104" aria-hidden="true">' +
        '<rect x="18" y="14" width="84" height="172" rx="30" fill="#ffffff"/>' +
        '<rect x="28" y="46" width="64" height="46" rx="16" fill="#0b8b95"/>' +
        '<rect x="28" y="104" width="64" height="40" rx="14" fill="#bfeef0"/>' +
        '<rect x="30" y="26" width="16" height="14" rx="6" fill="#ffd166"/>' +
        '<rect x="74" y="26" width="16" height="14" rx="6" fill="#ffd166"/>' +
        '<rect x="28" y="164" width="18" height="12" rx="5" fill="#ff6b6b"/>' +
        '<rect x="74" y="164" width="18" height="12" rx="5" fill="#ff6b6b"/>' +
        '<circle cx="16" cy="60" r="9" fill="#123c3c"/><circle cx="104" cy="60" r="9" fill="#123c3c"/>' +
        '<circle cx="16" cy="150" r="9" fill="#123c3c"/><circle cx="104" cy="150" r="9" fill="#123c3c"/>' +
      '</svg>',

    bus:
      '<svg viewBox="0 0 460 176" width="420" aria-hidden="true">' +
        '<rect x="10" y="26" width="440" height="112" rx="20" fill="#ffffff"/>' +
        '<g fill="#0b8b95">' +
          '<rect x="30" y="46" width="70" height="40" rx="8"/>' +
          '<rect x="112" y="46" width="70" height="40" rx="8"/>' +
          '<rect x="194" y="46" width="70" height="40" rx="8"/>' +
          '<rect x="276" y="46" width="70" height="40" rx="8"/>' +
        '</g>' +
        '<rect x="358" y="46" width="72" height="40" rx="8" fill="#bfeef0"/>' +
        '<rect x="368" y="98" width="60" height="34" rx="8" fill="#eaf8f8"/>' +
        '<circle class="tt-wheel" cx="96" cy="146" r="18" fill="#123c3c"/>' +
        '<circle class="tt-wheel" cx="366" cy="146" r="18" fill="#123c3c"/>' +
        '<circle cx="96" cy="146" r="6" fill="#8fd6da"/>' +
        '<circle cx="366" cy="146" r="6" fill="#8fd6da"/>' +
      '</svg>',

    cruise:
      '<svg viewBox="0 0 440 205" width="400" aria-hidden="true">' +
        '<path d="M40 132 h360 l-44 54 H96 Z" fill="#ffffff"/>' +
        '<path d="M84 132 L118 72 h60 v60 Z" fill="#eaf8f8"/>' +
        '<rect x="128" y="32" width="34" height="40" rx="8" fill="#ffffff"/>' +
        '<rect x="168" y="52" width="38" height="24" rx="6" fill="#bfeef0"/>' +
        '<rect x="222" y="82" width="152" height="26" rx="10" fill="#eaf8f8"/>' +
        '<rect x="128" y="14" width="6" height="20" rx="3" fill="#ffd166"/>' +
        '<g fill="#0b8b95">' +
          '<circle cx="142" cy="112" r="7"/><circle cx="170" cy="112" r="7"/>' +
          '<circle cx="198" cy="112" r="7"/><circle cx="226" cy="112" r="7"/>' +
          '<circle cx="254" cy="112" r="7"/><circle cx="282" cy="112" r="7"/>' +
        '</g>' +
      '</svg>',

    shield:
      '<svg viewBox="0 0 200 232" width="180" aria-hidden="true">' +
        '<path d="M100 8 L182 40 V116 C182 172 146 208 100 224 C54 208 18 172 18 116 V40 Z" fill="#ffffff" opacity="0.18"/>' +
        '<path d="M100 8 L182 40 V116 C182 172 146 208 100 224 C54 208 18 172 18 116 V40 Z" fill="none" stroke="#ffffff" stroke-width="8"/>' +
        '<path class="tt-check-path" d="M56 118 L88 152 L148 84"/>' +
      '</svg>',

    landmarks:
      '<svg viewBox="0 0 200 180" width="150" aria-hidden="true"><g fill="rgba(255,255,255,0.95)">' +
        '<ellipse cx="100" cy="64" rx="26" ry="30"/><rect x="86" y="20" width="28" height="26" rx="6"/>' +
        '<rect x="74" y="90" width="52" height="68" rx="6"/>' +
        '<rect x="18" y="48" width="14" height="110" rx="7"/><rect x="168" y="48" width="14" height="110" rx="7"/>' +
        '<circle cx="25" cy="44" r="8"/><circle cx="175" cy="44" r="8"/>' +
        '<rect x="26" y="156" width="148" height="10" rx="5"/></g></svg>',

    pyramid:
      '<svg viewBox="0 0 220 160" width="176" aria-hidden="true"><g>' +
        '<path d="M20 150 L110 22 L200 150 Z" fill="rgba(255,255,255,0.95)"/>' +
        '<path d="M110 22 L152 150 L200 150 Z" fill="rgba(255,255,255,0.72)"/></g></svg>',

    eiffel:
      '<svg viewBox="0 0 160 210" width="126" aria-hidden="true"><g fill="rgba(255,255,255,0.95)">' +
        '<path d="M80 6 l11 28 h-22 Z"/><path d="M70 34 h20 l7 44 h-34 Z"/>' +
        '<path d="M64 78 h32 l15 86 h-62 Z"/>' +
        '<path d="M36 116 a44 24 0 0 1 88 0 v16 h-88 Z"/>' +
        '<rect x="16" y="150" width="128" height="10" rx="5"/>' +
        '<rect x="8" y="186" width="144" height="12" rx="6"/></g></svg>',

    temple:
      '<svg viewBox="0 0 200 174" width="144" aria-hidden="true"><g fill="rgba(255,255,255,0.95)">' +
        '<path d="M100 6 l58 40 H42 Z"/><rect x="60" y="46" width="80" height="32"/>' +
        '<path d="M100 50 l70 34 H30 Z"/><rect x="46" y="84" width="108" height="38"/>' +
        '<path d="M100 90 l84 38 H16 Z"/><rect x="28" y="128" width="144" height="30" rx="6"/></g></svg>'
  };

  function hotelArt() {
    var windows = "", cols = 5, rows = 6, x0 = 96, y0 = 124, dx = 40, dy = 52, r, c, delay;
    for (r = 0; r < rows; r++) {
      for (c = 0; c < cols; c++) {
        delay = (0.45 + r * 0.11 + c * 0.05).toFixed(2);
        windows += '<rect class="tt-window" x="' + (x0 + c * dx) + '" y="' + (y0 + r * dy) +
          '" width="22" height="30" rx="4" fill="#ffd98a" style="animation-delay:' + delay + 's"/>';
      }
    }
    return '<svg viewBox="0 0 440 492" width="322" aria-hidden="true">' +
      '<rect x="72" y="86" width="296" height="394" rx="16" fill="#0a3340" stroke="rgba(255,255,255,0.5)" stroke-width="3"/>' +
      '<rect x="176" y="42" width="88" height="46" rx="10" fill="#ffffff"/>' +
      '<rect x="196" y="16" width="10" height="28" rx="5" fill="#ffd166"/>' +
      windows +
      '<rect x="190" y="404" width="60" height="76" rx="8" fill="#ffd166" opacity="0.9"/>' +
      '<rect x="52" y="474" width="336" height="14" rx="7" fill="rgba(255,255,255,0.7)"/>' +
    '</svg>';
  }

  function wavesArt() {
    return '<div class="tt-waves"><span></span><span></span></div>';
  }

  function landmarksArt() {
    return '<div class="tt-landmarks">' +
      '<div class="tt-landmark">' + ART.temple + '</div>' +
      '<div class="tt-landmark">' + ART.pyramid + '</div>' +
      '<div class="tt-landmark">' + ART.landmarks + '</div>' +
      '<div class="tt-landmark">' + ART.eiffel + '</div>' +
    '</div><div class="tt-sun"></div>';
  }

  function itineraryArt() {
    return '<div class="tt-itinerary-route" aria-hidden="true"><i></i><i></i><i></i></div>' +
      '<section class="tt-itinerary-card" aria-hidden="true">' +
        '<div class="tt-itinerary-head"><span class="tt-itinerary-pin"></span><span>Your tour plan</span></div>' +
        '<div class="tt-itinerary-row"><b>Day 1</b><em></em><span>Arrival & local sights</span></div>' +
        '<div class="tt-itinerary-row"><b>Day 2</b><em></em><span>Experiences & discovery</span></div>' +
        '<div class="tt-itinerary-row"><b>Day 3</b><em></em><span>Memories to take home</span></div>' +
      '</section>';
  }

  /* ----------------------------------------------------------
     Scene builders — one per motion identity
     ---------------------------------------------------------- */
  var BUILDERS = {
    flight: function () {
      return '<div class="tt-fx"></div>' +
        '<div class="tt-actor"><div class="tt-contrail"></div>' + ART.flight + '</div>';
    },
    train: function () {
      return '<div class="tt-fx"></div><div class="tt-actor">' + ART.train + '</div>';
    },
    cab: function () {
      return '<div class="tt-fx"></div>' +
        '<div class="tt-road" aria-hidden="true"><svg viewBox="0 0 600 760" preserveAspectRatio="none">' +
        '<path d="M300 740 C170 620 460 520 300 400 C150 290 430 200 320 20"/></svg></div>' +
        '<div class="tt-actor">' + ART.cab + '</div>';
    },
    cruise: function () {
      return '<div class="tt-actor"><div class="tt-bob">' + ART.cruise + '</div></div>' + wavesArt();
    },
    bus: function () {
      return '<div class="tt-fx"></div><div class="tt-actor">' + ART.bus + '</div>';
    },
    tour: function () { return itineraryArt(); },
    hotel: function () {
      return '<div class="tt-fx"></div><div class="tt-actor">' + hotelArt() + '</div>';
    },
    insurance: function () {
      return '<div class="tt-fx"></div><div class="tt-actor">' + ART.shield + '</div>';
    },
    generic: function () {
      return '<div class="tt-actor">' + ART.flight + '</div>';
    }
  };

  /* ----------------------------------------------------------
     Helpers
     ---------------------------------------------------------- */
  function prefersReducedMotion() {
    return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }

  function ensureStylesheet() {
    if (document.getElementById("tt-styles")) return;
    var link = document.createElement("link");
    link.id = "tt-styles";
    link.rel = "stylesheet";
    link.href = "travel-transitions.css";
    document.head.appendChild(link);
  }

  function resolveType(href) {
    if (!href) return null;
    var clean = String(href).split("#")[0].split("?")[0];
    var name = clean.substring(clean.lastIndexOf("/") + 1).toLowerCase();
    for (var key in SERVICE) {
      if (SERVICE[key].page === name) return key;
    }
    return null;
  }

  function playScene(type, markup) {
    ensureStylesheet();
    var root = document.documentElement;
    // Never stack overlays: if one is already on screen, bail out.
    if (document.getElementById("tt-overlay")) return null;

    root.classList.add("tt-lock");
    var overlay = document.createElement("div");
    overlay.className = "tt-overlay tt-" + type;
    overlay.id = "tt-overlay";

    var backdrop = document.createElement("div");
    backdrop.className = "tt-backdrop";

    var scene = document.createElement("div");
    scene.className = "tt-scene";
    scene.innerHTML = markup;

    overlay.appendChild(backdrop);
    overlay.appendChild(scene);

    var caption = (SERVICE[type] || SERVICE.generic).caption;
    if (caption) {
      var cap = document.createElement("div");
      cap.className = "tt-caption";
      cap.textContent = caption;
      overlay.appendChild(cap);
    }

    document.body.appendChild(overlay);
    // Force reflow so the entry transitions actually animate.
    void overlay.offsetWidth;
    overlay.classList.add("tt-visible");
    return overlay;
  }

  function teardownOverlay(overlay) {
    if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
    if (!document.getElementById("tt-overlay")) {
      document.documentElement.classList.remove("tt-lock");
    }
  }

  /* ----------------------------------------------------------
     Navigation with a per-category transition
     ---------------------------------------------------------- */
  function goTo(type) {
    var cfg = SERVICE[type] || SERVICE.generic;

    if (prefersReducedMotion()) {
      window.location.href = cfg.page;
      return;
    }

    try { sessionStorage.setItem(REVEAL_KEY, type); } catch (e) { /* storage may be blocked */ }

    var overlay = playScene(type, BUILDERS[type] ? BUILDERS[type]() : BUILDERS.generic());
    var revealDelay = Math.max(220, cfg.dur - 340);
    var fallbackDelay = Math.max(NAV_FALLBACK, cfg.dur + 250);
    var navigated = false;

    function navigate() {
      if (navigated) return;
      navigated = true;
      window.location.href = cfg.page;
    }

    // Primary reveal, anchored to the animation length.
    window.setTimeout(navigate, revealDelay);

    // Hard safety net: if the reveal never fires, keep the app usable anyway.
    window.setTimeout(function () {
      teardownOverlay(overlay);
      navigate();
    }, fallbackDelay);
  }

  function goToSafely(type) {
    if (running) return;            // block accidental double navigation
    running = true;
    var cfg = SERVICE[type] || SERVICE.generic;
    window.setTimeout(function () { running = false; }, Math.max(NAV_FALLBACK, cfg.dur + 250) + 600);
    goTo(type);
  }

  /* ----------------------------------------------------------
     Standalone animation (no navigation) — used for previews
     ---------------------------------------------------------- */
  function runServiceAnimation(type, options) {
    options = options || {};
    if (prefersReducedMotion()) return null;
    var cfg = SERVICE[type] || SERVICE.generic;
    var overlay = playScene(type, BUILDERS[type] ? BUILDERS[type]() : BUILDERS.generic());
    if (!overlay) return null;
    var dur = options.duration || cfg.dur;
    window.setTimeout(function () { teardownOverlay(overlay); }, dur + 400);
    return overlay;
  }

  /* ----------------------------------------------------------
     Booking success animation
     ---------------------------------------------------------- */
  function playSuccess(type, options) {
    options = options || {};
    if (prefersReducedMotion()) {
      if (options.onFinish) options.onFinish();
      return null;
    }
    ensureStylesheet();
    type = SERVICE[type] ? type : "generic";

    var overlay = document.createElement("div");
    overlay.className = "tt-overlay tt-success tt-" + type;
    overlay.id = "tt-success-overlay";

    var builder = BUILDERS[type === "generic" ? "generic" : type] || BUILDERS.generic;
    var stage = '<div class="tt-success-stage tt-scene">' + builder() + '</div>';

    var title = options.title || "Booking Confirmed!";
    var subtitle = options.subtitle || ("Your " + TYPE_LABELS[type].toLowerCase() + " booking was successful.");

    var metaHtml = "";
    if (options.details && options.details.length) {
      metaHtml = '<div class="tt-success-meta">';
      options.details.forEach(function (d) {
        metaHtml += '<div><span>' + d.label + '</span><strong>' + d.value + '</strong></div>';
      });
      metaHtml += "</div>";
    }

    var card = document.createElement("div");
    card.className = "tt-success-card";
    card.setAttribute("role", "dialog");
    card.setAttribute("aria-modal", "true");
    card.setAttribute("aria-label", title);
    card.innerHTML = stage +
      '<h4 class="tt-success-title">' + title + "</h4>" +
      '<p class="tt-success-sub">' + subtitle + "</p>" +
      metaHtml +
      '<button type="button" class="tt-success-btn">' + (options.buttonLabel || "View My Ticket") + "</button>" +
      '<p class="tt-success-hint">Press Esc or click outside to close</p>';

    overlay.appendChild(card);
    document.body.appendChild(overlay);
    void overlay.offsetWidth;
    overlay.classList.add("tt-visible");

    var closed = false;
    function close() {
      if (closed) return;
      closed = true;
      overlay.classList.remove("tt-visible");
      document.removeEventListener("keydown", onKey);
      window.setTimeout(function () {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        if (options.onClose) options.onClose();
      }, 300);
      if (options.onFinish) options.onFinish();
    }
    function onKey(e) { if (e.key === "Escape") close(); }

    card.querySelector(".tt-success-btn").addEventListener("click", close);
    overlay.addEventListener("click", function (e) { if (e.target === overlay) close(); });
    document.addEventListener("keydown", onKey);

    if (options.autoClose) window.setTimeout(close, options.autoClose);
    return close;
  }

  /* ----------------------------------------------------------
     Destination-page reveal (runs on the page we arrived at)
     ---------------------------------------------------------- */
  var REVEAL_TYPES = { flight: 1, train: 1, cab: 1, bus: 1, cruise: 1, tour: 1, hotel: 1, insurance: 1, generic: 1 };

  function applyPageReveal() {
    var type;
    try {
      type = sessionStorage.getItem(REVEAL_KEY);
      if (type) sessionStorage.removeItem(REVEAL_KEY);
    } catch (e) { return; }
    if (!type || !REVEAL_TYPES[type] || prefersReducedMotion()) return;

    var root = document.documentElement;
    root.setAttribute("data-tt-enter", type);
    window.setTimeout(function () { root.removeAttribute("data-tt-enter"); }, 950);
  }

  /* ----------------------------------------------------------
     Auto-wiring: intercept internal page links that map to a
     travel category, so the animation plays with real routing.
     ---------------------------------------------------------- */
  function isPlainLeftClick(e) {
    return e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;
  }

  function wireLinks() {
    document.addEventListener("click", function (e) {
      if (!isPlainLeftClick(e) || e.defaultPrevented) return;
      if (prefersReducedMotion()) return;                 // let the browser navigate normally

      var el = e.target;
      while (el && el !== document.body && el.tagName !== "A") el = el.parentNode;
      if (!el || el.tagName !== "A") return;
      if (el.target && el.target !== "_self") return;
      if (el.hasAttribute("data-no-transition")) return;

      var type = resolveType(el.getAttribute("href"));
      if (!type) return;                                   // unknown page -> normal navigation

      // Let the page's own handler decide when there is one that navigates itself.
      if (el.hasAttribute("data-tt-manual")) return;

      e.preventDefault();
      goToSafely(type);
    }, false);
  }

  /* ----------------------------------------------------------
     Boot
     ---------------------------------------------------------- */
  function init() {
    ensureStylesheet();
    applyPageReveal();
    wireLinks();
    window.setTimeout(applyPageReveal, 60);   // covers deferred/slow DOMContentLoaded
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.TravelTransitions = {
    services: SERVICE,
    buildScene: function (type) { return (BUILDERS[type] || BUILDERS.generic)(); },
    goTo: goToSafely,
    runServiceAnimation: runServiceAnimation,
    playSuccess: playSuccess,
    resolveType: resolveType,
    prefersReducedMotion: prefersReducedMotion
  };
  window.travelGoto = goToSafely;
})();
