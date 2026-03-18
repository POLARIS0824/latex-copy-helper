# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LaTeX Copy Helper is a Chrome browser extension (Manifest V3) that automatically converts LaTeX formula delimiters when copying from Gemini to paste into Notion-compatible format.

**Conversion logic:** Single `$...$` → Double `$$...$$`, while preserving existing `$$...$$` blocks.

## Project Structure

```
├── manifest.json    # Extension manifest (v3)
├── content.js       # Content script injected into gemini.google.com
├── popup.html       # Extension popup UI (pure HTML/CSS, no JS)
└── icons/           # Extension icons (16x16, 48x48, 128x128)
```

## Development

This is a **zero-dependency** vanilla JavaScript Chrome extension with no build step.

### Loading the Extension (Local Development)

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top-right)
3. Click "Load unpacked" and select this project directory
4. The extension will be loaded and active on `gemini.google.com`

### Testing Changes

- After editing files, click the refresh icon on the extension card in `chrome://extensions/`
- No build or compilation step is required
- Test by copying LaTeX formulas on Gemini and pasting elsewhere

### Key Technical Details

**Content Script Strategy (`content.js`):**
The extension uses a "post-copy modification" strategy due to Gemini's CSP restrictions:

1. **Copy event listener**: Detects `Ctrl+C` keyboard copies
2. **Click interceptor**: Detects clicks on Gemini's copy buttons (checks for `aria-label`/`title` containing "copy"/"复制", or Material "content_copy" icon)
3. **MutationObserver**: Watches for "Copied"/"已复制" UI feedback to trigger conversion

After detecting a copy action, it:
- Reads clipboard via `navigator.clipboard.readText()`
- Applies `convertLatexDelimiters()` transformation
- Writes back to clipboard via `navigator.clipboard.writeText()`
- Shows a temporary toast notification

**Regex Transformation Pipeline:**
```javascript
// 1. Protect existing $$...$$ blocks with placeholders
// 2. Convert $...$ to $$...$$ using: /(?<!\$)\$(?!\$)((?:[^$\\]|\\.)+?)\$(?!\$)/g
// 3. Restore protected blocks
```

## Deployment

To package for distribution:
1. Zip the entire directory (or use Chrome's "Pack extension" feature)
2. Upload to Chrome Web Store Developer Dashboard

## Constraints

- Extension only activates on `https://gemini.google.com/*`
- Requires `activeTab` and `scripting` permissions
- Uses `navigator.clipboard` API (requires user gesture context)
