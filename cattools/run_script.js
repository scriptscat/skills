// ==CATTool==
// @name         run_script
// @description  Execute JavaScript code. Two modes: (1) Without tabId — runs in an isolated sandbox for data processing, calculations, JSON transformation. No DOM access. (2) With tabId — runs in the page context of the specified tab with full DOM access. Use `return` to produce output. Pass structured data via the `data` parameter to avoid embedding large literals in code.
// @param        code string [required] JavaScript code to execute. Must use `return` to return a value. Supports async/await. A `data` variable is available if the data parameter is provided.
// @param        data string JSON string to make available as the `data` variable. Use this to pass structured data for processing without embedding it in code.
// @param        tabId number Tab ID to execute in page context. Omit to run in the sandbox.
// @grant        CAT.agent.dom
// ==/CATTool==

// Parse the data parameter if provided
let parsedData;
if (args.data !== undefined) {
  try {
    parsedData = JSON.parse(args.data);
  } catch {
    return { error: "Invalid JSON in data parameter: " + args.data.slice(0, 200) };
  }
}

if (args.tabId !== undefined) {
  // Page context mode: execute in the specified tab via CAT.agent.dom
  // Wrap user code to inject `data` variable if provided
  let wrappedCode = args.code;
  if (parsedData !== undefined) {
    const dataLiteral = JSON.stringify(parsedData);
    wrappedCode = "var data = " + dataLiteral + ";\n" + args.code;
  }
  try {
    const result = await CAT.agent.dom.executeScript(wrappedCode, { tabId: args.tabId });
    if (result === undefined || result === null) {
      return "(no return value)";
    }
    return result;
  } catch (e) {
    return { error: e.message || String(e), name: e.name };
  }
} else {
  // Sandbox mode: execute in an isolated environment
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  try {
    const fn = new AsyncFunction("data", args.code);
    const result = await fn(parsedData);
    if (result === undefined) {
      return "(no return value)";
    }
    return result;
  } catch (e) {
    return { error: e.message || String(e), name: e.name };
  }
}
