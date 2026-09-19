<div align="center">

# 🚀 bk-starter

<p align="center">
  <img src="https://img.shields.io/github/stars/mohammadblh/bk-starter?style=for-the-badge&logo=github&logoColor=white&color=yellow" alt="GitHub Stars" />
  <img src="https://img.shields.io/github/forks/mohammadblh/bk-starter?style=for-the-badge&logo=github&logoColor=white&color=blue" alt="GitHub Forks" />
  <img src="https://img.shields.io/github/issues/mohammadblh/bk-starter?style=for-the-badge&logo=github&logoColor=white&color=red" alt="GitHub Issues" />
  <img src="https://img.shields.io/github/watchers/mohammadblh/bk-starter?style=for-the-badge&logo=github&logoColor=white&color=orange" alt="GitHub Watchers" />
  <img src="https://img.shields.io/github/languages/top/mohammadblh/bk-starter?style=for-the-badge&logo=javascript&logoColor=white" alt="Top Language" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/Yarn-2C8EBB?style=for-the-badge&logo=yarn&logoColor=white" alt="Yarn" />
  <img src="https://img.shields.io/badge/npm-CB3837?style=for-the-badge&logo=npm&logoColor=white" alt="npm" />
  <img src="https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white" alt="Docker" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Jenkins-D24939?style=for-the-badge&logo=jenkins&logoColor=white" alt="Jenkins" />
</p>

</div>

---

## 📋 Table of Contents

