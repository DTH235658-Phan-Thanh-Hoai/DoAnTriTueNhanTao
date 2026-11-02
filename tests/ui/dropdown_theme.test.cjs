const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "../..");
const themeSheets = [
  "skin_cancer/webapp/static/css/style.css",
  "skin_cancer/webapp/static/css/admin-doctor-theme.css",
].map((file) => [file, fs.readFileSync(path.join(root, file), "utf8")]);

test("native dropdown options follow explicit light and dark themes", () => {
  for (const [file, css] of themeSheets) {
    const lightTheme = css.match(/:root\s*\{([^}]*)\}/)?.[1] || "";
    const darkTheme = css.match(/html\[data-theme="dark"\]\s*\{([^}]*)\}/)?.[1] || "";
    const options = css.match(/select\s+option\s*,\s*select\s+optgroup\s*\{([^}]*)\}/)?.[1] || "";
    const selected = css.match(/select\s+option:checked\s*,\s*select\s+option:hover\s*\{([^}]*)\}/)?.[1] || "";

    assert.match(lightTheme, /color-scheme:\s*light/);
    assert.match(darkTheme, /color-scheme:\s*dark/);
    assert.match(options, /background-color:\s*var\(--select-option-bg\)/);
    assert.match(options, /color:\s*var\(--select-option-color\)/);
    assert.match(selected, /background-color:\s*var\(--select-option-active-bg\)/);
    assert.match(selected, /color:\s*var\(--select-option-active-color\)/);
  }
});
