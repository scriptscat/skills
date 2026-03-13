# UserScript API Reference

## ==UserScript== Metadata Fields

### Required fields

| Field | Description | Example |
|---|---|---|
| `@name` | Script name | `My Script` |

### Recommended fields

| Field | Description | Example |
|---|---|---|
| `@namespace` | Unique namespace URL | `https://scriptcat.org/` |
| `@version` | Semver version | `1.0.0` |
| `@description` | What the script does | `Auto-fill login forms` |
| `@author` | Author name | `username` |

### URL matching

| Field | Description | Example |
|---|---|---|
| `@match` | URL glob patterns (preferred) | `*://example.com/*` |
| `@include` | URL patterns (supports regex) | `https://example.com/*` |
| `@exclude` | URLs to exclude | `*://example.com/admin/*` |
| `@connect` | Allowed XHR domains | `api.example.com` |
| `@noframes` | Don't run in iframes | (no value) |

### Execution control

| Field | Description | Values |
|---|---|---|
| `@run-at` | When to inject | `document-start`, `document-end` (default), `document-idle` |
| `@run-in` | Execution context (ScriptCat-specific) | `content` (default), `page`, `sandbox` |
| `@grant` | API permissions | `GM_xmlhttpRequest`, `GM_setValue`, `none`, etc. |
| `@require` | External JS library URLs | `https://cdn.example.com/lib.min.js` |
| `@resource` | Named external resources | `mydata https://example.com/data.json` |

### ScriptCat-specific fields

| Field | Description | Example |
|---|---|---|
| `@background` | Run as background script (no page) | (no value) |
| `@crontab` | Cron schedule expression | `0 9 * * *`, `* * once * *` |
| `@early-start` | Start before page loads | (no value, use with `CAT_scriptLoaded()`) |

### Display fields

| Field | Description |
|---|---|
| `@icon` | Script icon URL (shown in manager) |
| `@icon64` | 64px icon URL |
| `@homepage` | Script homepage URL |
| `@homepageURL` | Alias for `@homepage` |
| `@supportURL` | Support/issues URL |
| `@updateURL` | Metadata update check URL |
| `@downloadURL` | Script download URL |

## ==UserConfig== Format

Defines a settings UI. Uses YAML syntax inside a comment block:

```js
// ==UserConfig==
// group_name:
//   setting_key:
//     title: Display Name
//     description: Help text
//     type: text
//     default: ''
// ==/UserConfig==
```

### Config field properties

```typescript
interface Config {
  title: string;            // Display name (required)
  description: string;      // Help text (required)
  default?: unknown;         // Default value
  type?: ConfigType;         // Input type (see below)
  bind?: string;             // Bind to a GM_getValue key
  values?: unknown[];        // Options for select/mult-select
  password?: boolean;        // Mask input (text type)
  max?: number;              // Max length (text) or max value (number)
  min?: number;              // Min value (number)
  rows?: number;             // Rows for textarea
  index: number;             // Sort position
}

type ConfigType = "text" | "checkbox" | "select" | "mult-select" | "number" | "textarea" | "time";
```

Access at runtime:
- `GM_info.userConfig` — parsed config object
- `GM_info.userConfigStr` — raw YAML string
- `CAT_userConfig()` — open the config page programmatically

## GM APIs (Callback-based)

These are the classic Greasemonkey/Tampermonkey-compatible APIs. All require `@grant`.

### Storage

```typescript
// Read a value
GM_getValue(name: string, defaultValue?: any): any

// Read multiple values (keys array or defaults object)
GM_getValues(keysOrDefaults: { [key: string]: any } | string[] | null | undefined): { [key: string]: any }

// Write a value
GM_setValue(name: string, value: any): void

// Write multiple values
GM_setValues(values: { [key: string]: any }): void

// Delete a value
GM_deleteValue(name: string): void

// Delete multiple values
GM_deleteValues(names: string[]): void

// List all stored keys
GM_listValues(): string[]

// Watch for value changes
GM_addValueChangeListener(
  name: string,
  listener: (name: string, oldValue: unknown, newValue: unknown, remote: boolean, tabid?: number) => unknown
): number

GM_removeValueChangeListener(listenerId: number): void
```

