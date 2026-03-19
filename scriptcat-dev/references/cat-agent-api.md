# CAT.agent.* API Reference

Access via `@grant CAT.agent.conversation`, `@grant CAT.agent.dom`, `@grant CAT.agent.skills`, `@grant CAT.agent.task`, `@grant CAT.agent.model`, `@grant CAT.agent.opfs`.

## CAT.agent.conversation

Create and manage sub-agent conversations.

### create

```typescript
CAT.agent.conversation.create(options?: ConversationCreateOptions): Promise<ConversationInstance>
```

**ConversationCreateOptions:**

```typescript
interface ConversationCreateOptions {
  id?: string;              // Resume existing conversation
  system?: string;          // System prompt
  model?: string;           // Model ID override
  maxIterations?: number;   // Max tool-use iterations
  skills?: "auto" | string[];  // Skills to load: "auto" = all, or specific names
  tools?: ToolDefinition[];    // Inline tools with handlers
  commands?: Record<string, CommandHandler>;  // Custom slash-command handlers (e.g. { "/reset": handler })
  ephemeral?: boolean;      // Memory-only, no persistence, no built-in tools/skills
  cache?: boolean;          // Enable prompt caching (default: true)
}
```

### get

```typescript
CAT.agent.conversation.get(id: string): Promise<ConversationInstance | null>
```

### ConversationInstance

```typescript
interface ConversationInstance {
  readonly id: string;
  readonly title: string;
  readonly modelId: string;

  // Send a message, get a complete reply
  chat(content: string | ContentBlock[], options?: ChatOptions): Promise<ChatReply>;

  // Send a message, get a streaming response
  chatStream(content: string | ContentBlock[], options?: ChatOptions): Promise<AsyncIterable<StreamChunk>>;

  // Get full message history
  getMessages(): Promise<ChatMessage[]>;

  // Persist conversation to storage
  save(): Promise<void>;
}
```

### ChatOptions

```typescript
interface ChatOptions {
  tools?: ToolDefinition[];   // Inline tools for this chat turn
}

interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;  // JSON Schema
  handler: (args: Record<string, unknown>) => Promise<unknown>;
}
```

### ChatReply

```typescript
interface ChatReply {
  content: string | ContentBlock[];
  thinking?: string;
  toolCalls?: ToolCallInfo[];
  usage?: { inputTokens: number; outputTokens: number };
}
```

### StreamChunk

```typescript
interface StreamChunk {
  type: "content_delta" | "thinking_delta" | "tool_call" | "content_block" | "done" | "error";
  content?: string;           // Text delta (for content_delta / thinking_delta)
  block?: ContentBlock;       // Complete block (for content_block)
  toolCall?: ToolCallInfo;    // Tool call info (for tool_call)
  usage?: { inputTokens: number; outputTokens: number };
  error?: string;
  errorCode?: string;         // "rate_limit" | "auth" | "tool_timeout" | "max_iterations" | "api_error"
}
```

**Usage pattern:**

```js
const stream = await conv.chatStream("Summarize this article...");
let result = "";
for await (const chunk of stream) {
  if (chunk.type === "content_delta") {
    result += chunk.content;
  } else if (chunk.type === "error") {
    console.error(chunk.error);
  }
}
```

### ContentBlock types

```typescript
type TextBlock = { type: "text"; text: string };
type ImageBlock = { type: "image"; attachmentId: string; mimeType: string; name?: string };
type FileBlock = { type: "file"; attachmentId: string; mimeType: string; name: string; size?: number };
type AudioBlock = { type: "audio"; attachmentId: string; mimeType: string; name?: string; durationMs?: number };
type ContentBlock = TextBlock | ImageBlock | FileBlock | AudioBlock;
```

### ChatMessage

```typescript
interface ChatMessage {
  id: string;
  conversationId: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string | ContentBlock[];
  toolCalls?: ToolCallInfo[];
  toolCallId?: string;
  createdAt: number;
}
```

### ToolCallInfo

```typescript
interface ToolCallInfo {
  id: string;
  name: string;
  arguments: string;    // JSON string
  result?: string;
}
```

## CAT.agent.dom

Browser DOM control. All methods accept an optional `tabId` — defaults to the active tab if omitted.

### listTabs

```typescript
CAT.agent.dom.listTabs(): Promise<TabInfo[]>
```

```typescript
interface TabInfo {
  tabId: number;
  url: string;
  title: string;
  active: boolean;
  windowId: number;
  discarded: boolean;
}
```

### navigate

```typescript
CAT.agent.dom.navigate(url: string, options?: NavigateOptions): Promise<NavigateResult>
```

```typescript
interface NavigateOptions {
  tabId?: number;
  waitUntil?: boolean;    // Wait for page load
  timeout?: number;       // Navigation timeout in ms
}

interface NavigateResult {
  tabId: number;
  url: string;
  title: string;
}
```

### readPage

