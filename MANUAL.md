# 📖 LIBRIX — User Manual & Documentation

Welcome to **LIBRIX**, the next-generation, local-first knowledge vault, multi-format digital reader, and block-based note-taking ecosystem designed for Android, Linux, and Web.

---

## 📑 Table of Contents
1. [Overview & Philosophy](#1-overview--philosophy)
2. [Installation & Setup](#2-installation--setup)
   - [Android (APK)](#android-apk)
   - [Linux Desktop (AppImage & Portable)](#linux-desktop-appimage--portable)
   - [Web / Self-Hosted](#web--self-hosted)
3. [Document Library & Multi-Format Readers](#3-document-library--multi-format-readers)
   - [PDF Reader with GPU Zoom & Pan Engine](#pdf-reader)
   - [EPUB Reader](#epub-reader)
   - [Markdown Document Viewer](#markdown-document-viewer)
4. [Notion-Style Block Note Vault](#4-notion-style-block-note-vault)
   - [Slash Commands & Block Types](#slash-commands--block-types)
   - [Mobile Touch Dock Toolbar](#mobile-touch-dock-toolbar)
   - [Bidirectional Wikilinks & Knowledge Graph](#bidirectional-wikilinks--knowledge-graph)
5. [Cloud Storage & Google Drive Synchronization](#5-cloud-storage--google-drive-synchronization)
   - [Connecting Google Drive (OAuth 2.0 PKCE)](#connecting-google-drive)
   - [Direct OAuth Token Mode](#direct-oauth-token-mode)
   - [Offline-First Sync Engine](#offline-first-sync-engine)
6. [Keyboard Shortcuts & Touch Gestures](#6-keyboard-shortcuts--touch-gestures)
7. [Troubleshooting & FAQ](#7-troubleshooting--faq)

---

## 1. Overview & Philosophy

LIBRIX is built on three foundational pillars:
- **Local-First Privacy**: Your documents, highlights, and notes belong to you. All data resides primarily on your local device in high-speed IndexedDB / SQLite vaults.
- **Unified Knowledge Space**: Seamlessly read books (PDF, EPUB) and link ideas directly into live, interconnected block notes.
- **Zero Cloud Lock-in**: Connect optional personal cloud storage (Google Drive REST v3) without third-party middleware or tracking servers.

---

## 2. Installation & Setup

### Android (APK)
- **Supported Versions**: Android 13 (API 33), Android 14 (API 34), Android 15 (API 35), Android 16 (API 36), and Android 17+.
- **Installation**:
  1. Transfer `librix-v1.0.0.apk` from the `release/` folder to your device.
  2. Tap the APK in your file manager and select **Install** (allow *Install Unknown Apps* if prompted).
  3. Launch LIBRIX with the minimalist Black & White Cyber Book launcher icon.

### Windows Desktop (10 / 11)
- **Portable ZIP**:
  1. Extract `release/librix-v1.0.0-windows-x64.zip`.
  2. Double-click `LIBRIX.exe` to launch immediately with zero installation.
- **Installer (.exe)**:
  1. Download `LIBRIX-Setup-*.exe` from the official GitHub Releases page.
  2. Run the setup wizard to install and add Desktop & Start Menu shortcuts.

### Linux Desktop (AppImage & Portable)
- **Universal AppImage**:
  ```bash
  # Give executable permission and launch
  chmod +x release/librix-v1.0.0-linux-x86_64.AppImage
  ./release/librix-v1.0.0-linux-x86_64.AppImage --appimage-extract-and-run
  ```
- **Portable Unpacked Binary**:
  ```bash
  ./release-linux/linux-unpacked/librix
  ```

### Web / Self-Hosted
```bash
# Clone and install dependencies
git clone https://github.com/mrutyunjaya-jena/LIBRIX.git
cd LIBRIX
npm install

# Start local dev server
npm run dev

# Or build production bundle
npm run build
```

---

## 3. Document Library & Multi-Format Readers

### PDF Reader
- **GPU Canvas Rendering**: Sharp text and image rendering with transparent text-selection overlay for highlighting and copy-pasting.
- **Zooming**:
  - **Touch (Android)**: 2-Finger natural pinch-to-zoom with live HUD percentage indicator.
  - **Desktop / Toolbar**: Click `[ - ]` and `[ + ]` zoom clusters or select preset zoom levels (`100%`, `150%`, `Fit Page`, `Fit Width`).
- **360° Pan Engine**: Smooth multi-directional drag panning when zoomed in.
- **Distraction-Free Reflow**: Switch to pure text reflow mode for reading dense textbooks on small mobile screens.

### EPUB Reader
- Full pagination, customizable typography sizes, chapter table of contents (TOC) drawer, and reading progress indicators.

### Markdown Document Viewer
- Clean, distraction-free markdown reader with collapsible outline drawer, interactive code syntax highlighting, and inline footnote previews.

---

## 4. Notion-Style Block Note Vault

### Slash Commands & Block Types
Type `/` anywhere inside a blank block to open the command palette:
- `/h1`, `/h2`, `/h3` — Large, medium, and sub-headings.
- `/todo` or `[]` — Interactive checkbox checklist item.
- `/bullet` or `- ` — Bulleted list.
- `/number` or `1. ` — Numbered ordered list.
- `/callout` or `💡` — Highlighted alert and callout box with custom icons.
- `/quote` or `> ` — Styled blockquote.
- `/code` — Multi-language syntax-highlighted code block.
- `/table` — Editable data grid table.
- `/divider` or `---` — Visual separator line.

### Mobile Touch Dock Toolbar
On mobile devices, a floating docked action bar appears directly above your virtual keyboard:
- 1-tap block transformation (`H1`, `H2`, `☑`, `•`, `💬`, `</>`).
- Dedicated `+` block inserter and `⋮⋮` drag-handle controls optimized for touchscreen precision.

### Bidirectional Wikilinks & Knowledge Graph
- Type `[[Note Title]]` anywhere in your notes to create a link to another note.
- Open the **Knowledge Graph** or **Backlinks Drawer** in the note sidebar to explore connected thoughts.

---

## 5. Cloud Storage & Google Drive Synchronization

### Connecting Google Drive
1. Open **Cloud Vaults** from the main sidebar.
2. Select **Google Drive**.
3. Choose your preferred authentication method:
   - **🌐 Google Sign-In (OAuth 2.0 PKCE)**: Secure, standard browser authentication.
   - **🔑 Direct Token Mode**: For enterprise or custom API setups.

### Direct OAuth Token Mode
Enter your OAuth 2.0 Access Token and Refresh Token directly. LIBRIX communicates straight with `https://www.googleapis.com/drive/v3/` with zero intermediary proxy servers.

### Offline-First Sync Engine
- All changes are instantly saved to your local IndexedDB vault.
- When an internet connection is detected, the background synchronization engine reconciles edits with your Google Drive vault folder.

---

## 6. Keyboard Shortcuts & Touch Gestures

| Action | Desktop / Web Shortcut | Mobile / Android Gesture |
| :--- | :--- | :--- |
| **Open Command Menu** | `/` | Tap `+` or Slash icon in Mobile Dock |
| **New Note** | `Ctrl + N` / `Cmd + N` | Tap `+ New Note` button |
| **Quick Search** | `Ctrl + K` / `Cmd + K` | Tap Search Bar |
| **Zoom PDF In/Out** | `Ctrl + Wheel` / `+` `-` | 2-Finger Pinch In/Out |
| **Pan Zoomed PDF** | Click & Drag | 1-Finger Touch Drag |
| **Create Wikilink** | Type `[[` | Type `[[` |
| **Indent / Outdent List** | `Tab` / `Shift + Tab` | Mobile Indent buttons |

---

## 7. Troubleshooting & FAQ

#### Q: The Linux AppImage gives `libfuse.so.2` error on Fedora/Ubuntu.
- **Fix**: Launch with `./librix-v1.0.0-linux-x86_64.AppImage --appimage-extract-and-run` or install FUSE via `sudo dnf install fuse` (Fedora) / `sudo apt install libfuse2` (Ubuntu).

#### Q: How do I backup my notes and library locally?
- Go to **Settings** $\to$ **Storage & Vaults** $\to$ **Export Vault Backup (.zip / .json)**.

#### Q: Can I use LIBRIX completely offline?
- Yes! 100% of reading, note-taking, search, and knowledge graph features work with zero internet connectivity.

---

*Made with ❤️ by the LIBRIX Team.*