### HTTP Requests

```typescript
GM_xmlhttpRequest(details: GMTypes.XHRDetails): GMTypes.AbortHandle<void>
```

**XHRDetails:**

```typescript
interface XHRDetails {
  method?: "GET" | "HEAD" | "POST" | "PUT" | "DELETE" | "PATCH" | "OPTIONS";
  url: string | URL | File | Blob;
  headers?: { [key: string]: string };
  data?: string | Blob | File | BufferSource | FormData | URLSearchParams;
  cookie?: string;
  binary?: boolean;
  timeout?: number;
  responseType?: "text" | "arraybuffer" | "blob" | "json" | "document" | "stream";
  overrideMimeType?: string;
  anonymous?: boolean;           // Don't send cookies
  fetch?: boolean;               // Use fetch API internally
  nocache?: boolean;
  redirect?: "follow" | "error" | "manual";

  // Callbacks
  onload?: (response: XHRResponse) => unknown;
  onloadstart?: (response: XHRResponse) => unknown;
  onloadend?: (response: XHRResponse) => unknown;
  onprogress?: (progress: XHRProgress) => unknown;
  onreadystatechange?: (response: XHRResponse) => unknown;
  ontimeout?: (response: XHRResponse) => unknown;
  onabort?: (response: XHRResponse) => unknown;
  onerror?: (err: string | (XHRResponse & { error: string })) => void;
}
```

**XHRResponse:**

```typescript
interface XHRResponse {
  finalUrl?: string;
  readyState?: 0 | 1 | 2 | 3 | 4;
  responseHeaders?: string;
  status?: number;
  statusText?: string;
  response?: string | Blob | ArrayBuffer | Document | ReadableStream | null;
  responseText?: string;
  responseXML?: Document | null;
  responseType?: string;
}
```

### Downloads

```typescript
GM_download(details: DownloadDetails): GMTypes.AbortHandle<boolean>
GM_download(url: string, filename: string): GMTypes.AbortHandle<boolean>
```

**DownloadDetails:**

```typescript
interface DownloadDetails<URL> {
  url: URL;
  name: string;
  headers?: { [key: string]: string };
  saveAs?: boolean;
  conflictAction?: "uniquify" | "overwrite" | "prompt";
  timeout?: number;
  method?: "GET" | "POST";
  cookie?: string;
  onload?: (event: object) => void;
  onerror?: (error: DownloadError) => void;
  onprogress?: (progress: { done: number; loaded: number; total: number }) => void;
  ontimeout?: (arg?: any) => void;
}
```

### Notifications

```typescript
GM_notification(details: NotificationDetails, ondone?: (user?: boolean) => void): void
GM_notification(text: string, title: string, image: string, onclick?: NotificationOnClick): void
GM_closeNotification(id: string): void
GM_updateNotification(id: string, details: NotificationDetails): void
```

**NotificationDetails:**

```typescript
interface NotificationDetails {
  text?: string;
  title?: string;
  tag?: string;              // Unique ID for updating/closing
  image?: string;
  highlight?: boolean;
  silent?: boolean;
  timeout?: number;          // Auto-close after ms
  url?: string;              // Open on click
  onclick?: NotificationOnClick;
  ondone?: (user?: boolean) => void;
  progress?: number;         // 0-100 progress bar
  buttons?: { title: string; iconUrl?: string }[];  // Max 2 buttons
}
```

### Menu Commands

