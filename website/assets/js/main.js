/* Omega Client website - shared behavior: nav, reveal animations, OS-aware download buttons */

(function () {
  "use strict";

  var RELEASE_BASE = "https://github.com/dsdocai-ops/Mods/releases/download/latest-build/";
  var RELEASE_PAGE = "https://github.com/dsdocai-ops/Mods/releases/tag/latest-build";

  var DOWNLOADS = {
    windows: {
      label: "Download for Windows",
      file: "OmegaClient-Setup.exe",
      note: "Installer · auto-updates"
    },
    mac: {
      label: "Download for macOS",
      file: "OmegaClient-arm64.dmg",
      note: "Apple Silicon · .dmg"
    },
    linux: {
      label: "Download for Linux",
      file: "OmegaClient-x86_64.AppImage",
      note: "x86_64 · AppImage"
    }
  };

  function detectOS() {
    var ua = navigator.userAgent;
    if (/Windows/i.test(ua)) return "windows";
    if (/Macintosh|Mac OS X/i.test(ua)) return "mac";
    if (/Linux|X11/i.test(ua) && !/Android/i.test(ua)) return "linux";
    return null;
  }

  /* Sticky nav background */
  var nav = document.querySelector(".nav");
  function onScroll() {
    if (!nav) return;
    nav.classList.toggle("scrolled", window.scrollY > 12);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* Mobile menu */
  var burger = document.querySelector(".nav-burger");
  var links = document.querySelector(".nav-links");
  if (burger && links) {
    burger.addEventListener("click", function () {
      var open = links.classList.toggle("open");
      burger.setAttribute("aria-expanded", open ? "true" : "false");
    });
    links.addEventListener("click", function (e) {
      if (e.target.tagName === "A") links.classList.remove("open");
    });
  }

  /* Reveal-on-scroll */
  var revealed = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && revealed.length) {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("in");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    revealed.forEach(function (el) { io.observe(el); });
  } else {
    revealed.forEach(function (el) { el.classList.add("in"); });
  }

  /* OS-aware primary download buttons ([data-os-download]) */
  var os = detectOS();
  document.querySelectorAll("[data-os-download]").forEach(function (btn) {
    var target = os ? DOWNLOADS[os] : null;
    if (target) {
      btn.href = RELEASE_BASE + target.file;
      var labelEl = btn.querySelector(".dl-label");
      var subEl = btn.querySelector(".sub");
      if (labelEl) labelEl.textContent = target.label;
      if (subEl) subEl.textContent = target.note;
    } else {
      btn.href = RELEASE_PAGE;
      var l = btn.querySelector(".dl-label");
      if (l) l.textContent = "Download Omega Client";
    }
  });

  /* Highlight the visitor's platform card on the download page */
  if (os) {
    var mine = document.querySelector('.dl-card[data-os="' + os + '"]');
    if (mine && !mine.classList.contains("recommended")) {
      mine.classList.add("recommended");
      var flag = document.createElement("span");
      flag.className = "dl-flag";
      flag.textContent = "Your platform";
      mine.appendChild(flag);
    }
  }

  /* Footer year */
  document.querySelectorAll("[data-year]").forEach(function (el) {
    el.textContent = String(new Date().getFullYear());
  });
})();
