declare function qrcode(
  typeNumber: number,
  errorCorrectionLevel: "L" | "M" | "Q" | "H"
): {
  addData(data: string): void;
  make(): void;
  getModuleCount(): number;
  createSvgTag(opts: { cellSize: number; margin: number }): string;
};

interface SavedCode {
  id: string;
  name: string;
  value: string;
}

type View = "scan" | "list" | "form" | "settings";
type CodeType = "PPL" | "LOC" | "DOCK" | "RAW";
type Lang = "es" | "en";
type Theme = "light" | "dark";

const TYPE_COLOR: Record<CodeType, string> = {
  PPL: "#635bff",
  LOC: "#0f9d58",
  DOCK: "#e8833a",
  RAW: "#6b7280",
};

const TYPE_LABEL_KEY: Record<CodeType, string> = {
  PPL: "typePpl",
  LOC: "typeLoc",
  DOCK: "typeDock",
  RAW: "typeRaw",
};

const translations: Record<Lang, Record<string, string>> = {
  es: {
    myCodes: "Mis códigos",
    exit: "Salir",
    newCode: "+ Nuevo",
    scanPlaceholder: "pega o escribí para codificar…",
    scanTitleDefault: "Escaneá para codificar",
    awaitingInput: "esperando input",
    typeOrPaste: "escribí o pegá",
    noRecents: "sin escaneos recientes",
    copy: "Copiar",
    copied: "✓ Copiado",
    save: "Guardar",
    savedListEmpty: "Sin códigos guardados.",
    tap: "Toca",
    savedListEmptyTail: "para agregar uno.",
    formTitleNew: "Nuevo código",
    formName: "Nombre (opcional)",
    formNamePlaceholder: "Ej: Pedido #4521",
    formValue: "Texto o ID a convertir",
    formValuePlaceholder: "PPL-4471-A22",
    cancel: "Cancelar",
    settingsTitle: "Configuración",
    languageLabel: "Idioma",
    themeLabel: "Tema",
    themeLight: "Claro",
    themeDark: "Oscuro",
    clearAllLabel: "Limpiar todo",
    clearAllDesc: "Borra todos los códigos guardados y el historial reciente.",
    clearAllConfirm:
      "¿Seguro que querés borrar todos los códigos guardados y el historial? Esta acción no se puede deshacer.",
    typePpl: "PPL · Paquete",
    typeLoc: "LOC · Ubicación",
    typeDock: "DOCK · Depósito",
    typeRaw: "Valor crudo",
  },
  en: {
    myCodes: "My codes",
    exit: "Exit",
    newCode: "+ New",
    scanPlaceholder: "paste or type to encode…",
    scanTitleDefault: "Scan to encode",
    awaitingInput: "awaiting input",
    typeOrPaste: "type or paste",
    noRecents: "no recent scans yet",
    copy: "Copy",
    copied: "✓ Copied",
    save: "Save",
    savedListEmpty: "No saved codes.",
    tap: "Tap",
    savedListEmptyTail: "to add one.",
    formTitleNew: "New code",
    formName: "Name (optional)",
    formNamePlaceholder: "E.g: Order #4521",
    formValue: "Text or ID to encode",
    formValuePlaceholder: "PPL-4471-A22",
    cancel: "Cancel",
    settingsTitle: "Settings",
    languageLabel: "Language",
    themeLabel: "Theme",
    themeLight: "Light",
    themeDark: "Dark",
    clearAllLabel: "Clear all",
    clearAllDesc: "Deletes all saved codes and the recent history.",
    clearAllConfirm:
      "Are you sure you want to delete all saved codes and the history? This cannot be undone.",
    typePpl: "PPL · Package",
    typeLoc: "LOC · Location",
    typeDock: "DOCK · Warehouse",
    typeRaw: "Raw value",
  },
};

const LANG_KEY = "qrtray.lang";
const THEME_KEY = "qrtray.theme";

function loadLang(): Lang {
  const raw = localStorage.getItem(LANG_KEY);
  return raw === "en" ? "en" : "es";
}

