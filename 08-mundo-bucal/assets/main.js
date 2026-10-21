/* Ajustes de la clínica: se definen en index.html (window.CLINIC_CONFIG). */
const CONFIG = Object.assign({
  id: "clinica",
  telefono: "",
  textoBoton: "Confirmar mi cita →",
  plazasLibres: 12,
  formEndpoint: "",
  exitPopup: true,
  horario: { 1: [["10:00", "14:00"], ["16:00", "20:00"]], 2: [["10:00", "14:00"], ["16:00", "20:00"]], 3: [["10:00", "14:00"], ["16:00", "20:00"]], 4: [["10:00", "14:00"], ["16:00", "20:00"]], 5: [["10:00", "14:00"]] },
  duracionCitaMin: 30,
  diasReserva: 15,
  antelacionMin: 120,
  festivos: ["2026-11-09", "2026-12-08", "2026-12-25", "2027-01-01", "2027-01-06"],
  ocupadas: {}
}, window.CLINIC_CONFIG || {});

(function () {
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];

  // Plazas y mes actual
  const mes = new Date().toLocaleDateString("es-ES", { month: "long" });
  $$("[data-mes]").forEach(el => (el.textContent = mes));
  $$("[data-plazas]").forEach(el => (el.textContent = CONFIG.plazasLibres));
  const y = $("#year"); if (y) y.textContent = new Date().getFullYear();

  // ===== Horario (texto en la web) =====
  const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  const cap = t => t.charAt(0).toUpperCase() + t.slice(1);
  const tramosTxt = d => (CONFIG.horario[d] || []).map(([a, b]) => `${a}–${b}`).join(" y ");
  const orden = [1, 2, 3, 4, 5, 6, 0];
  const grupos = [];
  orden.forEach(d => {
    const t = tramosTxt(d) || "Cerrado";
    const last = grupos[grupos.length - 1];
    if (last && last.t === t) last.dias.push(d); else grupos.push({ t, dias: [d] });
  });
  const nombreGrupo = g => g.dias.length > 1 ? `${cap(DIAS[g.dias[0]])} a ${DIAS[g.dias[g.dias.length - 1]]}` : cap(DIAS[g.dias[0]]);
  const hoyDia = new Date().getDay();
  const list = $("#hoursList");
  if (list) list.innerHTML = grupos.map(g =>
    `<li class="${g.dias.includes(hoyDia) ? "is-today" : ""}"><span>${nombreGrupo(g)}</span><span>${g.t}</span></li>`).join("");
  const abiertos = grupos.filter(g => g.t !== "Cerrado");
  const largo = abiertos.map(g => `${nombreGrupo(g).toLowerCase()}, ${g.t}`).join("; ");
  $$("[data-horario]").forEach(el => (el.textContent = largo));
  const todos = Object.values(CONFIG.horario).flat();
  if (todos.length) {
    const ini = todos.map(t => t[0]).sort()[0], fin = todos.map(t => t[1]).sort().pop();
    const corto = abiertos.length === 1 && abiertos[0].dias.length > 1
      ? `${cap(DIAS[abiertos[0].dias[0]]).slice(0, 3)}–${cap(DIAS[abiertos[0].dias.slice(-1)[0]]).slice(0, 3)} · ${ini}–${fin}`
      : `${ini}–${fin}`;
    $$("[data-horario-corto]").forEach(el => (el.textContent = corto));
  }

  // Navegación
  const nav = $("#nav");
  const burger = $(".nav__burger");
  addEventListener("scroll", () => nav.classList.toggle("is-scrolled", scrollY > 10), { passive: true });
  burger.addEventListener("click", () => {
    const open = nav.classList.toggle("is-open");
    burger.setAttribute("aria-expanded", open);
  });
  $$(".nav__links a").forEach(a => a.addEventListener("click", () => {
    nav.classList.remove("is-open"); burger.setAttribute("aria-expanded", "false");
  }));

  // Animación al hacer scroll
  const targets = $$(".section-head, .pain, .stack, .g-card, .tcard, .doc, .steps__list li, .calc, .review, .faq__list details, .form, .clinic__media");
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(entries => entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); }
    }), { threshold: 0.12 });
    targets.forEach(t => { t.classList.add("reveal"); io.observe(t); });
  }

  // Calculadora de financiación
  const amount = $("#amount"), amountOut = $("#amountOut"), fee = $("#fee");
  const eur = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".") + " €";
  function calc() {
    const months = +$("input[name=months]:checked").value;
    const a = +amount.value;
    amountOut.textContent = eur(a);
    fee.textContent = eur(Math.ceil(a / months));
  }
  if (amount) {
    amount.addEventListener("input", calc);
    $$("input[name=months]").forEach(r => r.addEventListener("change", calc));
    calc();
  }

  // Enlaces de tratamientos rellenan el motivo del formulario
  const motivo = $("#motivo");
  if (motivo) $$("[data-treat]").forEach(a => a.addEventListener("click", () => {
    const opt = [...motivo.options].find(o => o.text === a.dataset.treat);
    if (opt) motivo.value = opt.text;
  }));

  // ===== Reserva online: días y horas =====
  const pad = n => String(n).padStart(2, "0");
  const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const toMin = t => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
  const toTxt = m => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;

  function huecos(fecha) {
    const key = iso(fecha);
    if (CONFIG.festivos.includes(key)) return [];
    const ocupadas = CONFIG.ocupadas[key] || [];
    const limite = Date.now() + CONFIG.antelacionMin * 60000;
    const out = [];
    (CONFIG.horario[fecha.getDay()] || []).forEach(([a, b]) => {
      for (let m = toMin(a); m + CONFIG.duracionCitaMin <= toMin(b); m += CONFIG.duracionCitaMin) {
        const cuando = new Date(fecha); cuando.setHours(Math.floor(m / 60), m % 60, 0, 0);
        const hora = toTxt(m);
        out.push({ hora, libre: cuando.getTime() > limite && !ocupadas.includes(hora) });
      }
    });
    return out;
  }

  const daysEl = $("#bkDays"), slotsEl = $("#bkSlots");
  const diaIn = $("#bkDia"), horaIn = $("#bkHora");
  const summary = $("#bkSummary"), errorEl = $("#bkError");
  let selDia = null, selHora = null;

  const fechaLarga = d => cap(d.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" }));
  function actualizarResumen() {
    diaIn.value = selDia ? iso(selDia) : "";
    horaIn.value = selHora || "";
    if (selDia && selHora) {
      summary.textContent = `📅 ${fechaLarga(selDia)} a las ${selHora}`;
      summary.hidden = false; errorEl.hidden = true;
    } else summary.hidden = true;
  }

  function pintarHoras() {
    const lista = huecos(selDia);
    const partes = [["Mañana", lista.filter(h => toMin(h.hora) < 15 * 60)], ["Tarde", lista.filter(h => toMin(h.hora) >= 15 * 60)]];
    slotsEl.innerHTML = partes.filter(([, l]) => l.length).map(([n, l]) =>
      `<p class="bk-part">${n}</p><div class="bk-grid">${l.map(h =>
        `<button type="button" class="bk-slot" data-hora="${h.hora}" aria-pressed="false" ${h.libre ? "" : "disabled aria-label='" + h.hora + " no disponible'"}>${h.hora}</button>`).join("")}</div>`
    ).join("") || "<p>No hay horas libres este día.</p>";
  }

  if (daysEl) {
    const dias = [];
    const d = new Date(); d.setHours(0, 0, 0, 0);
    for (let i = 0; i < 90 && dias.length < CONFIG.diasReserva; i++) {
      if (huecos(d).some(h => h.libre)) dias.push(new Date(d));
      d.setDate(d.getDate() + 1);
    }
    daysEl.innerHTML = dias.map((f, i) =>
      `<button type="button" class="bk-day" data-i="${i}" aria-pressed="false" aria-label="${fechaLarga(f)}">
        <small>${f.toLocaleDateString("es-ES", { weekday: "short" }).replace(".", "")}</small>
        <b>${f.getDate()}</b>
        <small>${f.toLocaleDateString("es-ES", { month: "short" }).replace(".", "")}</small>
      </button>`).join("");

    function elegirDia(i) {
      selDia = dias[i]; selHora = null;
      $$(".bk-day", daysEl).forEach(b => b.setAttribute("aria-pressed", String(+b.dataset.i === i)));
      pintarHoras(); actualizarResumen();
    }
    daysEl.addEventListener("click", e => {
      const b = e.target.closest(".bk-day"); if (b) elegirDia(+b.dataset.i);
    });
    slotsEl.addEventListener("click", e => {
      const b = e.target.closest(".bk-slot"); if (!b || b.disabled) return;
      selHora = b.dataset.hora;
      $$(".bk-slot", slotsEl).forEach(s => s.setAttribute("aria-pressed", String(s === b)));
      actualizarResumen();
    });
    $$(".bk-arrow").forEach(a => a.addEventListener("click", () => {
      daysEl.scrollBy({ left: +a.dataset.dir * 216, behavior: "smooth" });
    }));
    if (dias.length) elegirDia(0);
    else slotsEl.innerHTML = `<p>Ahora mismo no hay huecos online. Llámanos al ${CONFIG.telefono}.</p>`;
  }

  // Formulario
  const form = $("#bookForm");
  form.addEventListener("submit", async e => {
    e.preventDefault();
    let ok = true;
    if (!selDia || !selHora) { errorEl.hidden = false; ok = false; }
    $$("input[required]", form).forEach(i => {
      const bad = i.type === "checkbox" ? !i.checked : !i.value.trim() || !i.checkValidity();
      (i.type === "checkbox" ? i.closest("label") : i).classList.toggle("is-invalid", bad);
      if (bad) ok = false;
    });
    if (!ok) {
      const first = !errorEl.hidden ? slotsEl : $(".is-invalid", form);
      first?.scrollIntoView?.({ behavior: "smooth", block: "center" });
      return;
    }

    const btn = $("button[type=submit]", form);
    btn.disabled = true; btn.textContent = "Enviando…";
    const data = Object.fromEntries(new FormData(form));
    try {
      if (CONFIG.formEndpoint) {
        const r = await fetch(CONFIG.formEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(data)
        });
        if (!r.ok) throw new Error("envío fallido");
      }
      $("#bkOkWhen").textContent = `${fechaLarga(selDia)} a las ${selHora}`;
      $(".form__fields", form).hidden = true;
      $(".form__ok", form).hidden = false;
      form.scrollIntoView({ behavior: "smooth", block: "center" });
      try { sessionStorage.setItem(CONFIG.id + "_booked", "1"); } catch (_) {}
    } catch (err) {
      btn.disabled = false; btn.textContent = CONFIG.textoBoton;
      alert(`No hemos podido enviar la reserva. Llámanos al ${CONFIG.telefono} y te damos cita al momento.`);
    }
  });

  // Ventana de salida (solo escritorio, una vez por sesión)
  const exit = $("#exit");
  const seen = () => { try { return sessionStorage.getItem(CONFIG.id + "_exit") || sessionStorage.getItem(CONFIG.id + "_booked"); } catch (_) { return true; } };
  const close = () => { exit.hidden = true; };
  if (CONFIG.exitPopup && matchMedia("(min-width: 1021px)").matches) {
    document.addEventListener("mouseout", e => {
      if (e.relatedTarget || e.clientY > 10 || seen() || scrollY < 600) return;
      exit.hidden = false;
      try { sessionStorage.setItem(CONFIG.id + "_exit", "1"); } catch (_) {}
    });
  }
  $(".exit__x").addEventListener("click", close);
  $(".exit__no").addEventListener("click", close);
  $(".exit__go").addEventListener("click", close);
  exit.addEventListener("click", e => { if (e.target === exit) close(); });
  addEventListener("keydown", e => { if (e.key === "Escape") close(); });
})();
