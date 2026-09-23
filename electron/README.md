# FluxOne — Windows `.exe` manually banana (Roman Urdu)

Yeh guide **scratch se** batati hai ke terminal mein kya commands chalani hain taake `FluxOne-Setup-x.x.x.exe` ban jaye.

Installer output yahan milta hai:

`electron/release/FluxOne-Setup-<version>.exe`

**Important:** Installer ships **empty schema only** (no `admin01` / demo catalog).
TL pe pehli run → Setup wizard → cloud bootstrap → Inventory se BM/Cashier login IDs.

---

## Zaruri cheezein (pehle check karo)

1. **Windows 10/11** (x64)
2. **Node.js** installed ho (LTS recommended) — terminal mein check:
   ```bash
   node -v
   npm -v
   ```
3. Project folder: `C:\Developement\FluxOne` (ya jahan tum ne clone/download kiya ho)
4. Internet pehli dafa `npm install` ke liye chahiye

---

## Step 0 — Project root pe jao

PowerShell ya Command Prompt kholo:

```bash
cd C:\Developement\FluxOne
```

---

## Step 1 — Dependencies install (pehli dafa / naya clone)

Teeno packages install:

```bash
npm install --prefix server
npm install --prefix client
npm install --prefix electron
```

Ya ek saath setup (server seed bhi chalata hai):

```bash
npm run setup
```

---

## Step 2 — Purani release hatao (optional, recommended)

Naya clean build se pehle purana output delete:

```bash
cd C:\Developement\FluxOne\electron
Remove-Item -Recurse -Force .\release -ErrorAction SilentlyContinue
```

CMD mein:

```bash
cd C:\Developement\FluxOne\electron
rmdir /s /q release
```

---

## Step 3 — Version bump (naya installer number)

`electron/package.json` mein `"version"` badlo, maslan:

```json
"version": "1.1.0"
```

Isi version se file name banti hai: `FluxOne-Setup-1.1.0.exe`

---

## Step 4 — Client UI build

Electron packaged app ko `client/dist` chahiye:

```bash
cd C:\Developement\FluxOne\client
npm run build
```

Success pe `client/dist/index.html` maujood hona chahiye.

---

## Step 5 — `.exe` (NSIS installer) banao

```bash
cd C:\Developement\FluxOne\electron
npm run dist
```

Ye script andar yeh karti hai:

1. `prepare:dist` — client dist check, Node binary bundle, icon copy
2. `electron-builder --win nsis` — Windows installer
3. `after-pack` — `server/node_modules` installer resources mein copy

---

## Step 6 — Output kahan hai?

```bash
cd C:\Developement\FluxOne\electron\release
dir
```

Main file:

- **`FluxOne-Setup-1.1.0.exe`** ← yeh installers ko do / machine pe install karo

Saath `win-unpacked/` folder bhi hota hai (unpacked app — testing ke liye).

---

## Shortcut (root se ek command)

Agar dependencies pehle se installed hain:

```bash
cd C:\Developement\FluxOne
npm run electron:dist
```

Ye pehle `client` build karta hai, phir `electron` dist.

---

## Sirf unpacked folder (installer `.exe` ke baghair)

Testing ke liye bina NSIS:

```bash
cd C:\Developement\FluxOne
npm run build --prefix client
cd electron
npm run pack
```

Output: `electron/release/win-unpacked/FluxOne.exe`

---

## Common errors

| Problem | Fix |
|--------|-----|
| `Client UI build not found` | `cd client` → `npm run build` |
| `better-sqlite3 missing` | `cd server` → `npm install` |
| Port 3000 busy jab app chalao | Doosra FluxOne/server band karo |
| Purana UI dikhe | Naya `client` build + naya `electron` dist; purana `release` delete karke dobara |

---

## Dev mode (`.exe` ke baghair test)

Electron **client source copy nahi rakhta**. Browser aur desktop same `client/` se aate hain.

- Browser: `cd client && npm run dev` → live Vite (port 5173)
- Desktop `npm run dev`: pehle Vite dhoondta hai. Vite band ho to purana `client/dist` chalega (is liye old flow dikhta tha)

**Do terminals (recommended — live UI):**

```bash
cd C:\Developement\FluxOne\client
npm run dev
```

```bash
cd C:\Developement\FluxOne\electron
npm run dev
```

Console mein yeh line honi chahiye: `UI → http://127.0.0.1:5173  (LIVE client — Vite)`

**Sirf packaged jaisa snapshot test (purana dist):**

```bash
cd C:\Developement\FluxOne\client
npm run build
cd ..\electron
npm run dev:dist
```

Server alag se chalanay ki zaroorat nahi — Electron khud API start karta hai. Installed `.exe` ya `electron/release` mat chalao jab source test kar rahe ho.

---

## Short cheatsheet (copy-paste)

```bash
cd C:\Developement\FluxOne
npm install --prefix server
npm install --prefix client
npm install --prefix electron
cd client
npm run build
cd ..\electron
Remove-Item -Recurse -Force .\release -ErrorAction SilentlyContinue
npm run dist
```

Installer: `electron\release\FluxOne-Setup-<version>.exe`
