// ==SkillScript==
// @name         read_sheet
// @description  Read all cell data from a Synology Office spreadsheet. Extracts connection params from the open page and calls the Snapshot API. Returns structured sheet data with cell values.
// @param        tabId number [required] Tab ID of the open Synology Office spreadsheet page
// @param        sheetId string Specific sheet ID to read (e.g. "sh_1"). Omit to read all sheets.
// @grant        CAT.agent.dom
// @timeout      30
// ==/SkillScript==

// Step 1: Extract connection params from the page
const params = await CAT.agent.dom.executeScript(`
  var result = {};

  // Extract linkId from URL path
  var pathParts = location.pathname.split('/');
  result.linkId = pathParts[pathParts.length - 1] || pathParts[pathParts.length - 2];
  result.origin = location.origin;

  // Extract objectId from performance entries
  var entries = performance.getEntriesByType('resource');
  for (var i = 0; i < entries.length; i++) {
    var match = entries[i].name.match(/objectId=([^&]+)/);
    if (match) {
      result.objectId = decodeURIComponent(match[1]);
      break;
    }
  }

  // Extract SynoToken from io.managers
  try {
    var mgrKeys = Object.keys(io.managers);
    if (mgrKeys.length > 0) {
      var mgr = io.managers[mgrKeys[0]];
      if (mgr.opts && mgr.opts.query) {
        result.synoToken = mgr.opts.query.SynoToken;
      }
    }
  } catch(e) {}

  // Fallback: get SynoToken from cookie or meta
  if (!result.synoToken) {
    var scripts = document.querySelectorAll('script[src]');
    for (var i = 0; i < scripts.length; i++) {
      var m = scripts[i].src.match(/SynoToken=([^&]+)/);
      if (m) { result.synoToken = m[1]; break; }
    }
  }

  return result;
`, { tabId: args.tabId });

if (!params || !params.objectId) {
  return { error: "Could not extract objectId from the page. Make sure a Synology Office spreadsheet is open in this tab." };
}
if (!params.synoToken) {
  return { error: "Could not extract SynoToken. The session may have expired." };
}

// Step 2: Call Snapshot API from page context (to reuse cookies)
const snapshotCode = `
  return (async function() {
    var objectId = ${JSON.stringify(params.objectId)};
    var synoToken = ${JSON.stringify(params.synoToken)};

    var formData = new URLSearchParams();
    formData.append('api', 'SYNO.Office.Sheet.Snapshot');
    formData.append('method', 'get');
    formData.append('version', '1');
    formData.append('password', '""');
    formData.append('object_id', '"' + objectId + '"');
    formData.append('sharing_token', '""');

    var resp = await fetch(location.origin + '/oo/r/webapi/entry.cgi/SYNO.Office.Sheet.Snapshot', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'x-syno-token': synoToken
      },
      body: formData.toString(),
      credentials: 'include'
    });

    if (!resp.ok) {
      return { error: 'Snapshot API returned ' + resp.status + ' ' + resp.statusText };
    }

    return await resp.json();
  })();
`;

const snapshot = await CAT.agent.dom.executeScript(snapshotCode, { tabId: args.tabId });

if (!snapshot || !snapshot.data) {
  return { error: "Snapshot API returned unexpected response", raw: snapshot };
}

// Step 3: Format the response
const data = snapshot.data;
const index = data.index;
const sheets = [];

const sheetOrder = (index && index.order) || Object.keys(data).filter(k => k.startsWith('sh_'));

for (const sid of sheetOrder) {
  if (args.sheetId && sid !== args.sheetId) continue;

  const sheet = data[sid];
  if (!sheet) continue;

  const meta = (index && index.sheets && index.sheets[sid]) || {};
  if (meta.deleted) continue;

  sheets.push({
    id: sid,
    title: meta.title || sid,
    rowCount: sheet.rowCount,
    colCount: sheet.colCount,
    cells: sheet.cells || {},
    mergeCells: sheet.mergeCells || []
  });
}

return { sheets };