function loadTheme(): Theme {
  const raw = localStorage.getItem(THEME_KEY);
  if (raw === "light" || raw === "dark") return raw;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

let lang: Lang = loadLang();
let theme: Theme = loadTheme();

function t(key: string): string {
  return translations[lang][key] ?? key;
}

function detectType(raw: string): CodeType {
  const t = raw.trim().toUpperCase();
  if (t.startsWith("PPL")) return "PPL";
  if (t.startsWith("LOC")) return "LOC";
  if (
    t.startsWith("DOCK") ||
    t.startsWith("WHDOCK") ||
    t.startsWith("WAREHOUSE") ||
    t.startsWith("WH-")
  ) {
    return "DOCK";
  }
  return "RAW";
}

const RECENTS_KEY = "qrtray.recents";
const SAVED_KEY = "qrtray.saved";

function loadRecents(): string[] {
  try {
    const raw = localStorage.getItem(RECENTS_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function loadSaved(): SavedCode[] {
  try {
    const raw = localStorage.getItem(SAVED_KEY);
    return raw ? (JSON.parse(raw) as SavedCode[]) : [];
  } catch {
    return [];
  }
}

let recents: string[] = loadRecents();
let saved: SavedCode[] = loadSaved();
let text = "";
let view: View = "scan";
let recentsTimer: ReturnType<typeof setTimeout> | null = null;
let copyResetTimer: ReturnType<typeof setTimeout> | null = null;

const els = {
  viewScan: document.getElementById("view-scan") as HTMLElement,
  viewList: document.getElementById("view-list") as HTMLElement,
  viewForm: document.getElementById("view-form") as HTMLElement,

  btnMyCodes: document.getElementById("btn-my-codes") as HTMLButtonElement,
  savedCount: document.getElementById("saved-count") as HTMLSpanElement,

  scanInput: document.getElementById("scan-input") as HTMLTextAreaElement,
  btnClear: document.getElementById("btn-clear") as HTMLButtonElement,

  qrEmpty: document.getElementById("qr-empty") as HTMLElement,
  qrSvgWrap: document.getElementById("qr-svg-wrap") as HTMLElement,
  scanTitle: document.getElementById("scan-title") as HTMLElement,

  btnCopy: document.getElementById("btn-copy") as HTMLButtonElement,
  btnSave: document.getElementById("btn-save") as HTMLButtonElement,

  recents: document.getElementById("recents") as HTMLElement,
  recentsEmpty: document.getElementById("recents-empty") as HTMLElement,

  btnExitList: document.getElementById("btn-exit-list") as HTMLButtonElement,
  btnNew: document.getElementById("btn-new") as HTMLButtonElement,
  savedList: document.getElementById("saved-list") as HTMLUListElement,
  listEmpty: document.getElementById("list-empty") as HTMLElement,

  formName: document.getElementById("form-name") as HTMLInputElement,
  formValue: document.getElementById("form-value") as HTMLTextAreaElement,
  btnFormCancel: document.getElementById("btn-form-cancel") as HTMLButtonElement,
  btnFormSave: document.getElementById("btn-form-save") as HTMLButtonElement,

  viewSettings: document.getElementById("view-settings") as HTMLElement,
  btnSettings: document.getElementById("btn-settings") as HTMLButtonElement,
  btnExitSettings: document.getElementById("btn-exit-settings") as HTMLButtonElement,
  btnLangEs: document.getElementById("btn-lang-es") as HTMLButtonElement,
  btnLangEn: document.getElementById("btn-lang-en") as HTMLButtonElement,
  btnThemeLight: document.getElementById("btn-theme-light") as HTMLButtonElement,
  btnThemeDark: document.getElementById("btn-theme-dark") as HTMLButtonElement,
  btnClearAll: document.getElementById("btn-clear-all") as HTMLButtonElement,
};

function persistRecents(): void {
  localStorage.setItem(RECENTS_KEY, JSON.stringify(recents));
}
function persistSaved(): void {
  localStorage.setItem(SAVED_KEY, JSON.stringify(saved));
}

function setView(next: View): void {
  view = next;
  els.viewScan.hidden = next !== "scan";
  els.viewList.hidden = next !== "list";
  els.viewForm.hidden = next !== "form";
  els.viewSettings.hidden = next !== "settings";
  if (next === "scan") {
    renderQr();
  } else if (next === "list") {
    renderSavedList();
  }
}

function applyTranslations(): void {
  document.documentElement.lang = lang;
  document.querySelectorAll<HTMLElement>("[data-i18n]").forEach((el) => {
    const key = el.dataset.i18n;
    if (key) el.textContent = t(key);
  });
  document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("[data-i18n-placeholder]").forEach((el) => {
    const key = el.dataset.i18nPlaceholder;
    if (key) el.placeholder = t(key);
  });
  document.querySelectorAll<HTMLElement>("[data-i18n-aria-label]").forEach((el) => {
    const key = el.dataset.i18nAriaLabel;
    if (key) el.setAttribute("aria-label", t(key));
  });
  els.btnLangEs.classList.toggle("active", lang === "es");
  els.btnLangEn.classList.toggle("active", lang === "en");
}

function setLang(next: Lang): void {
  if (lang === next) return;
  lang = next;
  localStorage.setItem(LANG_KEY, lang);
  applyTranslations();
  updateScanUI();
}

function applyTheme(): void {
  document.documentElement.dataset.theme = theme;
  els.btnThemeLight.classList.toggle("active", theme === "light");
  els.btnThemeDark.classList.toggle("active", theme === "dark");
}

function setTheme(next: Theme): void {
  if (theme === next) return;
  theme = next;
  localStorage.setItem(THEME_KEY, theme);
  applyTheme();
}

function renderQr(): void {
  if (view !== "scan") return;
  if (!text) {
    els.qrEmpty.hidden = false;
    els.qrSvgWrap.hidden = true;
    els.qrSvgWrap.innerHTML = "";
    return;
  }
  const qr = qrcode(0, "M");
  qr.addData(text);
  qr.make();
  const count = qr.getModuleCount();
  const cellSize = Math.max(2, Math.floor(186 / (count + 2)));
  const svg = qr.createSvgTag({ cellSize, margin: cellSize });
  els.qrSvgWrap.innerHTML = svg;
  els.qrSvgWrap.hidden = false;
  els.qrEmpty.hidden = true;
}

function updateScanUI(): void {
  const hasText = text.length > 0;
  els.scanInput.classList.toggle("has-text", hasText);
  els.btnClear.hidden = !hasText;
  els.btnCopy.disabled = !hasText;
  els.btnSave.disabled = !hasText;
  els.scanTitle.textContent = hasText ? t(TYPE_LABEL_KEY[detectType(text)]) : t("scanTitleDefault");
  renderQr();
}

function clearScanInput(): void {
  text = "";
  els.scanInput.value = "";
  updateScanUI();
}

function truncateChip(value: string): string {
  return value.length > 15 ? value.slice(0, 15) + "…" : value;
}

function deleteRecent(value: string): void {
  recents = recents.filter((v) => v !== value);
  persistRecents();
  renderRecentsChips();
}

function renderRecentsChips(): void {
  els.recents.querySelectorAll(".chip").forEach((el) => el.remove());
  els.recentsEmpty.hidden = recents.length > 0;
  for (const value of recents) {
    const chip = document.createElement("div");
    chip.className = "chip";
    chip.setAttribute("role", "button");
    chip.tabIndex = 0;

    const dot = document.createElement("span");
    dot.className = "chip-dot";
    dot.style.background = TYPE_COLOR[detectType(value)];

    const label = document.createElement("span");
    label.className = "chip-value";
    label.textContent = truncateChip(value);

    const del = document.createElement("button");
    del.type = "button";
    del.className = "chip-delete";
    del.textContent = "✕";
    del.addEventListener("click", (event) => {
      event.stopPropagation();
      deleteRecent(value);
    });

    const activate = (): void => {
      if (recentsDragMoved) return;
      text = value;
      els.scanInput.value = value;
      updateScanUI();
    };
    chip.addEventListener("click", activate);
    chip.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        activate();
      }
    });

    chip.appendChild(dot);
    chip.appendChild(label);
    chip.appendChild(del);
    els.recents.appendChild(chip);
  }
}

let recentsDrag: { pointerId: number; startX: number; startScrollLeft: number } | null = null;
let recentsDragMoved = false;

els.recents.addEventListener("pointerdown", (event) => {
  if (event.button !== 0) return;
  recentsDrag = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startScrollLeft: els.recents.scrollLeft,
  };
  recentsDragMoved = false;
});

