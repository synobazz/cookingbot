"use client";

import { useEffect } from "react";

const HIDE_AFTER_PX = 72;
const MIN_DELTA_PX = 8;

export function ScrollChrome() {
  useEffect(() => {
    let lastY = window.scrollY;
    let ticking = false;

    const setHidden = (hidden: boolean) => {
      document.documentElement.classList.toggle("chrome-hidden", hidden);
    };

    const update = () => {
      const currentY = Math.max(0, window.scrollY);
      const delta = currentY - lastY;

      if (currentY <= HIDE_AFTER_PX) {
        setHidden(false);
      } else if (Math.abs(delta) >= MIN_DELTA_PX) {
        setHidden(delta > 0);
      }

      lastY = currentY;
      ticking = false;
    };

    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(update);
        ticking = true;
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    update();

    return () => {
      window.removeEventListener("scroll", onScroll);
      setHidden(false);
    };
  }, []);

  return null;
}
