# Publishing the XPoz CLI to npm

## Quick Publish (Current Name: "xpoz")

```bash
# From apps/cli directory
pnpm run build
pnpm publish --access public
```

Then users can install:
```bash
npm install -g xpoz
# or
pnpm install -g xpoz

# And use:
xpoz --help
```

## Publishing with a Different Package Name

If you want to publish as a different npm package name (e.g., "agent-xpoz"):

### 1. Change Package Name

Edit `apps/cli/package.json`:

```json
{
  "name": "agent-xpoz",  // ← Changed package name
  "version": "1.0.0",
  "bin": {
    "xpoz": "./dist/index.js"  // ← Keep command name!
  }
}
```

**Important:** The `bin` field determines the command name, NOT the package name!

### 2. Publish

```bash
cd apps/cli
pnpm run build
pnpm publish --access public
```

### 3. Users Install

```bash
npm install -g agent-xpoz
# or
pnpm install -g agent-xpoz
```

### 4. Users Use

Even though the package is called "agent-xpoz", the command is still:

```bash
xpoz --help  # ← Command name from "bin" field
xpoz posts:create -c "Hello!" -i "twitter-123"
```

## Package Name vs Command Name

| Field | Purpose | Example |
|-------|---------|---------|
| `"name"` | npm package name (what you install) | `"agent-xpoz"` |
| `"bin"` | Command name (what you type) | `"xpoz"` |

**Examples:**

1. **Same name:**
   ```json
   "name": "xpoz",
   "bin": { "xpoz": "./dist/index.js" }
   ```
   Install: `npm i -g xpoz`
   Use: `xpoz`

2. **Different names:**
   ```json
   "name": "agent-xpoz",
   "bin": { "xpoz": "./dist/index.js" }
   ```
   Install: `npm i -g agent-xpoz`
   Use: `xpoz`

3. **Multiple commands:**
   ```json
   "name": "agent-xpoz",
   "bin": {
     "xpoz": "./dist/index.js",
     "pz": "./dist/index.js"
   }
   ```
   Install: `npm i -g agent-xpoz`
   Use: `xpoz` or `pz`

## Publishing Checklist

### Before First Publish

- [ ] Verify package name is available on npm
  ```bash
  npm view xpoz
  # If error "404 Not Found" - name is available!
  ```

- [ ] Update version if needed
  ```json
  "version": "1.0.0"
  ```

- [ ] Review files to include
  ```json
  "files": [
    "dist",
    "README.md",
    "SKILL.md"
  ]
  ```

- [ ] Build the package
  ```bash
  pnpm run build
  ```

- [ ] Test locally
  ```bash
  pnpm link --global
  xpoz --help
  ```

### Publish to npm

```bash
# Login to npm (first time only)
npm login

# From apps/cli
pnpm run build
pnpm publish --access public

# Or use the root script
cd /path/to/monorepo/root
pnpm run publish-cli
```

### After Publishing

Verify it's published:
```bash
npm view xpoz
# Should show your package info
```

Test installation:
```bash
npm install -g xpoz
xpoz --version
```

## Using from Monorepo Root

The root `package.json` already has:

```json
{
  "scripts": {
    "publish-cli": "pnpm run --filter ./apps/cli publish"
  }
}
```

So you can publish from the root:

```bash
# From monorepo root
pnpm run publish-cli
```

## Version Updates

### Patch Release (1.0.0 → 1.0.1)

```bash
cd apps/cli
npm version patch
pnpm publish --access public
```

### Minor Release (1.0.0 → 1.1.0)

```bash
cd apps/cli
npm version minor
pnpm publish --access public
```

### Major Release (1.0.0 → 2.0.0)

```bash
cd apps/cli
npm version major
pnpm publish --access public
```

## Scoped Packages

If you want to publish under an organization scope:

```json
{
  "name": "@yourorg/xpoz",
  "bin": {
    "xpoz": "./dist/index.js"
  }
}
```

Install:
```bash
npm install -g @yourorg/xpoz
```

Use:
```bash
xpoz --help
```

## Testing Before Publishing

### Test the Build

```bash
pnpm run build
node dist/index.js --help
```

### Test Linking

```bash
pnpm link --global
xpoz --help
pnpm unlink --global
```

### Test Publishing (Dry Run)

```bash
npm publish --dry-run
# Shows what would be published
```

### Test with `npm pack`

```bash
npm pack
# Creates a .tgz file

# Test installing the tarball
npm install -g ./xpoz-1.0.0.tgz
xpoz --help
npm uninstall -g xpoz
```

## Continuous Publishing

### Using GitHub Actions

Create `.github/workflows/publish-cli.yml`:

```yaml
name: Publish CLI to npm

on:
  push:
    tags:
      - 'cli-v*'

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
          registry-url: 'https://registry.npmjs.org'

      - run: pnpm install
      - run: pnpm run build:cli

      - name: Publish to npm
        run: pnpm --filter ./apps/cli publish --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

Then publish with:
```bash
git tag cli-v1.0.0
git push origin cli-v1.0.0
```

## Common Issues

### "You do not have permission to publish"

- Make sure you're logged in: `npm login`
- Check package name isn't taken: `npm view xpoz`
- If scoped, ensure org access: `npm org ls yourorg`

### "Package name too similar to existing package"

- Choose a more unique name
- Or use a scoped package: `@yourorg/xpoz`

### "Missing required files"

- Check `"files"` field in package.json
- Run `npm pack` to see what would be included
- Make sure `dist/` exists and is built

### Command not found after install

- Check `"bin"` field is correct
- Ensure `dist/index.js` has shebang: `#!/usr/bin/env node`
- Try reinstalling: `npm uninstall -g xpoz && npm install -g xpoz`

## Recommended Names

If "xpoz" is taken, consider:

- `@xpoz/cli`
- `xpoz-cli`
- `xpoz-agent`
- `agent-xpoz`
- `@yourorg/xpoz`

Remember: The package name is just for installation. The command can still be `xpoz`!

## Summary

✅ Current setup works perfectly!
✅ `bin` field defines the command name
✅ `name` field defines the npm package name
✅ They can be different!

**To publish now:**

```bash
cd apps/cli
pnpm run build
pnpm publish --access public
```

**Users install:**

```bash
npm install -g xpoz
# or
pnpm install -g xpoz
```

**Users use:**

```bash
xpoz --help
xpoz posts:create -c "Hello!" -i "twitter-123"
```

🚀 **Ready to publish!**