els.recents.addEventListener("pointermove", (event) => {
  if (!recentsDrag) return;
  const dx = event.clientX - recentsDrag.startX;
  if (!recentsDragMoved && Math.abs(dx) > 4) {
    recentsDragMoved = true;
    els.recents.setPointerCapture(recentsDrag.pointerId);
    els.recents.classList.add("dragging");
  }
  if (recentsDragMoved) {
    els.recents.scrollLeft = recentsDrag.startScrollLeft - dx;
  }
});

function endRecentsDrag(): void {
  recentsDrag = null;
  els.recents.classList.remove("dragging");
}
els.recents.addEventListener("pointerup", endRecentsDrag);
els.recents.addEventListener("pointercancel", endRecentsDrag);

function scheduleRecent(value: string): void {
  if (recentsTimer) clearTimeout(recentsTimer);
  recentsTimer = setTimeout(() => {
    const trimmed = value.trim();
    if (trimmed.length < 3) return;
    recents = [trimmed, ...recents.filter((v) => v !== trimmed)].slice(0, 8);
    persistRecents();
    renderRecentsChips();
  }, 900);
}

function renderSavedCount(): void {
  els.savedCount.textContent = String(saved.length);
}

function renderSavedList(): void {
  els.savedList.innerHTML = "";
  els.listEmpty.hidden = saved.length > 0;
  for (const item of saved) {
    const li = document.createElement("li");
    li.className = "saved-row";

    const main = document.createElement("div");
    main.className = "saved-row-main";
    if (item.name) {
      const name = document.createElement("div");
      name.className = "saved-row-name";
      name.textContent = item.name;
      const value = document.createElement("div");
      value.className = "saved-row-value";
      value.textContent = item.value;
      main.appendChild(name);
      main.appendChild(value);
    } else {
      const value = document.createElement("div");
      value.className = "saved-row-value-only";
      value.textContent = item.value;
      main.appendChild(value);
    }
    main.addEventListener("click", () => {
      text = item.value;
      els.scanInput.value = item.value;
      setView("scan");
      updateScanUI();
    });

    const trash = document.createElement("button");
    trash.type = "button";
    trash.className = "saved-row-trash";
    trash.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>' +
      '<path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>' +
      '<line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>';
    trash.addEventListener("click", (event) => {
      event.stopPropagation();
      saved = saved.filter((s) => s.id !== item.id);
      persistSaved();
      renderSavedCount();
      renderSavedList();
    });

    li.appendChild(main);
    li.appendChild(trash);
    els.savedList.appendChild(li);
  }
}

