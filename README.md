# LIBRIX — Universal Library, Document & Knowledge Platform

> **"One Library. Any Device. Any Storage. Your Knowledge."**

**Librix** is a professional, open-source, privacy-first, genuinely cross-platform application for managing, reading, organizing, searching, annotating, synchronizing, and interacting with ebooks, documents, notes, and personal knowledge with universal local and multi-cloud storage backends, an Obsidian-inspired knowledge management system with interactive graph, and Libris local/custom AI with document-aware RAG.

---

## 🌟 Core Highlights

```
                         LIBRIX
                            │
       ┌────────────────────┼────────────────────┐
       │                    │                    │
      READ                 MANAGE              THINK
       │                    │                    │
   📚 Books             📁 Files             🤖 Libris AI
   📄 Documents         ☁️ Multi-Cloud        🧠 Document RAG
   📝 Notes Vault       🔄 Sync Engine       🔎 Universal Search
   📖 Reader Studio     🗂️ Collections        🕸️ Knowledge Graph
                            │
                  ┌─────────┴─────────┐
                  │                   │
              LOCAL STORAGE      CLOUD STORAGE
                  │                   │
                  │       ┌───────────┼────────────┐
                  │       │           │            │
                  │     Drive        MEGA       Telegram
                  │       │           │            │
                  └───────┴───────────┴────────────┘
```

- 📱 **Genuinely Cross-Platform**: Architectural platform abstraction supporting Linux, Windows, macOS, Android (Storage Access Framework), iOS (Files), and Web/PWA.
- ☁️ **Universal Multi-Cloud Library**: Seamlessly browse, organize, and search documents stored across Local Storage, Google Drive, MEGA, Telegram Vault, TeraBox, MediaFire, and Custom S3/WebDAV APIs.
- 📖 **Reader Studio**: Dedicated EPUB, PDF, and Markdown readers with Table of Contents navigation, chapter progress, typography customization (Serif, Sans, Mono, font size, line spacing), themes (Dark, Light, Sepia, High Contrast), text selection highlighter, and bookmarks.
- 📝 **Obsidian-Style Knowledge Vault**: First-class Markdown notes with live preview, `[[Wikilinks]]` bidirectional linking, `#tags`, YAML frontmatter properties, unlinked mentions, and daily journal automation.
- 🕸️ **Interactive Knowledge Graph**: 2D Canvas physics force-directed graph connecting notes, books, tags, authors, and collections with adjustable physics controls (repulsion charge, link distance) and search filtering.
- 🤖 **Libris AI & Document-Aware RAG**: Local private AI (Ollama `http://localhost:11434`, LM Studio / llama.cpp) and cloud APIs with paragraph-level chunking, TF-IDF / vector semantic retrieval, exact page source citations, flashcard generation, study guides, and executive summaries.
- 🔒 **Hardware-Backed Credential Security**: Cloud secrets, OAuth tokens, and Telegram bot keys are never stored in plaintext inside SQLite — isolated via OS Keychain / Android Keystore / WebCrypto AES-GCM vault.
- 🛡️ **Delete Safety & Sync Conflict Resolution**: Confirms every deletion with "Move to Trash" vs "Delete Permanently" options; provides visual side-by-side diff resolution for multi-device sync conflicts.

---

## 🛠️ Architecture & Tech Stack

- **Core & Presentation**: React 19, TypeScript, Vanilla CSS Design System with CSS Tokens (Dark, Light, Sepia, High Contrast)
- **Icons**: Lucide React
- **Database**: Universal Relational SQLite / IndexedDB Database Engine with snapshot persistence
- **Storage Subsystem**: `StorageProvider` abstraction (`LocalStorageProvider`, `GoogleDriveProvider`, `TelegramStorageProvider`, `MegaProvider`, `TeraBoxProvider`, `MediaFireProvider`, `CustomStorageProvider`)
- **Platform Layer**: `IPlatformServices` abstraction with platform adapters for Web, Linux, Windows, macOS, Android, and iOS
- **AI & RAG**: Multi-provider AI abstraction, recursive paragraph chunker, TF-IDF + Cosine similarity vector search engine
- **Testing**: Vitest automated test suite

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Development Server
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

### 3. Run Automated Tests
```bash
npm test
```

### 4. Build for Production
```bash
npm run build
```

---

## 📄 License

MIT License © 2026 LIBRIX Contributors.
