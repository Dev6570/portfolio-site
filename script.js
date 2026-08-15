(function(){
  "use strict";

  /* ============================================================
     STORAGE ABSTRACTION
     Uses window.storage when running inside a Claude artifact
     preview, and falls back to localStorage for a normally
     deployed/hosted copy of this file. Both are wrapped so a
     missing API never breaks the page.
  ============================================================ */
  const hasArtifactStorage = typeof window.storage !== "undefined";

  async function storageGet(key){
    try{
      if(hasArtifactStorage){
        const res = await window.storage.get(key);
        return res ? JSON.parse(res.value) : null;
      }else{
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : null;
      }
    }catch(e){ return null; }
  }
  async function storageSet(key, value){
    try{
      if(hasArtifactStorage){
        await window.storage.set(key, JSON.stringify(value));
      }else{
        localStorage.setItem(key, JSON.stringify(value));
      }
      return true;
    }catch(e){ return false; }
  }

  /* ============================================================
     BASELINE DATA — edit these two objects directly (or use the
     "Export site data" tool below to regenerate them) so your
     profile and certificates show up for every visitor, not just
     in your own browser's storage.
  ============================================================ */
  const defaultProfile = {
    name: "Debabrata Nath",
    title: "Student- Aspiring AI Engineer",
    bio: "I'm a Computer Science student focused on full-stack development and AI engineering. I recently built a production-grade clinic management system with role-based access control using React and FastAPI, and am currently exploring retrieval-augmented generation (RAG) systems. I'm interested in the intersection of practical software engineering and applied LLM development.",
    email: "debabrata6570@gmail.com",
    location: "Bhubaneswar, Odisha",
    resume: null,       // data URL of an uploaded PDF
    resumeName: ""       // original filename, shown while editing
  };

  const defaultCertificates = [
    // Example entry — replace or remove:
    // { id:"CRT-2024-001", title:"Example Certificate", issuer:"Issuing Body",
    //   date:"2024-01-15", credentialUrl:"", image:null }
  ];

  /* ============================================================
     PROFILE
  ============================================================ */
  async function loadProfile(){
    const saved = await storageGet("profile");
    return saved || defaultProfile;
  }
  function renderProfile(p){
    document.getElementById("railName").textContent = p.name;
    document.getElementById("heroName").textContent = p.name;
    document.getElementById("heroTitle").textContent = p.title;
    document.getElementById("heroBio").textContent = p.bio;
    document.getElementById("pName").value = p.name;
    document.getElementById("pTitle").value = p.title;
    document.getElementById("pBio").value = p.bio;
    document.getElementById("pEmail").value = p.email || "";
    document.getElementById("pLocation").value = p.location || "";

    const links = document.getElementById("contactLinks");
    links.innerHTML = "";
    if(p.email){
      const a = document.createElement("a");
      a.href = "mailto:" + p.email;
      a.textContent = p.email;
      links.appendChild(a);
    }
    const meta = document.getElementById("heroMeta");
    meta.innerHTML = "";
    if(p.location){
      const d = document.createElement("div");
      d.textContent = p.location;
      meta.appendChild(d);
    }

    const resumeBtn = document.getElementById("resumeBtn");
    if(p.resume){
      resumeBtn.style.display = "inline-block";
      resumeBtn.href = p.resume;
      resumeBtn.download = (p.name || "resume") + ".pdf";
    }else{
      resumeBtn.style.display = "none";
    }
    document.getElementById("resumeFileName").textContent = p.resumeName ? "Current file: " + p.resumeName : "";
  }

  let pendingResume = null;
  let pendingResumeName = "";
  document.getElementById("resumeDropLabel").addEventListener("click", () => {
    document.getElementById("pResumeFile").click();
  });
  document.getElementById("pResumeFile").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if(!file) return;
    if(file.size > 8 * 1024 * 1024){
      document.getElementById("resumeFileName").textContent = "That file is over 8 MB — choose a smaller PDF.";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      pendingResume = reader.result;
      pendingResumeName = file.name;
      document.getElementById("resumeFileName").textContent = "Ready to save: " + file.name;
    };
    reader.readAsDataURL(file);
  });

  /* ============ Theme ============ */
  async function loadTheme(){
    const saved = await storageGet("theme");
    const mode = saved || "light";
    applyTheme(mode);
  }
  function applyTheme(mode){
    document.body.classList.toggle("theme-dark", mode === "dark");
    const label = mode === "dark" ? "Light mode" : "Dark mode";
    document.getElementById("themeToggleRail").textContent = mode === "dark" ? "Light" : "Dark";
    document.getElementById("themeToggleTop").textContent = mode === "dark" ? "Light" : "Dark";
    document.getElementById("themeToggleRail").setAttribute("aria-label", label);
    document.getElementById("themeToggleTop").setAttribute("aria-label", label);
  }
  async function toggleTheme(){
    const isDark = document.body.classList.contains("theme-dark");
    const next = isDark ? "light" : "dark";
    applyTheme(next);
    await storageSet("theme", next);
  }
  document.getElementById("themeToggleRail").addEventListener("click", toggleTheme);
  document.getElementById("themeToggleTop").addEventListener("click", toggleTheme);

  document.getElementById("editProfileBtn").addEventListener("click", () => {
    document.getElementById("profilePanel").classList.toggle("open");
  });
  document.getElementById("saveProfileBtn").addEventListener("click", async () => {
    const existing = await loadProfile();
    const p = {
      name: document.getElementById("pName").value.trim() || defaultProfile.name,
      title: document.getElementById("pTitle").value.trim(),
      bio: document.getElementById("pBio").value.trim(),
      email: document.getElementById("pEmail").value.trim(),
      location: document.getElementById("pLocation").value.trim(),
      resume: pendingResume || existing.resume || null,
      resumeName: pendingResumeName || existing.resumeName || ""
    };
    await storageSet("profile", p);
    renderProfile(p);
    pendingResume = null;
    pendingResumeName = "";
    document.getElementById("profilePanel").classList.remove("open");
  });

  /* ============================================================
     PROJECTS — GitHub sync
  ============================================================ */
  let currentRepos = [];
  let sortMode = "updated";
  let featuredIds = [];

  async function loadFeatured(){
    featuredIds = (await storageGet("featured-projects")) || [];
  }
  async function toggleFeatured(repoId){
    repoId = String(repoId);
    if(featuredIds.includes(repoId)){
      featuredIds = featuredIds.filter(id => id !== repoId);
    }else{
      featuredIds.push(repoId);
    }
    await storageSet("featured-projects", featuredIds);
    renderProjects();
  }

  async function loadUsername(){
    return await storageGet("github-username");
  }

  async function fetchRepos(username){
    const statusEl = document.getElementById("ghStatus");
    const syncBtn = document.getElementById("syncBtn");
    statusEl.classList.remove("error");
    statusEl.textContent = "Fetching public repositories for " + username + "…";
    syncBtn.disabled = true;
    try{
      const res = await fetch(`https://api.github.com/users/${encodeURIComponent(username)}/repos?per_page=100&sort=updated`);
      if(res.status === 404){
        statusEl.textContent = "No GitHub user found with that username.";
        statusEl.classList.add("error");
        currentRepos = [];
        renderProjects();
        return;
      }
      if(!res.ok){
        statusEl.textContent = "GitHub couldn't be reached right now (status " + res.status + "). Try again shortly.";
        statusEl.classList.add("error");
        return;
      }
      const data = await res.json();
      currentRepos = data.filter(r => !r.fork);
      await storageSet("github-username", username);
      statusEl.textContent = currentRepos.length
        ? `Synced ${currentRepos.length} repositories — last updated just now.`
        : "This account has no public, non-fork repositories yet.";
      renderProjects();
    }catch(e){
      statusEl.textContent = "Couldn't reach GitHub. Check your connection and try again.";
      statusEl.classList.add("error");
    }finally{
      syncBtn.disabled = false;
    }
  }

  function timeAgo(dateStr){
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const days = Math.floor(diffMs / 86400000);
    if(days < 1) return "today";
    if(days < 30) return days + "d ago";
    if(days < 365) return Math.floor(days/30) + "mo ago";
    return Math.floor(days/365) + "y ago";
  }

  function repoRefId(repo){
    // Short, stable reference derived from the repo id — reads like a real catalog number.
    return "PRJ-" + String(repo.id).slice(-4).padStart(4, "0");
  }

  function renderProjects(){
    const list = document.getElementById("projectsList");
    list.innerHTML = "";
    if(!currentRepos.length){
      list.innerHTML = `<div class="empty-state"><strong>No projects synced yet</strong>Enter a GitHub username above and select "Sync from GitHub" to pull in public repositories.</div>`;
      return;
    }
    const sorted = [...currentRepos].sort((a,b) => {
      const aPinned = featuredIds.includes(String(a.id));
      const bPinned = featuredIds.includes(String(b.id));
      if(aPinned !== bPinned) return aPinned ? -1 : 1;
      if(sortMode === "stars") return b.stargazers_count - a.stargazers_count;
      return new Date(b.pushed_at) - new Date(a.pushed_at);
    });
    sorted.forEach((repo) => {
      const el = document.createElement("article");
      const pinned = featuredIds.includes(String(repo.id));
      el.className = "record" + (pinned ? " featured" : "");
      const isActive = (Date.now() - new Date(repo.pushed_at).getTime()) < (1000*60*60*24*180);
      el.innerHTML = `
        <div class="record-id">${repoRefId(repo)}</div>
        <div class="record-body">
          <div class="record-head-row">
            <h3><a href="${repo.html_url}" target="_blank" rel="noopener">${escapeHtml(repo.name)}</a></h3>
            <button class="pin-btn ${pinned ? 'pinned' : ''}" data-repo-id="${repo.id}" title="${pinned ? 'Remove from featured' : 'Mark as featured'}" aria-label="${pinned ? 'Remove from featured' : 'Mark as featured'}">★</button>
          </div>
          <p class="record-desc">${escapeHtml(repo.description || "No description provided.")}</p>
          <div class="tag-row">
            ${pinned ? `<span class="tag status-active">FEATURED</span>` : ""}
            ${repo.language ? `<span class="tag">${escapeHtml(repo.language)}</span>` : ""}
            <span class="tag">★ ${repo.stargazers_count}</span>
            <span class="tag">updated ${timeAgo(repo.pushed_at)}</span>
            <span class="tag ${isActive ? 'status-active' : ''}">${isActive ? "ACTIVE" : "ARCHIVED"}</span>
          </div>
        </div>`;
      list.appendChild(el);
      requestAnimationFrame(() => observeReveal(el));
    });
    list.querySelectorAll(".pin-btn").forEach(btn => {
      btn.addEventListener("click", () => toggleFeatured(btn.dataset.repoId));
    });
  }

  document.getElementById("syncBtn").addEventListener("click", () => {
    const username = document.getElementById("ghUsername").value.trim();
    if(username) fetchRepos(username);
  });
  document.getElementById("ghUsername").addEventListener("keydown", (e) => {
    if(e.key === "Enter") document.getElementById("syncBtn").click();
  });
  document.getElementById("sortBtn").addEventListener("click", (e) => {
    sortMode = sortMode === "updated" ? "stars" : "updated";
    e.target.textContent = "Sort: " + (sortMode === "updated" ? "recently updated" : "most starred");
    renderProjects();
  });

  /* ============================================================
     CERTIFICATES
  ============================================================ */
  let certificates = [];
  let pendingImage = null;

  async function loadCertificates(){
    const saved = await storageGet("certificates");
    certificates = saved || defaultCertificates.slice();
    renderCertificates();
  }

  function nextCertId(){
    const prefix = "CRT-" + new Date().getFullYear() + "-";
    const maxN = certificates.reduce((max, c) => {
      if(c.id && c.id.indexOf(prefix) === 0){
        const n = parseInt(c.id.slice(prefix.length), 10);
        if(!isNaN(n) && n > max) return n;
      }
      return max;
    }, 0);
    return prefix + String(maxN + 1).padStart(3, "0");
  }

  function renderCertificates(){
    const list = document.getElementById("certificatesList");
    list.innerHTML = "";
    if(!certificates.length){
      list.innerHTML = `<div class="empty-state"><strong>No certificates added yet</strong>Select "+ Add certificate" to add your first credential.</div>`;
      return;
    }
    certificates.forEach((c) => {
      const el = document.createElement("article");
      el.className = "record cert-record";
      const safeUrl = safeCredentialUrl(c.credentialUrl);
      el.innerHTML = `
        <div class="record-id">${escapeHtml(c.id)}</div>
        <div class="record-body">
          <h3>${escapeHtml(c.title)}</h3>
          <p class="record-desc">${escapeHtml(c.issuer)}${c.date ? " — " + formatDate(c.date) : ""}</p>
          <div class="tag-row">
            ${safeUrl ? `<a href="${escapeHtml(safeUrl)}" target="_blank" rel="noopener" class="tag" style="text-decoration:none;">View credential ↗</a>` : ""}
          </div>
          <div class="cert-actions">
            <button class="btn subtle" data-action="delete" data-id="${c.id}">Remove</button>
          </div>
        </div>
        ${c.image ? `<img class="cert-thumb" src="${c.image}" alt="${escapeHtml(c.title)} certificate image" data-full="${c.image}">` : svgSeal()}
      `;
      list.appendChild(el);
      requestAnimationFrame(() => observeReveal(el));
    });

    list.querySelectorAll('[data-action="delete"]').forEach(btn => {
      btn.addEventListener("click", async () => {
        certificates = certificates.filter(c => c.id !== btn.dataset.id);
        await storageSet("certificates", certificates);
        renderCertificates();
      });
    });
    list.querySelectorAll(".cert-thumb").forEach(img => {
      img.addEventListener("click", () => openLightbox(img.dataset.full));
    });
  }

  function svgSeal(){
    return `<svg class="seal" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="30" cy="30" r="27" fill="none" stroke="#8C6A2F" stroke-width="1.5"/>
      <circle cx="30" cy="30" r="21" fill="none" stroke="#8C6A2F" stroke-width="1"/>
      <text x="30" y="27" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-size="6" fill="#8C6A2F" letter-spacing="1">VERIFIED</text>
      <text x="30" y="38" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-size="5" fill="#8C6A2F">RECORD</text>
    </svg>`;
  }

  function safeCredentialUrl(url){
    if(!url) return null;
    try{
      const u = new URL(url, window.location.href);
      if(u.protocol === "http:" || u.protocol === "https:") return u.href;
    }catch(e){ /* fall through */ }
    return null;
  }

  function formatDate(iso){
    const d = new Date(iso + "T00:00:00");
    if(isNaN(d)) return iso;
    return d.toLocaleDateString(undefined, { year:"numeric", month:"short", day:"numeric" });
  }

  document.getElementById("toggleCertPanel").addEventListener("click", () => {
    document.getElementById("certPanel").classList.toggle("open");
  });
  document.getElementById("cancelCertBtn").addEventListener("click", () => {
    document.getElementById("certPanel").classList.remove("open");
    clearCertForm();
  });

  document.getElementById("fileDropLabel").addEventListener("click", () => {
    document.getElementById("cFile").click();
  });
  document.getElementById("cFile").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if(!file) return;
    if(file.size > 4 * 1024 * 1024){
      document.getElementById("certFormStatus").textContent = "That image is over 4 MB — choose a smaller file.";
      document.getElementById("certFormStatus").classList.add("error");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      pendingImage = reader.result;
      const preview = document.getElementById("cPreview");
      preview.src = pendingImage;
      preview.style.display = "block";
    };
    reader.readAsDataURL(file);
  });

  function clearCertForm(){
    ["cTitle","cIssuer","cDate","cUrl"].forEach(id => document.getElementById(id).value = "");
    document.getElementById("cFile").value = "";
    document.getElementById("cPreview").style.display = "none";
    pendingImage = null;
    document.getElementById("certFormStatus").textContent = "";
    document.getElementById("certFormStatus").classList.remove("error");
  }

  document.getElementById("saveCertBtn").addEventListener("click", async () => {
    const title = document.getElementById("cTitle").value.trim();
    const issuer = document.getElementById("cIssuer").value.trim();
    const statusEl = document.getElementById("certFormStatus");
    if(!title || !issuer){
      statusEl.textContent = "A title and issuing organization are required.";
      statusEl.classList.add("error");
      return;
    }
    const urlInput = document.getElementById("cUrl").value.trim();
    const credentialUrl = safeCredentialUrl(urlInput) || "";
    if(urlInput && !credentialUrl){
      statusEl.textContent = "That credential URL doesn't look like a valid http(s) link.";
      statusEl.classList.add("error");
      return;
    }
    const entry = {
      id: nextCertId(),
      title, issuer,
      date: document.getElementById("cDate").value,
      credentialUrl,
      image: pendingImage
    };
    certificates.push(entry);
    const ok = await storageSet("certificates", certificates);
    statusEl.classList.remove("error");
    statusEl.textContent = ok ? "Saved." : "Saved in memory (browser storage was unavailable).";
    renderCertificates();
    clearCertForm();
    document.getElementById("certPanel").classList.remove("open");
  });

  /* ============================================================
     EXPORT — bakes profile + certificates into pasteable code
  ============================================================ */
  document.getElementById("exportBtn").addEventListener("click", async () => {
    const profile = await loadProfile();
    const box = document.getElementById("exportBox");
    const help = document.getElementById("exportHelp");
    const code =
`const defaultProfile = ${JSON.stringify(profile, null, 2)};

const defaultCertificates = ${JSON.stringify(certificates, null, 2)};

// Featured GitHub repo IDs (paste into featuredIds default, or ignore —
// pins are also fine to leave as a per-browser preference):
const defaultFeatured = ${JSON.stringify(featuredIds, null, 2)};`;
    box.value = code;
    box.style.display = "block";
    help.style.display = "block";
    box.focus();
    box.select();
  });

  /* ============================================================
     LIGHTBOX
  ============================================================ */
  function openLightbox(src){
    document.getElementById("lightboxImg").src = src;
    document.getElementById("lightbox").classList.add("open");
  }
  function closeLightbox(){
    document.getElementById("lightbox").classList.remove("open");
    document.getElementById("lightboxImg").src = "";
  }
  document.getElementById("lightboxClose").addEventListener("click", closeLightbox);
  document.getElementById("lightbox").addEventListener("click", (e) => {
    if(e.target.id === "lightbox") closeLightbox();
  });
  document.addEventListener("keydown", (e) => {
    if(e.key === "Escape") closeLightbox();
  });

  /* ============================================================
     SCROLL REVEAL + ACTIVE NAV
  ============================================================ */
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if(entry.isIntersecting){
        entry.target.classList.add("visible");
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });
  function observeReveal(el){ revealObserver.observe(el); }

  const navLinks = document.querySelectorAll(".rail-nav a, .top-bar a");
  const sections = document.querySelectorAll("section[id]");
  const navObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if(entry.isIntersecting){
        navLinks.forEach(a => a.classList.toggle("active", a.getAttribute("href") === "#" + entry.target.id));
      }
    });
  }, { rootMargin: "-40% 0px -50% 0px" });
  sections.forEach(s => navObserver.observe(s));

  function escapeHtml(str){
    const d = document.createElement("div");
    d.textContent = str == null ? "" : str;
    return d.innerHTML;
  }

  /* ============================================================
     INIT
  ============================================================ */
  document.getElementById("railYear").textContent = new Date().getFullYear();

  (async function init(){
    await loadTheme();

    const profile = await loadProfile();
    renderProfile(profile);

    await loadCertificates();
    await loadFeatured();

    const savedUsername = await loadUsername();
    if(savedUsername){
      document.getElementById("ghUsername").value = savedUsername;
      fetchRepos(savedUsername);
    }else{
      renderProjects();
    }
  })();

})();