function updateFormSaveState(): void {
  const hasValue = els.formValue.value.trim().length > 0;
  els.formValue.classList.toggle("has-text", hasValue);
  els.btnFormSave.disabled = !hasValue;
}

function openForm(prefillValue: string): void {
  els.formName.value = "";
  els.formValue.value = prefillValue;
  updateFormSaveState();
  setView("form");
  els.formName.focus();
}

els.scanInput.addEventListener("input", () => {
  text = els.scanInput.value;
  updateScanUI();
  scheduleRecent(text);
});

els.scanInput.addEventListener("keydown", (event) => {
  if (event.key === "Escape") clearScanInput();
});

els.btnClear.addEventListener("click", () => clearScanInput());

els.btnCopy.addEventListener("click", async () => {
  if (!text) return;
  await navigator.clipboard.writeText(text);
  els.btnCopy.textContent = t("copied");
  if (copyResetTimer) clearTimeout(copyResetTimer);
  copyResetTimer = setTimeout(() => {
    els.btnCopy.textContent = t("copy");
  }, 1200);
});

els.btnSave.addEventListener("click", () => {
  if (!text) return;
  openForm(text);
});

els.btnMyCodes.addEventListener("click", () => setView("list"));
els.btnSettings.addEventListener("click", () => setView("settings"));

els.btnExitList.addEventListener("click", () => setView("scan"));
els.btnNew.addEventListener("click", () => openForm(""));

els.formValue.addEventListener("input", () => updateFormSaveState());

els.btnFormCancel.addEventListener("click", () => {
  setView(saved.length > 0 ? "list" : "scan");
});

els.btnFormSave.addEventListener("click", () => {
  const value = els.formValue.value.trim();
  if (!value) return;
  saved = [{ id: crypto.randomUUID(), name: els.formName.value.trim(), value }, ...saved];
  persistSaved();
  renderSavedCount();
  setView("list");
});

els.btnExitSettings.addEventListener("click", () => setView(saved.length > 0 ? "list" : "scan"));
els.btnLangEs.addEventListener("click", () => setLang("es"));
els.btnLangEn.addEventListener("click", () => setLang("en"));
els.btnThemeLight.addEventListener("click", () => setTheme("light"));
els.btnThemeDark.addEventListener("click", () => setTheme("dark"));

els.btnClearAll.addEventListener("click", () => {
  if (!confirm(t("clearAllConfirm"))) return;
  saved = [];
  recents = [];
  persistSaved();
  persistRecents();
  clearScanInput();
  renderSavedCount();
  renderRecentsChips();
  renderSavedList();
  setView("scan");
});

applyTranslations();
applyTheme();
renderSavedCount();
renderRecentsChips();
updateScanUI();
setView("scan");
