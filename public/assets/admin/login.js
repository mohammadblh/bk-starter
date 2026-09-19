/* eslint-env browser */
'use strict';

/**
 * صفحه ورود پنل مدیریت.
 *
 * توکن هرگز به JavaScript داده نمی‌شود — سرور آن را در یک
 * httpOnly cookie می‌گذارد تا XSS نتواند آن را بخواند.
 */

const form = document.getElementById('login-form');
const errorEl = document.getElementById('login-error');
const submitBtn = document.getElementById('login-submit');

function showError(message) {
  // textContent تا پیام سرور نتواند HTML تزریق کند
  errorEl.textContent = message;
  errorEl.classList.remove('hidden');
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorEl.classList.add('hidden');
  submitBtn.disabled = true;

  const identifier = document.getElementById('identifier').value.trim();
  const password = document.getElementById('password').value;

  // تشخیص اینکه ورودی ایمیل است یا موبایل
  const payload = /^09\d{9}$/.test(identifier)
    ? { phone: identifier, password }
    : { email: identifier, password };

  try {
    const res = await fetch('/admin/login', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const detail = Array.isArray(data.details) ? data.details.join(' — ') : '';
      showError(detail || data.message || 'ورود ناموفق بود.');
      return;
    }

    window.location.href = '/admin';
  } catch (err) {
    showError('ارتباط با سرور برقرار نشد.');
  } finally {
    submitBtn.disabled = false;
  }
});
