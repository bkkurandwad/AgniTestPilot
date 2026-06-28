# 🔥 Agni

> **Agni** is a premium, open-source desktop client built in Electron wrapping Playwright to record, manage, execute, and audit web browser automation flows. 

Agni is designed to unify the ease-of-use of no-code visual testing with the raw power of code-level script customization.

---

## ✨ Features

*   🔴 **One-Click Recording**: Configures environments and launches Chromium codegen to record your actions.
*   🌍 **Multi-Environment Starting URLs**: Configure and switch between starting URLs per environment (e.g. DEV vs PROD vs STAGING) during recording, execution, and scenario editing.
*   🎛️ **Dedicated Parameter Editor**: Switch to a dedicated configuration view to manage dynamic input parameters and auto-sync selectors from recorded scripts.
*   🎲 **Data Generators & Custom Format Patterns**: Configure dynamic variables for different environments. Supports Static Value, Random Phone (10 digits), Random Alpha, Random AlphaNum, Random Email, Timestamp, and **Custom Format Patterns** (e.g. `LLDDDDDD` for 2 Letters and 6 Digits).
*   💻 **Holistic Analytics Dashboard**: View counts of recorded tests, executions, runs, passed, and failed stats with an SVG circular success ring and duration averages.
*   📜 **Execution History & Galleries**: Every run gets a unique execution ID. Expanding a run row shows a visual grid of all screenshots captured during that specific run.
*   🔍 **Lightbox Overlay Checkpoints**: Click any screenshot thumbnail in the execution gallery to inspect details in a full-screen modal.
*   📄 **Audit Report Exports**: Generate standalone print-ready HTML/PDF audit files for individual runs or holistic summaries directly to your configured Reports folder.
*   ⚙️ **Custom Configuration Management**: Manage default screenshot folders, report paths, and headed/headless options under global Settings.
*   ✏️ **Dynamic Option Re-compilation**: Toggle sleep delays and screenshots on existing recorded tests. Agni will automatically re-process and write the code files on-the-fly.

---

## 🛠️ Installation & Setup

Ensure you have [Node.js](https://nodejs.org) installed on your system.

### 1. Clone the repository
```bash
git clone https://github.com/yourusername/agni.git
cd agni
```

### 2. Install dependencies
```bash
npm install
```

### 3. Run the development application
```bash
npm start
```

---

## 📦 Packaging Standalone Installers

Agni uses `electron-builder` to package standalone executable installers for both macOS and Windows. 

To build `.dmg` and `.exe` installers, run:
```bash
npm run build
```
The compiled binaries will be output inside the `dist/` directory:
*   **macOS installer**: `dist/Agni-1.0.0-arm64.dmg`
*   **Windows installer**: `dist/Agni Setup 1.0.0.exe`

---

## 📄 License

This project is open-source and licensed under the [Apache License 2.0](LICENSE). Feel free to modify, distribute, and integrate it into your workflows!
