const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const ROOT = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const scriptSrc = fs.readFileSync(path.join(ROOT, "script.js"), "utf8");

let failures = 0;
function assert(cond, msg){
  if(cond){ console.log("PASS - " + msg); }
  else { console.error("FAIL - " + msg); failures++; }
}

function setVal(document, id, val){
  const el = document.getElementById(id);
  el.value = val;
  el.dispatchEvent(new document.defaultView.Event("input", { bubbles: true }));
}

async function run(){
  const dom = new JSDOM(html, {
    url: "https://example.com/",
    runScripts: "outside-only",
    pretendToBeVisual: true
  });
  const { window } = dom;
  const { document } = window;

  // stub fetch so GitHub sync doesn't fire a real network call during init
  window.fetch = async () => ({ ok: false, status: 500, json: async () => ([]) });

  // jsdom doesn't implement IntersectionObserver - stub it
  window.IntersectionObserver = class {
    observe(){} unobserve(){} disconnect(){}
  };

  dom.window.eval(scriptSrc);

  // let the async init() IIFE settle
  await new Promise(r => setTimeout(r, 50));
  const tick = () => new Promise(r => setTimeout(r, 30));

  // ---- Test 1: cert ID collision after delete ----
  async function addCert(title, issuer, url){
    document.getElementById("toggleCertPanel").click();
    setVal(document, "cTitle", title);
    setVal(document, "cIssuer", issuer);
    setVal(document, "cUrl", url || "");
    document.getElementById("saveCertBtn").click();
    await tick();
  }

  await addCert("Cert A", "Issuer A");
  await addCert("Cert B", "Issuer B");
  await addCert("Cert C", "Issuer C");

  let ids = [...document.querySelectorAll("#certificatesList .record-id")].map(e => e.textContent);
  assert(ids.length === 3 && new Set(ids).size === 3, "three certs created with unique ids: " + ids.join(", "));

  const middleId = ids[1];
  const removeBtn = [...document.querySelectorAll('[data-action="delete"]')].find(b => b.dataset.id === middleId);
  assert(!!removeBtn, "found remove button for middle cert " + middleId);
  removeBtn.click();
  await tick();

  ids = [...document.querySelectorAll("#certificatesList .record-id")].map(e => e.textContent);
  assert(ids.length === 2, "two certs remain after delete: " + ids.join(", "));

  await addCert("Cert D", "Issuer D");
  ids = [...document.querySelectorAll("#certificatesList .record-id")].map(e => e.textContent);
  const uniqueAfter = new Set(ids).size === ids.length;
  assert(uniqueAfter, "no id collision after delete+add: " + ids.join(", "));
  assert(!ids.includes(middleId) || ids.filter(i => i === middleId).length === 1, "deleted id not silently reused as a duplicate");

  // ---- Test 2: malicious credential URL is rejected/escaped ----
  const countBefore = document.querySelectorAll("#certificatesList .record").length;
  await addCert("Cert E", "Issuer E", 'javascript:alert(1)//" onmouseover="alert(2)');
  const statusText = document.getElementById("certFormStatus").textContent;
  assert(/valid http/i.test(statusText), "javascript: URL rejected at save time with clear error: \"" + statusText + "\"");
  const countAfterBad = document.querySelectorAll("#certificatesList .record").length;
  assert(countAfterBad === countBefore, "malicious cert was NOT added to the list");

  await addCert('Cert F" onmouseover="alert(3)', "Issuer F", "https://example.com/cred/123");
  const countAfter = document.querySelectorAll("#certificatesList .record").length;
  assert(countAfter === countBefore + 1, "legit https-credential cert was added (bad one was rejected, this one wasn't)");

  const lastLink = [...document.querySelectorAll("#certificatesList a")].find(a => a.href.includes("example.com/cred/123"));
  assert(!!lastLink, "https credential link rendered correctly: " + (lastLink && lastLink.href));

  const injected = document.querySelector('#certificatesList [onmouseover]');
  assert(!injected, "no onmouseover attribute injected into the DOM from malicious title/url input");

  const titleEls = [...document.querySelectorAll("#certificatesList h3")].map(h => h.textContent);
  assert(titleEls.some(t => t.includes('Cert F" onmouseover="alert(3)')), "malicious title rendered as literal text, not parsed as an attribute");

  console.log("\n" + (failures === 0 ? "ALL TESTS PASSED" : failures + " TEST(S) FAILED"));
  process.exit(failures === 0 ? 0 : 1);
}

run().catch(e => { console.error(e); process.exit(1); });
