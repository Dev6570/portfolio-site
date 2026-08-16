const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const ROOT = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const rawScript = fs.readFileSync(path.join(ROOT, "script.js"), "utf8");

let failures = 0;
function assert(cond, msg){
  if(cond){ console.log("PASS - " + msg); }
  else { console.error("FAIL - " + msg); failures++; }
}

function loadDom(scriptSrc){
  const dom = new JSDOM(html, { url: "https://example.com/", runScripts: "outside-only", pretendToBeVisual: true });
  const { window } = dom;
  window.IntersectionObserver = class { observe(){} unobserve(){} disconnect(){} };
  dom.window.eval(scriptSrc);
  return dom;
}

async function run(){
  // ---- Part 1: default shipped file (empty lists) ----
  const dom1 = loadDom(rawScript);
  await new Promise(r => setTimeout(r, 50));
  const doc1 = dom1.window.document;

  assert(!doc1.getElementById("editProfileBtn"), "no 'Edit profile' button exists anywhere on the page");
  assert(!doc1.getElementById("saveProfileBtn"), "no 'Save profile' button exists");
  assert(!doc1.getElementById("toggleCertPanel"), "no '+ Add certificate' button exists");
  assert(!doc1.getElementById("saveCertBtn"), "no 'Save certificate' button exists");
  assert(!doc1.getElementById("ghUsername"), "no GitHub username input exists");
  assert(!doc1.getElementById("syncBtn"), "no 'Sync from GitHub' button exists");
  assert(!doc1.getElementById("exportBtn"), "no 'Export site data' button exists");
  assert(!doc1.querySelector(".admin-panel"), "no .admin-panel element exists anywhere in the DOM");
  assert(!doc1.querySelector('[data-action="delete"]'), "no delete/remove buttons exist for certificates");
  assert(!doc1.querySelector(".pin-btn"), "no pin/feature buttons exist for projects");

  assert(doc1.getElementById("projectsList").querySelector(".empty-state"), "empty projects list shows the empty-state message");
  assert(doc1.getElementById("certificatesList").querySelector(".empty-state"), "empty certificates list shows the empty-state message");

  const themeBtn = doc1.getElementById("themeToggleRail");
  themeBtn.click();
  await new Promise(r => setTimeout(r, 20));
  assert(dom1.window.document.body.classList.contains("theme-dark"), "theme toggle still works (dark mode applied)");

  // ---- Part 2: inject sample project/certificate data, including malicious values ----
  const sampleScript = rawScript
    .replace(
      /const defaultProjects = \[[\s\S]*?\];/,
      `const defaultProjects = [
        { title: 'Cool Project" onmouseover="alert(1)', description: "Does cool things.", url: "https://github.com/example/cool", tags: ["Python","API"], status: "active" },
        { title: "Bad Link Project", description: "desc", url: 'javascript:alert(1)//"x', tags: [], status: "archived" }
      ];`
    )
    .replace(
      /const defaultCertificates = \[[\s\S]*?\];/,
      `const defaultCertificates = [
        { title: 'Cert" onmouseover="alert(2)', issuer: "Issuer A", date: "2024-01-15", credentialUrl: "https://example.com/cred/1", image: null },
        { title: "Bad Cred Cert", issuer: "Issuer B", date: "2024-02-01", credentialUrl: "javascript:alert(2)", image: null }
      ];`
    );

  const dom2 = loadDom(sampleScript);
  await new Promise(r => setTimeout(r, 50));
  const doc2 = dom2.window.document;

  const projectRecords = doc2.querySelectorAll("#projectsList .record");
  assert(projectRecords.length === 2, "both sample projects rendered: " + projectRecords.length);

  const projectLinks = [...doc2.querySelectorAll("#projectsList a")];
  assert(projectLinks.some(a => a.href.includes("github.com/example/cool")), "valid https project URL rendered as a real link");
  assert(!projectLinks.some(a => a.href.startsWith("javascript:")), "javascript: project URL was NOT rendered as a clickable link");

  const projectTitles = [...doc2.querySelectorAll("#projectsList h3")].map(h => h.textContent);
  assert(projectTitles.some(t => t.includes('Cool Project" onmouseover="alert(1)')), "malicious project title rendered as literal text: " + JSON.stringify(projectTitles));
  assert(!doc2.querySelector("#projectsList [onmouseover]"), "no onmouseover attribute injected into the DOM from project data");

  const certRecords = doc2.querySelectorAll("#certificatesList .record");
  assert(certRecords.length === 2, "both sample certificates rendered: " + certRecords.length);

  const certLinks = [...doc2.querySelectorAll("#certificatesList a")];
  assert(certLinks.some(a => a.href.includes("example.com/cred/1")), "valid https credential URL rendered as a real link");
  assert(!certLinks.some(a => a.href.startsWith("javascript:")), "javascript: credential URL was NOT rendered as a clickable link");
  assert(!doc2.querySelector("#certificatesList [onmouseover]"), "no onmouseover attribute injected into the DOM from certificate data");

  const certIds = [...doc2.querySelectorAll("#certificatesList .record-id")].map(e => e.textContent);
  assert(certIds[0] === "CRT-001" && certIds[1] === "CRT-002", "certificate reference numbers assigned sequentially: " + certIds.join(", "));

  console.log("\n" + (failures === 0 ? "ALL TESTS PASSED" : failures + " TEST(S) FAILED"));
  process.exit(failures === 0 ? 0 : 1);
}

run().catch(e => { console.error(e); process.exit(1); });
