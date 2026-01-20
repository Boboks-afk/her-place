// ================================
// API konfiguracija
// ================================
const API_BASE_URL = "http://192.168.8.131:3000"; // Backend IP un ports (LAN)

// ================================
// Elementi no HTML
// ================================
const form = document.getElementById("reservationForm");
const statusEl = document.getElementById("formStatus");

const menuBtn = document.getElementById("menuBtn");
const mobileMenu = document.getElementById("mobileMenu");
const closeMenuBtn = document.getElementById("closeMenuBtn");

// ================================
// Izvelne (atvert/aizvert)
// ================================
function openMenu() {
  if (!mobileMenu) return;
  mobileMenu.classList.add("open");
  mobileMenu.setAttribute("aria-hidden", "false");
}

function closeMenu() {
  if (!mobileMenu) return;
  mobileMenu.classList.remove("open");
  mobileMenu.setAttribute("aria-hidden", "true");
}

menuBtn?.addEventListener("click", openMenu);
closeMenuBtn?.addEventListener("click", closeMenu);

// Klikskis uz overlay (tumsais fons) aizver izvelni
mobileMenu?.addEventListener("click", (e) => {
  if (e.target === mobileMenu) closeMenu();
});

// Aizvert ar ESC
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeMenu();
});

// ================================
// Navigacija: aizver izvelni + pareizs scroll / pariesana
// ================================
document.querySelectorAll("#mobileMenu a").forEach((link) => {
  link.addEventListener("click", (e) => {
    closeMenu();

    const href = link.getAttribute("href") || "";
    const isRulesPage = window.location.pathname.toLowerCase().includes("noteikumi.html");

    // Ja esam noteikumu lapa un links ir #..., tad ved uz index.html#...
    if (isRulesPage && href.startsWith("#")) {
      e.preventDefault();
      window.location.href = `index.html${href}`;
      return;
    }

    // Ja links ir #... un sadaļa eksiste, uztaisam smooth scroll
    if (href.startsWith("#")) {
      const target = document.querySelector(href);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: "smooth", block: "start" });
			history.pushState(null, "", href);
// offset tagad taisa CSS (scroll-padding-top / scroll-margin-top)

      }
      return;
    }
  });
});

// ================================
// Status teksts formai
// ================================
function setStatus(msg, type = "info") {
  if (!statusEl) return;
  statusEl.textContent = msg;
  statusEl.style.color =
    type === "error" ? "crimson" :
    type === "success" ? "green" :
    "";
}

// ================================
// Datuma minimums (neļauj pagatni)
// ================================
function setMinDateToday() {
  const dateInput = document.getElementById("date");
  if (!dateInput) return;

  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");

  dateInput.min = `${yyyy}-${mm}-${dd}`;
}
setMinDateToday();

// ================================
// Laiku saraksts: fallback (ja backend nav)
// ================================
const FALLBACK_TIMES = ["09:00", "13:00"];

// Ieliek selecta laiku sarakstu
function fillTimeSelect(times) {
  const timeEl = document.getElementById("time");
  if (!timeEl) return;

  timeEl.innerHTML = `<option value="">Izvelies laiku</option>`;

  if (!times || times.length === 0) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "Sodien nav pieejamu laiku";
    timeEl.appendChild(opt);
    timeEl.value = "";
    return;
  }

  times.forEach((t) => {
    const opt = document.createElement("option");
    opt.value = t;
    opt.textContent = t;
    timeEl.appendChild(opt);
  });
}

// ================================
// UI ierobezojums: Svetdiena nav pieejama
// ================================
document.getElementById("date")?.addEventListener("change", (e) => {
  const dateStr = e.target.value;
  if (!dateStr) return;

  const d = new Date(dateStr + "T00:00:00");
  const day = d.getDay(); // 0=svetdiena

  if (day === 0) {
    e.target.value = "";
    fillTimeSelect([]); // notira laikus
    setStatus("Svetdiena nav pieejama. Izvelies citu dienu.", "error");
  } else {
    setStatus("");
  }
});

// ================================
// Ielade pieejamos laikus no backend
// GET /api/slots?date=YYYY-MM-DD
// ================================
async function refreshSlotsForDate() {
  const dateEl = document.getElementById("date");
  if (!dateEl) return;

  const date = dateEl.value;
  if (!date) {
    fillTimeSelect([]); // ja nav datuma, neradam laikus
    return;
  }

  try {
    const res = await fetch(`${API_BASE_URL}/api/slots?date=${encodeURIComponent(date)}`);
    const data = await res.json().catch(() => ({}));

    // Ja /api/slots nav vai ir kluda, izmanto fallback
    if (!res.ok || !data || !Array.isArray(data.available_times)) {
      fillTimeSelect(FALLBACK_TIMES);
      return;
    }

    // Ja viss ok, ieliekam pieejamos laikus
    fillTimeSelect(data.available_times);
  } catch (err) {
    // Ja backend nav sasniedzams, izmanto fallback
    fillTimeSelect(FALLBACK_TIMES);
  }
}

// Kad maina datumu -> ielade laikus
document.getElementById("date")?.addEventListener("change", refreshSlotsForDate);

// ================================
// Formas nosutisana
// ================================
form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  setStatus("Nosuta...");

  const full_name = document.getElementById("full_name")?.value.trim();
  const email = document.getElementById("email")?.value.trim();
  const phone = document.getElementById("phone")?.value.trim();
  const date = document.getElementById("date")?.value;
  const time = document.getElementById("time")?.value;
  const notes = document.getElementById("notes")?.value.trim();
  const rules_ok = document.getElementById("rules_ok")?.checked;

  if (!rules_ok) {
    setStatus("Ludzu apstiprini, ka esi iepazinusies ar noteikumiem.", "error");
    return;
  }

  if (!date || !time) {
    setStatus("Ludzu izvelies datumu un laiku.", "error");
    return;
  }

  try {
    const res = await fetch(`${API_BASE_URL}/api/reservations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ full_name, email, phone, date, time, notes }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      setStatus(data?.error || "Kluda nosutot pierakstu.", "error");
      return;
    }

    setStatus("Pieraksts nosutits!", "success");
    form.reset();
    setMinDateToday();

    // pec veiksmiga pieraksta ielade laikus velreiz (lai aiznemtais pazud)
    refreshSlotsForDate();
  } catch (err) {
    setStatus("Neizdevas pieslegties serverim. Parbaudi vai backend darbojas.", "error");
  }
});
