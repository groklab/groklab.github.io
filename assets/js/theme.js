(() => {
  "use strict";

  const storageKey = "groklab.theme.v1";
  const root = document.documentElement;
  const systemTheme = window.matchMedia("(prefers-color-scheme: dark)");

  const storedTheme = () => {
    try {
      const value = window.localStorage.getItem(storageKey);
      return value === "light" || value === "dark" ? value : null;
    } catch {
      return null;
    }
  };

  const setStoredTheme = (value) => {
    try {
      window.localStorage.setItem(storageKey, value);
    } catch {
      // A blocked storage API should not disable the theme control.
    }
  };

  const resolvedTheme = () =>
    root.dataset.theme || (systemTheme.matches ? "dark" : "light");

  const saved = storedTheme();
  if (saved) {
    root.dataset.theme = saved;
  }

  const initializeToggle = () => {
    const toggle = document.querySelector("[data-theme-toggle]");
    if (!(toggle instanceof HTMLButtonElement)) {
      return;
    }

    const updateLabel = () => {
      const current = resolvedTheme();
      const next = current === "dark" ? "light" : "dark";
      toggle.dataset.themeCurrent = current;
      toggle.setAttribute(
        "aria-label",
        current === "dark"
          ? "当前为深色主题，切换到浅色主题"
          : "当前为浅色主题，切换到深色主题",
      );
      toggle.title = next === "dark" ? "切换到深色主题" : "切换到浅色主题";
    };

    toggle.hidden = false;
    updateLabel();

    toggle.addEventListener("click", () => {
      const next = resolvedTheme() === "dark" ? "light" : "dark";
      root.dataset.theme = next;
      setStoredTheme(next);
      updateLabel();
    });

    const followSystem = () => {
      if (!root.dataset.theme) {
        updateLabel();
      }
    };
    if (typeof systemTheme.addEventListener === "function") {
      systemTheme.addEventListener("change", followSystem);
    } else if (typeof systemTheme.addListener === "function") {
      systemTheme.addListener(followSystem);
    }

    window.addEventListener("storage", (event) => {
      if (event.key !== storageKey) {
        return;
      }
      if (event.newValue === "light" || event.newValue === "dark") {
        root.dataset.theme = event.newValue;
      } else {
        delete root.dataset.theme;
      }
      updateLabel();
    });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeToggle, { once: true });
  } else {
    initializeToggle();
  }
})();
