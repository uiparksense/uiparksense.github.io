/* UI ParkSense V4.5 — tautan formulir. Tidak mengakses atau mengubah Supabase. */
(function () {
  'use strict';
  function setupFeedbackLink() {
    const link = document.getElementById('feedbackFormLink');
    const hint = document.getElementById('feedbackFormHint');
    if (!link || !hint) return;
    const raw = typeof window.PARKSENSE_FEEDBACK_FORM_URL === 'string'
      ? window.PARKSENSE_FEEDBACK_FORM_URL.trim() : '';
    let safeUrl = null;
    if (raw) {
      try {
        const parsed = new URL(raw);
        const isForm = (parsed.hostname === 'forms.gle') ||
          (parsed.hostname === 'docs.google.com' && parsed.pathname.startsWith('/forms/'));
        if (parsed.protocol === 'https:' && isForm && !parsed.username && !parsed.password) safeUrl = parsed.href;
      } catch (_) { /* Tidak memproses tautan yang tidak valid. */ }
    }
    if (safeUrl) {
      link.href = safeUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.classList.remove('ps-feedback-link-disabled');
      link.removeAttribute('aria-disabled');
      link.innerHTML = '<svg class="ui-icon" aria-hidden="true"><use href="#ps-message"></use></svg> Isi Form Kritik &amp; Saran <span aria-hidden="true">↗</span>';
      hint.textContent = 'Formulir akan terbuka di tab baru dan dikelola tim UI ParkSense.';
    } else {
      link.addEventListener('click', function (event) { event.preventDefault(); });
      hint.textContent = raw ? 'Tautan belum valid. Gunakan https://forms.gle/... atau https://docs.google.com/forms/...' : 'Tautan Google Form belum dipasang. Minta pengelola menambahkan tautan formulir.';
    }
  }
  document.addEventListener('DOMContentLoaded', setupFeedbackLink);
})();