```typescript
CAT.agent.dom.readPage(options?: ReadPageOptions): Promise<PageContent>
```

```typescript
interface ReadPageOptions {
  tabId?: number;
  selector?: string;      // CSS selector to narrow scope
  maxLength?: number;      // Max HTML length
  removeTags?: string[];   // Tags/selectors to remove before reading (e.g. ["script", "style", "svg"])
}

interface PageContent {
  title: string;
  url: string;
  html: string;
  truncated?: boolean;
  totalLength?: number;
}
```

### screenshot

```typescript
CAT.agent.dom.screenshot(options?: ScreenshotOptions): Promise<ScreenshotResult>
```

```typescript
interface ScreenshotOptions {
  tabId?: number;
  quality?: number;       // JPEG quality 0-100
  fullPage?: boolean;     // Capture full scrollable page
  selector?: string;      // CSS selector to capture a specific element
  saveTo?: string;        // OPFS workspace path to save the screenshot
}

interface ScreenshotResult {
  dataUrl: string;        // Base64 data-URL string
  path?: string;          // OPFS path (when saveTo is used)
  size?: number;          // File size in bytes (when saveTo is used)
}
```

### click

```typescript
CAT.agent.dom.click(selector: string, options?: DomActionOptions): Promise<ActionResult>
```

```typescript
interface DomActionOptions {
  tabId?: number;
  trusted?: boolean;      // CDP-level trusted click (bypasses JS event listeners)
}

interface ActionResult {
  success: boolean;
  navigated?: boolean;    // Did the click cause navigation?
  url?: string;           // New URL if navigated
  newTab?: { tabId: number; url: string };  // If a new tab opened
  dialog?: { type: "alert" | "confirm" | "prompt"; message: string };  // If a dialog appeared
}
```

### fill

```typescript
CAT.agent.dom.fill(selector: string, value: string, options?: DomActionOptions): Promise<ActionResult>
```

Same options and return as `click`.

### scroll

```typescript
CAT.agent.dom.scroll(direction: ScrollDirection, options?: ScrollOptions): Promise<ScrollResult>
```

```typescript
type ScrollDirection = "up" | "down" | "top" | "bottom";

interface ScrollOptions {
  tabId?: number;
  selector?: string;      // Scroll within a specific element
}

interface ScrollResult {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
  atBottom: boolean;
}
```

### waitFor

```typescript
CAT.agent.dom.waitFor(selector: string, options?: WaitForOptions): Promise<WaitForResult>
```

```typescript
interface WaitForOptions {
  tabId?: number;
  timeout?: number;       // Max wait time in ms
}

interface WaitForResult {
  found: boolean;
  element?: {
    selector: string;
    tag: string;
    text: string;
    role?: string;
    type?: string;
    visible: boolean;
  };
}
```

### executeScript

```typescript
CAT.agent.dom.executeScript(code: string, options?: ExecuteScriptOptions): Promise<unknown>
```

Executes JavaScript in the page context and returns the result.

```typescript
interface ExecuteScriptOptions {
  tabId?: number;
  world?: "MAIN" | "ISOLATED";  // Script execution world. Default: ISOLATED
}
```

### startMonitor / stopMonitor / peekMonitor

Monitor DOM changes (dialogs, added nodes) on a tab. Useful for detecting what happened after a click or navigation.

```typescript
CAT.agent.dom.startMonitor(tabId: number): Promise<void>
CAT.agent.dom.stopMonitor(tabId: number): Promise<MonitorResult>
CAT.agent.dom.peekMonitor(tabId: number): Promise<MonitorStatus>
```

```typescript
interface MonitorResult {
  dialogs: Array<{ type: string; message: string }>;
  addedNodes: Array<{ tag: string; id?: string; class?: string; role?: string; text: string }>;
}

interface MonitorStatus {
  hasChanges: boolean;
  dialogCount: number;
  nodeCount: number;
}
```

**Usage pattern:**

```js
// Start monitoring before an action
await CAT.agent.dom.startMonitor(tabId);

// Perform the action
await CAT.agent.dom.click(".submit-btn", { tabId });

// Peek to check if anything changed (non-destructive)
const status = await CAT.agent.dom.peekMonitor(tabId);
if (status.hasChanges) {
  // Stop and collect all changes
  const changes = await CAT.agent.dom.stopMonitor(tabId);
  // changes.dialogs — any alert/confirm/prompt that appeared
  // changes.addedNodes — new DOM elements added
}
```

## CAT.agent.skills

Manage Skills and call Skill Scripts programmatically.

### list

```typescript
CAT.agent.skills.list(): Promise<SkillSummary[]>
```

```typescript
interface SkillSummary {
  name: string;
  description: string;
  toolNames: string[];
  referenceNames: string[];
  hasConfig?: boolean;
  installtime: number;
  updatetime: number;
}
```

### get

```typescript
CAT.agent.skills.get(name: string): Promise<SkillRecord | null>
```

### install