- [✨ Features](#-features)
- [🛠️ Tech Stack](#️-tech-stack)
- [🚀 Quick Start](#-quick-start)
- [🔒 Security](#-security)
- [🔄 CI/CD](#-cicd)
- [🤝 Contributing](#-contributing)
- [💬 Support](#-support)
- [📊 Repository Stats](#-repository-stats)

## ✨ Features

- 🚀 **Modern Architecture** - Built with best practices in mind
- 📱 **Cross-Platform** - Works seamlessly across different environments
- 🔧 **Highly Configurable** - Easy to customize and extend
- 📚 **Well Documented** - Comprehensive documentation and examples
- ⚡ **High Performance** - Optimized for speed and efficiency
- 🛡️ **Secure by default** - Fail-fast secret validation, rate limiting, CSP, CSRF protection, and security regression tests

## 🛠️ Tech Stack

<div align="center">

<img src="https://img.shields.io/badge/JavaScript-F7DF1E?style=flat-square&logo=javascript&logoColor=black" alt="JavaScript" />
<img src="https://img.shields.io/badge/Node.js-339933?style=flat-square&logo=nodedotjs&logoColor=white" alt="Node.js" />
<img src="https://img.shields.io/badge/Docker-2496ED?style=flat-square&logo=docker&logoColor=white" alt="Docker" />

</div>

## 🚀 Quick Start

### Prerequisites

- 📦 Node.js **v20+**
- 🐳 Docker & Docker Compose
- 🍃 MongoDB (locally or via Docker)

### 📥 Installation

```bash
git clone https://github.com/mohammadblh/bk-starter.git
cd bk-starter
npm ci
```

### 🔑 Configuration

The app **fails to start** if required secrets are missing or weak — there are no
insecure fallback values anywhere in the code.

```bash
cp .env.example .env

# Generate a strong JWT secret (min 32 chars in dev, 64 in production)
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Fill in at minimum:

| Variable | Required | Notes |
|---|---|---|
| `JWT_SECRET` | ✅ | ≥32 chars (≥64 in production). Placeholder-looking values are rejected. |
| `MONGODB_URI` | ✅ | Use credentials in production: `mongodb://user:pass@host:27017/db?authSource=admin` |
| `CORS_ORIGINS` | ✅ in prod | Comma-separated allowlist. `*` is rejected in production. |
| `ADMIN_PANEL_ENABLED` | – | Defaults to `false`. |

### ▶️ Run

```bash
npm run dev     # development with nodemon
npm start       # production
npm test        # test suite incl. security regressions
```

### 🐳 Docker

```bash
# MONGO_USER / MONGO_PASSWORD are read from .env
docker compose up --build
```

The image runs as the non-root `node` user, installs with `npm ci --omit=dev`,
and `.dockerignore` keeps `.env`, `.git` and secret files out of the build context.
MongoDB runs with `--auth` and is **not** published to the host.

## 🔒 Security

This starter is built to be secure by default. What that means concretely:

### Authentication

- JWT (HS256) with an explicitly pinned algorithm — `alg: none` tokens are rejected.
- Passwords hashed with bcrypt (cost 12 by default, configurable).
- Tokens are re-validated against the database on every request, so deactivating
  or deleting a user revokes access immediately.
- Login responses are identical for "unknown user" and "wrong password", and a
  real bcrypt comparison runs either way so response timing does not leak which
  accounts exist.
- There is **no API-key bypass**. Authentication is the only way in.

### Creating the first admin

`POST /api/auth/register/admin` requires an existing admin. Bootstrap from the
server instead:

```bash
npm run create-admin
```

### Admin panel

Disabled by default. Enable with `ADMIN_PANEL_ENABLED=true`, then sign in at
`/admin/login` with an account whose role is `admin`.

- The session token lives in an `httpOnly`, `SameSite=Strict` cookie — JavaScript
  cannot read it, so an XSS bug cannot steal the session.
- Cookie-authenticated API calls additionally require an `X-Requested-With`
  header, which a cross-origin page cannot set — this closes CSRF.
- All values rendered from the database are HTML-escaped, and the panel ships
  zero inline scripts or event handlers, so CSP can forbid `unsafe-inline` and
  `unsafe-eval` outright.

### Request hardening

| Layer | Protection |
|---|---|
| `helmet` | CSP without `unsafe-eval`/inline scripts, HSTS, `frame-ancestors 'none'` |
| `cors` | Explicit origin allowlist, never `*` |
| `express-rate-limit` | 100 req/15 min globally, 5 attempts/15 min on auth routes |
| Joi validation | Every route validates input — rejects NoSQL operators like `{"$gt":""}` |
| `express-mongo-sanitize` | Second layer against operator injection |
| `hpp` | Parameter pollution (`?role=user&role=admin`) |
| Body limit | 100 kB by default |

Error responses never include stack traces or database messages outside of
`development`/`test`.

### Secret hygiene

```bash
npm run scan-secrets          # scan the working tree
npm run security:audit        # fail on high/critical dependency CVEs
bash scripts/setup-git-hooks.sh   # install the pre-commit secret scan
```

Both checks also run as a gate in the Jenkins pipeline — a build carrying a
leaked credential or a high-severity CVE does not deploy.

> ⚠️ If you fork this repository, rotate every credential before deploying.
> Deleting a secret from the working tree does not remove it from git history.

## 🔄 CI/CD

This project uses automated CI/CD pipelines:

- **Jenkins** - Continuous integration and deployment pipeline
- **Security gate** - `scan-secrets` and `npm audit --audit-level=high` block the build before deploy
- **Tests** - The suite includes regression tests for every vulnerability that has been fixed

## 🤝 Contributing

We welcome contributions! Here's how you can help:

1. 🍴 **Fork** the repository
2. 🌟 **Create** a feature branch: `git checkout -b feature/amazing-feature`
3. 💾 **Commit** your changes: `git commit -m 'Add amazing feature'`
4. 📤 **Push** to the branch: `git push origin feature/amazing-feature`
5. 🔄 **Open** a Pull Request

## 💬 Support

<div align="center">

**Found this project helpful? Show your support:**

[![GitHub stars](https://img.shields.io/github/stars/mohammadblh/bk-starter?style=social)](https://github.com/mohammadblh/bk-starter/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/mohammadblh/bk-starter?style=social)](https://github.com/mohammadblh/bk-starter/network/members)

</div>

### 🆘 Need Help?

- 📧 **Issues**: [Create an issue](https://github.com/mohammadblh/bk-starter/issues/new)
- 💬 **Discussions**: [Join the discussion](https://github.com/mohammadblh/bk-starter/discussions)
- 📖 **Documentation**: Check the [Wiki](https://github.com/mohammadblh/bk-starter/wiki)

## 📊 Repository Stats

<div align="center">

<img src="https://github-readme-stats.vercel.app/api?username=mohammadblh&repo=bk-starter&show_icons=true&theme=radical" alt="Repository Stats" />

<img src="https://github-readme-stats.vercel.app/api/languages-stats/?username=mohammadblh&repo=bk-starter&theme=radical" alt="Language Stats" />

</div>

---

<div align="center">

**Made with ❤️ by [mohammadblh](https://github.com/mohammadblh)**

⭐ **Star this repository if you found it helpful!** ⭐

</div>
