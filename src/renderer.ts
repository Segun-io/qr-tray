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

type View = "scan" | "list" | "form";
type CodeType = "PPL" | "LOC" | "DOCK" | "RAW";

const TYPE_LABEL: Record<CodeType, string> = {
  PPL: "PPL · Package",
  LOC: "LOC · Location",
  DOCK: "DOCK · Warehouse",
  RAW: "Raw value",
};
const TYPE_COLOR: Record<CodeType, string> = {
  PPL: "#635bff",
  LOC: "#0f9d58",
  DOCK: "#e8833a",
  RAW: "#6b7280",
};

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
  if (next === "scan") {
    renderQr();
  } else if (next === "list") {
    renderSavedList();
  }
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
  els.scanTitle.textContent = hasText ? TYPE_LABEL[detectType(text)] : "Scan to encode";
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

function renderRecentsChips(): void {
  els.recents.querySelectorAll(".chip").forEach((el) => el.remove());
  els.recentsEmpty.hidden = recents.length > 0;
  for (const value of recents) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip";

    const dot = document.createElement("span");
    dot.className = "chip-dot";
    dot.style.background = TYPE_COLOR[detectType(value)];

    const label = document.createElement("span");
    label.className = "chip-value";
    label.textContent = truncateChip(value);

    chip.appendChild(dot);
    chip.appendChild(label);
    chip.addEventListener("click", () => {
      text = value;
      els.scanInput.value = value;
      updateScanUI();
    });
    els.recents.appendChild(chip);
  }
}

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
  const original = "Copiar";
  els.btnCopy.textContent = "✓ Copiado";
  if (copyResetTimer) clearTimeout(copyResetTimer);
  copyResetTimer = setTimeout(() => {
    els.btnCopy.textContent = original;
  }, 1200);
});

els.btnSave.addEventListener("click", () => {
  if (!text) return;
  openForm(text);
});

els.btnMyCodes.addEventListener("click", () => setView("list"));

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

renderSavedCount();
renderRecentsChips();
updateScanUI();
setView("scan");