```typescript
CAT.agent.skills.install(
  skillMd: string,
  scripts?: Array<{ name: string; code: string }>,
  references?: Array<{ name: string; content: string }>
): Promise<SkillRecord>
```

### remove

```typescript
CAT.agent.skills.remove(name: string): Promise<boolean>
```

### call

```typescript
CAT.agent.skills.call(skillName: string, scriptName: string, params?: Record<string, unknown>): Promise<unknown>
```

Call a Skill Script by specifying the skill name and script name within that skill. Returns the script's return value.

**Example:**

```js
// @grant CAT.agent.skills
const result = await CAT.agent.skills.call("search", "google", { keyword: "scriptcat" });
```

## CAT.agent.task

Manage scheduled Agent tasks.

### create

```typescript
CAT.agent.task.create(options: AgentTaskCreateOptions): Promise<AgentTask>
```

```typescript
interface AgentTaskCreateOptions {
  name: string;
  crontab: string;                    // Cron expression
  mode: "internal" | "event";        // "internal" = Agent runs prompt; "event" = fires to script
  enabled: boolean;
  notify?: boolean;                   // Show notification on run
  prompt?: string;                    // Prompt for internal mode
  modelId?: string;
  conversationId?: string;            // Continue in existing conversation
  skills?: "auto" | string[];        // Which skills to load
  maxIterations?: number;
}
```

### list

```typescript
CAT.agent.task.list(): Promise<AgentTask[]>
```

### get

```typescript
CAT.agent.task.get(id: string): Promise<AgentTask | undefined>
```

### update

```typescript
CAT.agent.task.update(id: string, task: Partial<AgentTask>): Promise<AgentTask>
```

### remove

```typescript
CAT.agent.task.remove(id: string): Promise<boolean>
```

### runNow

```typescript
CAT.agent.task.runNow(id: string): Promise<void>
```

Trigger a task immediately, regardless of its cron schedule. The task must be enabled.

### addListener / removeListener

```typescript
CAT.agent.task.addListener(
  taskId: string,
  callback: (trigger: AgentTaskTrigger) => void
): number

CAT.agent.task.removeListener(listenerId: number): void
```

For `mode: "event"` tasks — the script receives trigger notifications instead of the Agent running a prompt.

```typescript
interface AgentTaskTrigger {
  taskId: string;
  name: string;
  crontab: string;
  triggeredAt: number;
}
```

### AgentTask

Full task object returned by create/get/list/update:

```typescript
interface AgentTask {
  id: string;
  name: string;
  crontab: string;
  mode: "internal" | "event";
  enabled: boolean;
  notify: boolean;
  prompt?: string;
  modelId?: string;
  conversationId?: string;
  skills?: "auto" | string[];
  maxIterations?: number;
  sourceScriptUuid?: string;
  lastruntime?: number;
  nextruntime?: number;
  lastRunStatus?: "success" | "error";
  lastRunError?: string;
  createtime: number;
  updatetime: number;
}
```

## CAT.agent.model

Query configured LLM models (read-only, apiKey excluded).

### list

```typescript
CAT.agent.model.list(): Promise<ModelSummary[]>
```

### get

```typescript
CAT.agent.model.get(id: string): Promise<ModelSummary | null>
```

### getDefault

```typescript
CAT.agent.model.getDefault(): Promise<string>
```

Returns the default model ID, or empty string if none set.

### ModelSummary

```typescript
interface ModelSummary {
  id: string;              // Unique model config ID
  name: string;            // Display name (e.g. "GPT-4o", "Claude Sonnet")
  provider: "openai" | "anthropic";
  apiBaseUrl: string;      // API base URL
  model: string;           // Model identifier sent to provider API
  maxTokens?: number;      // Max output tokens (omitted if unset)
}
```

## CAT.agent.opfs

Workspace file system operations. All paths are relative to `agents/workspace/` in OPFS.

### write

```typescript
CAT.agent.opfs.write(path: string, content: string | Blob): Promise<WriteResult>
```

Creates parent directories automatically. Accepts string, Blob, or data URL.

```typescript
interface WriteResult {
  path: string;    // Sanitized path
  size: number;    // Size in bytes
}
```

### read

```typescript
CAT.agent.opfs.read(path: string, format?: "text" | "bloburl"): Promise<ReadResult>
```

Use `format: "bloburl"` to get a blob URL for binary files.

```typescript
interface ReadResult {
  path: string;
  content?: string;    // Text content (when format is "text" or omitted)
  blobUrl?: string;    // Blob URL (when format is "bloburl")
  size: number;
  mimeType?: string;   // Detected MIME type (when format is "bloburl")
}
```

### list

```typescript
CAT.agent.opfs.list(path?: string): Promise<FileEntry[]>
```

```typescript
interface FileEntry {
  name: string;
  type: "file" | "directory";
  size?: number;    // Only for files
}
```

### delete

```typescript
CAT.agent.opfs.delete(path: string): Promise<{ success: true }>
```
