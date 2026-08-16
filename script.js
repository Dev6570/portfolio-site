(function(){
  "use strict";

  /* ============================================================
     STORAGE ABSTRACTION
     Only used for the theme (dark/light) preference now — a
     harmless per-visitor setting, not editable page content.
     Falls back gracefully if storage is unavailable.
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
     SITE CONTENT — this is the single source of truth. Edit these
     three values directly, commit, and push. There is no in-browser
     editing UI: every visitor sees exactly what's defined here.
  ============================================================ */
  const defaultProfile = {
    name: "Your Name",
    title: "Role / Discipline",
    bio: "A short, first-person line about what you build and what you're looking for.",
    email: "you@example.com",
    location: "City, Country",
    resume: null   // e.g. "resume.pdf" - path to a PDF file you add to the repo, or null to hide the button
  };

  const defaultProjects = [
    // { title:"Project Name", description:"What it does.", url:"https://github.com/you/project",
    //   tags:["Python","API"], status:"active" }
  ];

  const defaultCertificates = [
    // { title:"Example Certificate", issuer:"Issuing Body", date:"2024-01-15",
    //   credentialUrl:"", image:null }
  ];

  /* ============================================================
     PROFILE
  ============================================================ */
  function renderProfile(p){
    document.getElementById("railName").textContent = p.name;
    document.getElementById("heroName").textContent = p.name;
    document.getElementById("heroTitle").textContent = p.title;
    document.getElementById("heroBio").textContent = p.bio;

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
    const safeResume = safeExternalUrl(p.resume);
    if(safeResume){
      resumeBtn.style.display = "inline-block";
      resumeBtn.href = safeResume;
    }else{
      resumeBtn.style.display = "none";
    }
  }

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

  /* ============================================================
     PROJECTS — static list, edited in code (see defaultProjects)
  ============================================================ */
  function renderProjects(){
    const list = document.getElementById("projectsList");
    list.innerHTML = "";
    if(!defaultProjects.length){
      list.innerHTML = `<div class="empty-state"><strong>No projects yet</strong>Add entries to <code>defaultProjects</code> in script.js.</div>`;
      return;
    }
    defaultProjects.forEach((p, i) => {
      const el = document.createElement("article");
      el.className = "record";
      const safeUrl = safeExternalUrl(p.url);
      const tags = Array.isArray(p.tags) ? p.tags : [];
      el.innerHTML = `
        <div class="record-id">PRJ-${String(i + 1).padStart(3, "0")}</div>
        <div class="record-body">
          <h3>${safeUrl ? `<a href="${escapeHtml(safeUrl)}" target="_blank" rel="noopener">${escapeHtml(p.title)}</a>` : escapeHtml(p.title)}</h3>
          <p class="record-desc">${escapeHtml(p.description || "No description provided.")}</p>
          <div class="tag-row">
            ${tags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join("")}
            ${p.status ? `<span class="tag ${p.status === "active" ? "status-active" : ""}">${escapeHtml(String(p.status).toUpperCase())}</span>` : ""}
          </div>
        </div>`;
      list.appendChild(el);
      requestAnimationFrame(() => observeReveal(el));
    });
  }

  /* ============================================================
     CERTIFICATES — static list, edited in code (see defaultCertificates)
  ============================================================ */
  function renderCertificates(){
    const list = document.getElementById("certificatesList");
    list.innerHTML = "";
    if(!defaultCertificates.length){
      list.innerHTML = `<div class="empty-state"><strong>No certificates yet</strong>Add entries to <code>defaultCertificates</code> in script.js.</div>`;
      return;
    }
    defaultCertificates.forEach((c, i) => {
      const el = document.createElement("article");
      el.className = "record cert-record";
      const safeUrl = safeExternalUrl(c.credentialUrl);
      el.innerHTML = `
        <div class="record-id">CRT-${String(i + 1).padStart(3, "0")}</div>
        <div class="record-body">
          <h3>${escapeHtml(c.title)}</h3>
          <p class="record-desc">${escapeHtml(c.issuer)}${c.date ? " — " + formatDate(c.date) : ""}</p>
          <div class="tag-row">
            ${safeUrl ? `<a href="${escapeHtml(safeUrl)}" target="_blank" rel="noopener" class="tag" style="text-decoration:none;">View credential ↗</a>` : ""}
          </div>
        </div>
        ${c.image ? `<img class="cert-thumb" src="${escapeHtml(c.image)}" alt="${escapeHtml(c.title)} certificate image" data-full="${escapeHtml(c.image)}">` : svgSeal()}
      `;
      list.appendChild(el);
      requestAnimationFrame(() => observeReveal(el));
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

  /* Only allows http(s) URLs through - blocks javascript: URLs and
     attribute-breakout injection even though these values now come
     from code you control, not a public form (defense in depth). */
  function safeExternalUrl(url){
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
    renderProfile(defaultProfile);
    renderProjects();
    renderCertificates();
  })();

})();
