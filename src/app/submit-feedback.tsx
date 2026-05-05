"use client";

import { useEffect, useState } from "react";

export function SubmitFeedback() {
  const [message, setMessage] = useState("");

  useEffect(() => {
    function handleSubmit(event: SubmitEvent) {
      const form = event.target instanceof HTMLFormElement ? event.target : null;
      if (!form || form.dataset.submitting === "true") return;
      form.dataset.submitting = "true";
      const submitter = event.submitter instanceof HTMLButtonElement ? event.submitter : form.querySelector<HTMLButtonElement>('button[type="submit"], button:not([type])');
      const pendingMessage = form.dataset.pendingMessage || submitter?.dataset.pendingMessage || "";
      if (pendingMessage) setMessage(pendingMessage);
      if (submitter) {
        submitter.dataset.originalText = submitter.textContent || "";
        submitter.disabled = true;
        submitter.setAttribute("aria-busy", "true");
        submitter.classList.add("is-loading");
      }
    }

    function handlePageShow() {
      setMessage("");
      document.querySelectorAll<HTMLFormElement>('form[data-submitting="true"]').forEach((form) => {
        form.dataset.submitting = "false";
        form.querySelectorAll<HTMLButtonElement>("button.is-loading").forEach((button) => {
          button.disabled = false;
          button.removeAttribute("aria-busy");
          button.classList.remove("is-loading");
        });
      });
    }

    document.addEventListener("submit", handleSubmit, true);
    window.addEventListener("pageshow", handlePageShow);
    return () => {
      document.removeEventListener("submit", handleSubmit, true);
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, []);

  if (!message) return null;

  return (
    <div className="submit-toast" role="status" aria-live="polite">
      <span className="submit-toast-spinner" aria-hidden />
      {message}
    </div>
  );
}

