// ==SkillScript==
// @name         write_cells
// @description  Write values to cells in a Synology Office spreadsheet. Opens an independent socket.io connection via EIO=4 protocol and sends cell changes. The spreadsheet page must be open. UI updates automatically via collaborative sync.
// @param        tabId number [required] Tab ID of the open Synology Office spreadsheet page
// @param        changes string [required] JSON array of [row, col, value] triples (0-based). E.g. [[0,0,"Hello"],[1,2,42]]
// @param        sheetId string Target sheet ID (default: "sh_1")
// @grant        CAT.agent.dom
// @timeout      60
// ==/SkillScript==

// Parse changes
let changes;
try {
  changes = JSON.parse(args.changes);
} catch (e) {
  return { error: "Invalid changes JSON: " + e.message };
}

if (!Array.isArray(changes) || changes.length === 0) {
  return { error: "changes must be a non-empty array of [row, col, value] triples" };
}

const sheetId = args.sheetId || "sh_1";

// Execute the entire write flow in page context (needs cookies, io global, performance entries)
const code = `
  return (async function() {
    var sheetId = ${JSON.stringify(sheetId)};
    var changes = ${JSON.stringify(changes)};

    // Extract connection params
    var linkId = location.pathname.split('/').filter(Boolean).pop();
    var objectId = null;
    performance.getEntriesByType('resource').forEach(function(e) {
      var m = e.name.match(/objectId=([^&]+)/);
      if (m && !objectId) objectId = decodeURIComponent(m[1]);
    });
    if (!objectId) return { error: 'Could not find objectId' };

    var synoToken = null;
    try {
      synoToken = io.managers[Object.keys(io.managers)[0]].opts.query.SynoToken;
    } catch(e) {}
    if (!synoToken) return { error: 'Could not find SynoToken' };

    var base = location.origin + '/oo/r/oo/socket.io/sheet/' +
      '?objectId=' + encodeURIComponent(objectId) +
      '&linkId=' + linkId + '&EIO=4';
    var h = { 'x-syno-token': synoToken };

    // Step 1: Polling handshake → get sid
    var r1 = await fetch(base + '&transport=polling', { credentials: 'include', headers: h });
    if (!r1.ok) return { error: 'Handshake failed: ' + r1.status };
    var t1 = await r1.text();
    var m1 = t1.match(/0(\\{.*\\})/);
    if (!m1) return { error: 'Invalid handshake response' };
    var sid = JSON.parse(m1[1]).sid;
    var sidParam = '&sid=' + sid;

    // Step 2: POST namespace connect "40" via polling
    var r2 = await fetch(base + '&transport=polling' + sidParam, {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'text/plain;charset=UTF-8' }, h),
      body: '40',
      credentials: 'include'
    });
    if (!r2.ok) return { error: 'Namespace connect POST failed: ' + r2.status };

    // Step 3: GET namespace connect ack via polling
    var r3 = await fetch(base + '&transport=polling' + sidParam, { credentials: 'include', headers: h });
    if (!r3.ok) return { error: 'Namespace connect GET failed: ' + r3.status };

    // Step 4: POST say_hello + ask_peers + init via polling
    var r4 = await fetch(base + '&transport=polling' + sidParam, {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'text/plain;charset=UTF-8' }, h),
      body: '420["say_hello"]\\x1e421["ask_peers"]\\x1e422["init"]',
      credentials: 'include'
    });
    if (!r4.ok) return { error: 'Init POST failed: ' + r4.status };

    // Step 5: GET init ack responses (may need multiple GETs)
    var initRev = null;
    for (var i = 0; i < 3 && initRev === null; i++) {
      var r = await fetch(base + '&transport=polling' + sidParam, { credentials: 'include', headers: h });
      if (!r.ok) break;
      var t = await r.text();
      t.split('\\x1e').forEach(function(pkt) {
        if (pkt.startsWith('432')) {
          var data = JSON.parse(pkt.substring(3));
          var maxRev = data[1];
          if (Array.isArray(data[2])) {
            data[2].forEach(function(op) {
              if (op.rev && op.rev > maxRev) maxRev = op.rev;
            });
          }
          initRev = maxRev + 1;
        }
      });
    }

    if (initRev === null) return { error: 'Did not receive init ack from server' };

    // Step 6: Upgrade to WebSocket and send write
    var wsUrl = location.origin.replace('https:', 'wss:').replace('http:', 'ws:') +
      '/oo/r/oo/socket.io/sheet/' +
      '?objectId=' + encodeURIComponent(objectId) +
      '&linkId=' + linkId + '&EIO=4&transport=websocket' + sidParam;

    return new Promise(function(resolve) {
      var timeout = setTimeout(function() {
        resolve({ error: 'WebSocket write timed out after 15s' });
        try { ws.close(); } catch(e) {}
      }, 15000);

      var ws = new WebSocket(wsUrl);
      ws.onopen = function() { ws.send('2probe'); };
      ws.onerror = function() {
        clearTimeout(timeout);
        resolve({ error: 'WebSocket connection error' });
      };

      ws.onmessage = function(e) {
        var msg = typeof e.data === 'string' ? e.data : '';

        // probe ack → upgrade + send write
        if (msg === '3probe') {
          ws.send('5');
          var payload = '423' + JSON.stringify(["set", {
            cmd: "value",
            id: sheetId,
            changes: changes,
            nfRefs: changes.map(function(_, i) { return i; }),
            nfs: [],
            rev: initRev
          }]);
          ws.send(payload);
        }

        // write ack
        if (msg.startsWith('433')) {
          clearTimeout(timeout);
          var ack = JSON.parse(msg.substring(3));
          var success = ack[2] === 1;
          setTimeout(function() { ws.close(); }, 500);
          resolve({
            success: success,
            cellsWritten: success ? changes.length : 0,
            ack: ack,
            rev: initRev
          });
        }

        // server ping → pong
        if (msg === '2') { ws.send('3'); }
      };
    });
  })();
`;

const result = await CAT.agent.dom.executeScript(code, { tabId: args.tabId });
return result;
