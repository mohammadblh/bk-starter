'use strict';

/**
 * H1 — رگرسیون XSS ذخیره‌شده در پنل ادمین.
 *
 * نسخه‌ی قبلی مقادیر دیتابیس را مستقیم داخل innerHTML می‌گذاشت.
 * یک کاربر با firstName = "<img src=x onerror=...>" کافی بود تا
 * وقتی ادمین جدول را باز می‌کند کد مهاجم اجرا شود — و چون کلید API
 * در همان صفحه بود، نتیجه تصاحب کامل سیستم می‌شد.
 *
 * این تست روی فایل واقعی panel.js اجرا می‌شود، نه روی یک کپی.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const PANEL_JS = path.join(__dirname, '..', 'public', 'assets', 'admin', 'panel.js');
const source = fs.readFileSync(PANEL_JS, 'utf8');

/** استخراج یک تابع از سورس واقعی و اجرای آن در sandbox */
function loadFunction(name, deps = []) {
  const grab = (fnName) => {
    const start = source.indexOf(`function ${fnName}(`);
    if (start === -1) throw new Error(`تابع ${fnName} در panel.js پیدا نشد`);
    let depth = 0;
    let i = source.indexOf('{', start);
    const bodyStart = i;
    for (; i < source.length; i += 1) {
      if (source[i] === '{') depth += 1;
      if (source[i] === '}') {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    return source.slice(start, i + 1) + '\n';
  };

  const code = [...deps, name].map(grab).join('') + `\n(${name})`;
  return vm.runInNewContext(code, {});
}

describe('H1 — خروجی پنل ادمین escape می‌شود', () => {
  const escapeHtml = loadFunction('escapeHtml');
  const formatCell = loadFunction('formatCell', ['escapeHtml']);

  const PAYLOADS = [
    '<img src=x onerror=alert(1)>',
    '<script>alert(2)</script>',
    '"><svg onload=alert(3)>',
    "'><iframe src=javascript:alert(4)>",
    '</td></tr><tr><td>injected',
  ];

  it.each(PAYLOADS)('payload %s خنثی می‌شود', (payload) => {
    const out = escapeHtml(payload);
    expect(out).not.toMatch(/<[a-z/]/i);
    expect(out).not.toContain('"');
    expect(out).not.toContain("'");
  });

  it.each(PAYLOADS)('formatCell روی %s تگ زنده تولید نمی‌کند', (payload) => {
    const out = formatCell(payload);
    // هیچ کاراکتر ساختاری HTML خام باقی نمی‌ماند. توجه: متن «onerror»
    // به صورت plain text بی‌خطر است — چیزی که اهمیت دارد خنثی شدن < > " ' است.
    expect(out).not.toMatch(/[<>"']/);
    expect(out).toContain('&lt;');
  });

  it('مقدار boolean همچنان badge رندر می‌کند', () => {
    expect(formatCell(true)).toContain('فعال');
    expect(formatCell(false)).toContain('غیرفعال');
  });

  it('مقدار object به JSON کوتاه و escape شده تبدیل می‌شود', () => {
    const out = formatCell({ a: '<b>' });
    expect(out).not.toContain('<b>');
    expect(out).toContain('&lt;b&gt;');
  });

  it('null و undefined به خط تیره تبدیل می‌شوند', () => {
    expect(formatCell(null)).toBe('-');
    expect(formatCell(undefined)).toBe('-');
  });
});

describe('H1 — هیچ توکن یا inline handler در دارایی‌های پنل نیست', () => {
  it('panel.js هیچ کلید API یا توکنی ندارد', () => {
    expect(source).not.toMatch(/apiKey|x-api-key|localStorage/);
  });

  it('همه‌ی fetch ها از تابع api() با هدر CSRF عبور می‌کنند', () => {
    const rawFetches = source.match(/fetch\(/g) || [];
    // فقط یک fetch مستقیم مجاز است: داخل خود تابع api()
    expect(rawFetches.length).toBe(1);
    expect(source).toMatch(/'X-Requested-With': 'XMLHttpRequest'/);
  });

  it('صفحات HTML پنل هیچ inline event handler ندارند', () => {
    const views = path.join(__dirname, '..', 'views', 'admin');
    for (const file of fs.readdirSync(views)) {
      const html = fs.readFileSync(path.join(views, file), 'utf8');
      expect(html).not.toMatch(/\son(click|submit|input|change|load|error)\s*=/i);
      // هیچ <script> درون‌خطی — فقط ارجاع به فایل
      expect(html).not.toMatch(/<script(?![^>]*\ssrc=)[^>]*>/i);
    }
  });
});
