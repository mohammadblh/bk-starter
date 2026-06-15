#!/usr/bin/env node
'use strict';

/**
 * SCN-051/052 — Secret Scanner
 * اجرا: node scripts/scan-secrets.js [مسیر پروژه]
 *
 * این اسکریپت را به pre-commit hook اضافه کنید تا
 * از commit اشتباهی credentials جلوگیری شود.
 */

const fs   = require('fs');
const path = require('path');

const TARGET_DIR = process.argv[2] || process.cwd();

// ── Patterns to detect ────────────────────────────────────────────────────────

const PATTERNS = [
  // AWS
  { name: 'AWS Access Key',    regex: /AKIA[0-9A-Z]{16}/g },
  { name: 'AWS Secret Key',    regex: /(?:aws.{0,20}secret|secretAccessKey)\s*[:=]\s*["']?[A-Za-z0-9/+]{40}["']?/gi },

  // Firebase
  { name: 'Firebase API Key',  regex: /AIzaSy[A-Za-z0-9_-]{33}/g },
  { name: 'Firebase Config',   regex: /firebaseConfig\s*=\s*{[^}]*apiKey/gis },

  // JWT
  { name: 'JWT Secret (weak)', regex: /jwt.{0,10}secret.{0,5}["'`]([^"'`]{4,32})["'`]/gi },

  // Generic secrets
  { name: 'Generic API Key',   regex: /(?:api.?key|apiKey)\s*[:=]\s*["']([A-Za-z0-9_\-]{20,})["']/gi },
  { name: 'Generic Password',  regex: /(?:password|passwd)\s*[:=]\s*["']([^"']{8,})["']/gi },
  { name: 'Bearer Token',      regex: /Bearer\s+[A-Za-z0-9\-._~+/]+=*/g },
  { name: 'Private Key',       regex: /-----BEGIN (RSA |EC )?PRIVATE KEY-----/g },
  { name: 'MongoDB with creds',regex: /mongodb(\+srv)?:\/\/[^:]+:[^@]+@/g },
];

// ── File/Dir ignore list ──────────────────────────────────────────────────────

const IGNORE_DIRS  = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', '.next']);
const IGNORE_FILES = new Set(['.env.example', 'scan-secrets.js', 'setup-git-hooks.sh', 'package-lock.json']);
const IGNORE_PATHS = ['config/firebase.client.js', 'controllers/auth.controller.js', 'middleware/auth.middleware.js', 'tests/', 'auth.test.js'];
const SCAN_EXTS    = new Set(['.js', '.ts', '.json', '.html', '.env', '.yaml', '.yml', '.sh', '.config']);

// ── Scanner ───────────────────────────────────────────────────────────────────

let findings = [];
let scannedCount = 0;

function scanFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (!SCAN_EXTS.has(ext) && !filePath.endsWith('.env')) return;

  if (filePath.includes('/scan-secrets.js')) return;

  const basename = path.basename(filePath);
  if (IGNORE_FILES.has(basename)) return;

  const relativePath = path.relative(TARGET_DIR, filePath);
  for (const ignorePath of IGNORE_PATHS) {
    if (relativePath.includes(ignorePath)) return;
  }

  // فایل .env واقعی را skip کن اما به کاربر هشدار بده
  if (basename === '.env') {
    findings.push({
      type:   'WARNING',
      file:   filePath,
      line:   0,
      name:   '.env file found',
      match:  '(محتوا بررسی نشد)',
      advice: 'مطمئن شوید این فایل در .gitignore است',
    });
    return;
  }

  let content;
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch {
    return;
  }

  scannedCount++;
  const lines = content.split('\n');

  for (const { name, regex } of PATTERNS) {
    regex.lastIndex = 0;
    let match;
    while ((match = regex.exec(content)) !== null) {
      // شماره خط
      const lineNum = content.substring(0, match.index).split('\n').length;
      const snippet = match[0].substring(0, 60) + (match[0].length > 60 ? '...' : '');

      findings.push({
        type:  'SECRET',
        file:  path.relative(TARGET_DIR, filePath),
        line:  lineNum,
        name,
        match: snippet,
      });
    }
  }
}

function scanDir(dir) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (IGNORE_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanDir(full);
    } else {
      scanFile(full);
    }
  }
}

// ── Run ───────────────────────────────────────────────────────────────────────

console.log(`\n🔍 Secret Scanner — SCN-051/052`);
console.log(`   Scanning: ${TARGET_DIR}\n`);

scanDir(TARGET_DIR);

if (findings.length === 0) {
  console.log(`✅ ${scannedCount} files scanned — no secrets detected.\n`);
  process.exit(0);
} else {
  const secrets   = findings.filter(f => f.type === 'SECRET');
  const warnings  = findings.filter(f => f.type === 'WARNING');

  if (warnings.length > 0) {
    console.log(`⚠️  Warnings (${warnings.length}):`);
    warnings.forEach(f => {
      console.log(`   ${f.file}: ${f.name}`);
      if (f.advice) console.log(`   → ${f.advice}`);
    });
    console.log('');
  }

  if (secrets.length > 0) {
    console.log(`❌ Potential secrets found (${secrets.length}):`);
    secrets.forEach(f => {
      console.log(`\n   [${f.name}]`);
      console.log(`   File: ${f.file}:${f.line}`);
      console.log(`   Match: ${f.match}`);
    });

    console.log('\n─────────────────────────────────────────────────');
    console.log('  اقدامات لازم:');
    console.log('  ۱. اعتبارنامه‌های لیک‌شده را فوری revoke کنید');
    console.log('  ۲. مقادیر را از کد حذف کرده و در .env قرار دهید');
    console.log('  ۳. git history را پاک کنید: git filter-repo یا BFG');
    console.log('  ۴. .env را به .gitignore اضافه کنید');
    console.log('─────────────────────────────────────────────────\n');

    process.exit(1); // در pre-commit hook، commit را متوقف می‌کند
  }
}