```typescript
GM_registerMenuCommand(
  name: string,
  listener?: (inputValue?: any) => void,
  options_or_accessKey?: {
    id?: number | string;
    accessKey?: string;
    autoClose?: boolean;      // Default true
    nested?: boolean;         // SC: true = nested in submenu
    individual?: boolean;     // SC: false = merge same-name items
  } | string
): number

GM_unregisterMenuCommand(id: number): void
```

### DOM & Style

```typescript
GM_addStyle(css: string): HTMLStyleElement

GM_addElement(tag: string, attributes: Record<string, string | number | boolean>): HTMLElement
GM_addElement(parentNode: Node, tag: string, attrs: Record<string, string | number | boolean>): HTMLElement
```

### Clipboard

```typescript
GM_setClipboard(data: string, info?: string | { type?: string; mimetype?: string }): void
```

### Tabs

```typescript
GM_openInTab(url: string, options?: OpenTabOptions): GMTypes.Tab | undefined
GM_openInTab(url: string, loadInBackground?: boolean): GMTypes.Tab | undefined

// Tab session storage
GM_getTab(callback: (tab: object) => void): void
GM_saveTab(tab: object): Promise<void>
GM_getTabs(callback: (tabs: { [key: number]: object }) => void): void
```

**OpenTabOptions:**

```typescript
interface OpenTabOptions {
  active?: boolean;          // Focus the new tab (default true)
  insert?: boolean | number; // Position relative to current tab
  setParent?: boolean;       // Track opener (default true)
  incognito?: boolean;       // Open in private window
  pinned?: boolean;          // Pin the tab
  useOpen?: boolean;         // Use window.open instead of tabs API
}
```

### Cookies

```typescript
GM_cookie(
  action: "list" | "delete" | "set",
  details: CookieDetails,
  ondone: (cookie: Cookie[], error: unknown | undefined) => void
): void
```

### Resources

```typescript
GM_getResourceText(name: string): string | undefined
GM_getResourceURL(name: string, isBlobUrl?: boolean): string | undefined
```

### Logging

```typescript
// Structured logging with level and labels
GM_log(
  message: string,
  level?: "debug" | "info" | "warn" | "error",
  labels?: { [key: string]: string | boolean | number | undefined }
): void
```

## GM.* APIs (Promise-based)

All callback-based GM APIs have Promise-based equivalents on the `GM` object. Use these with `await`:

```typescript
GM.getValue<T>(name: string, defaultValue?: T): Promise<T>
GM.getValues(keysOrDefaults): Promise<{ [key: string]: any }>
GM.setValue(name: string, value: any): Promise<void>
GM.setValues(values: { [key: string]: any }): Promise<void>
GM.deleteValue(name: string): Promise<void>
GM.deleteValues(names: string[]): Promise<void>
GM.listValues(): Promise<string[]>
GM.addValueChangeListener(name, listener): Promise<number>
GM.removeValueChangeListener(listenerId: number): Promise<void>
GM.log(message, level?, labels?): Promise<void>
GM.getResourceText(name: string): Promise<string | undefined>
GM.getResourceURL(name: string, isBlobUrl?: boolean): Promise<string | undefined>
GM.registerMenuCommand(name, listener?, opts?): Promise<number | string | undefined>
GM.unregisterMenuCommand(id: number | string): Promise<void>
GM.addStyle(css: string): Promise<HTMLStyleElement>
GM.notification(details, ondone?): Promise<void>
GM.closeNotification(id: string): Promise<void>
GM.updateNotification(id: string, details): Promise<void>
GM.setClipboard(data: string, info?): Promise<void>
GM.addElement(tag, attrs): Promise<HTMLElement>
GM.xmlHttpRequest(details: XHRDetails): Promise<XHRResponse>
GM.download(details): Promise<boolean>
GM.download(url: string, filename: string): Promise<boolean>
GM.getTab(): Promise<object>
GM.saveTab(tab: object): Promise<void>
GM.getTabs(): Promise<{ [key: number]: object }>
GM.openInTab(url: string, options?): Promise<GMTypes.Tab | undefined>
GM.cookie(action, details): Promise<Cookie[]>
```

