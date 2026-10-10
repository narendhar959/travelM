/* ============================================================
   TravelMate — shared message box
   Use tmNotify(...) anywhere instead of the native alert().
     tmNotify(title, message, type)   type: "info" | "success" | "error"
   ============================================================ */
(function () {
  "use strict";

  function ensureStyles() {
    if (document.getElementById("tm-notice-styles")) return;
    var link = document.createElement("link");
    link.id = "tm-notice-styles";
    link.rel = "stylesheet";
    link.href = "travel-message.css";
    document.head.appendChild(link);
  }

  function stack() {
    var el = document.querySelector(".tm-notice-stack");
    if (!el) {
      el = document.createElement("div");
      el.className = "tm-notice-stack";
      document.body.appendChild(el);
    }
    return el;
  }

  function notify(title, message, type, timeout) {
    ensureStyles();
    type = type || "info";
    timeout = timeout === undefined ? 5200 : timeout;

    var box = document.createElement("div");
    box.className = "tm-notice tm-" + type;
    box.setAttribute("role", type === "error" ? "alert" : "status");

    var titleEl = document.createElement("div");
    titleEl.className = "tm-notice-title";
    titleEl.textContent = title || "Notice";

    var bodyEl = document.createElement("div");
    bodyEl.className = "tm-notice-body";
    bodyEl.textContent = message || "";

    var closeBtn = document.createElement("button");
    closeBtn.className = "tm-notice-close";
    closeBtn.type = "button";
    closeBtn.setAttribute("aria-label", "Dismiss message");
    closeBtn.textContent = "\u00d7";

    function dismiss() {
      box.classList.add("tm-hide");
      window.setTimeout(function () { if (box.parentNode) box.parentNode.removeChild(box); }, 320);
    }
    closeBtn.addEventListener("click", dismiss);

    box.appendChild(titleEl);
    box.appendChild(bodyEl);
    box.appendChild(closeBtn);
    stack().appendChild(box);

    void box.offsetWidth;
    box.classList.add("tm-show");

    if (timeout > 0) window.setTimeout(dismiss, timeout);
    return box;
  }

  window.tmNotify = notify;
})();
