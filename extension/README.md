# Loan Debug Form Helper

TypeScript-based Chrome extension (Manifest V3) to save, manage, and restore form data on `https://localhost:7994/loan/debug/`.

## Development
1. Install dependencies
   ```bash
   cd extension
   npm install
   ```
2. Build TypeScript
   ```bash
   npm run build
   ```

## Package for upload/load
1. Run the packaging script to build and zip the distributable:
   ```bash
   npm run package
   ```
2. The archive will be created at `build/loan-debug-form-helper.zip`.
3. In Chrome, open **Extensions** → **Developer mode** → **Load unpacked** and select `build/chrome-extension/`, or upload the zip to the Chrome Web Store.

## Notes
- Output JavaScript files are written to `dist/` and referenced from the manifest and popup.
- The `package` script cleans previous builds, runs the compiler, and zips the result.