## GM_info Object

Available without `@grant`. Contains script metadata and runtime info:

```typescript
GM_info: {
  version: string;                   // ScriptCat version
  scriptWillUpdate: boolean;
  scriptHandler: "ScriptCat";
  scriptUpdateURL?: string;
  scriptMetaStr?: string;            // Raw metadata block
  userConfig?: UserConfig;           // Parsed ==UserConfig==
  userConfigStr?: string;            // Raw UserConfig YAML
  isIncognito: boolean;
  sandboxMode: "raw";
  downloadMode: "native";
  userAgentData: {
    brands?: { brand: string; version: string }[];
    mobile?: boolean;
    platform?: string;
  };
  script: {
    name: string;
    version: string;
    description?: string;
    author?: string;
    grant: string[];
    header: string;
    icon?: string;
    matches: string[];
    includes?: string[];
    "run-at": string;
    "run-in": string[];
    namespace?: string;
  };
}
```

Also accessible as `GM.info` (Promise-based API).

## ScriptCat Special APIs

### CAT_registerMenuInput

Register a menu item with an input field:

```typescript
CAT_registerMenuInput(
  name: string,
  listener?: (inputValue?: any) => void,
  options?: {
    id?: number | string;
    accessKey?: string;
    autoClose?: boolean;
    nested?: boolean;
    individual?: boolean;
    inputType?: "text" | "number" | "boolean";
    title?: string;
    inputLabel?: string;
    inputDefaultValue?: string | number | boolean;
    inputPlaceholder?: string;
  } | string
): number

CAT_unregisterMenuInput(id: number): void
```

### CAT_fileStorage

Manage files in ScriptCat's storage system:

```typescript
// List files in a directory
CAT_fileStorage("list", {
  path?: string,
  baseDir?: string,           // Default: script UUID
  onload?: (files: FileStorageFileInfo[]) => void,
  onerror?: (error: FileStorageError) => void,
})

// Upload a file (overwrites existing)
CAT_fileStorage("upload", {
  path: string,
  baseDir?: string,
  data: Blob,
  onload?: () => void,
  onerror?: (error: FileStorageError) => void,
})

// Download a file
CAT_fileStorage("download", {
  file: FileStorageFileInfo,  // From list result
  onload: (data: Blob) => void,
  onerror?: (error: FileStorageError) => void,
})

// Delete a file
CAT_fileStorage("delete", {
  path: string,
  onload?: () => void,
  onerror?: (error: FileStorageError) => void,
})

// Open storage config page
CAT_fileStorage("config")
```

**FileStorageFileInfo:**

```typescript
interface FileStorageFileInfo {
  name: string;         // File name
  path: string;         // File path
  absPath: string;      // Absolute path in storage
  size: number;
  digest: string;       // File hash
  createtime: number;
  updatetime: number;
}
```

**FileStorageError codes:** `-1` unknown, `1` not configured, `2` config error, `3` path not found, `4` upload failed, `5` download failed, `6` delete failed, `7` invalid path, `8` network error.

### CAT_userConfig

Open the script's UserConfig settings page:

```typescript
CAT_userConfig(): void
```

### CAT_scriptLoaded

Wait for script to fully load when using `@early-start`:

```typescript
CAT_scriptLoaded(): Promise<void>
```

### CATRetryError

Schedule a retry for background/crontab scripts:

```typescript
class CATRetryError {
  constructor(message: string, seconds: number)   // Retry after N seconds (min 5s)
  constructor(message: string, date: Date)         // Retry at specific time
}

// Usage: throw or reject with CATRetryError
throw new CATRetryError("API rate limited", 60);
```

## Global Objects

```typescript
// Access the page's real window (bypasses sandbox isolation)
// @grant unsafeWindow
declare const unsafeWindow: Window;
```
