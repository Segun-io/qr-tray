interface QrRecord {
  id: string;
  label: string;
  text: string;
  createdAt: number;
}

interface Window {
  api: {
    listCodes(): Promise<QrRecord[]>;
    addCode(label: string, text: string): Promise<QrRecord>;
    deleteCode(id: string): Promise<void>;
    generateQr(text: string): Promise<string>;
  };
}

const listEl = document.getElementById("list") as HTMLUListElement;
const emptyStateEl = document.getElementById("empty-state") as HTMLDivElement;
const listHeaderEl = document.getElementById("list-header") as HTMLElement;
const formEl = document.getElementById("form-new") as HTMLFormElement;
const detailEl = document.getElementById("detail") as HTMLDivElement;
const inputLabelEl = document.getElementById("input-label") as HTMLInputElement;
const inputTextEl = document.getElementById("input-text") as HTMLTextAreaElement;
const detailLabelEl = document.getElementById("detail-label") as HTMLHeadingElement;
const detailQrEl = document.getElementById("detail-qr") as HTMLImageElement;
const detailTextEl = document.getElementById("detail-text") as HTMLElement;

let currentRecord: QrRecord | null = null;

function showView(view: "list" | "form" | "detail"): void {
  listHeaderEl.hidden = view !== "list";
  listEl.hidden = view !== "list";
  formEl.hidden = view !== "form";
  detailEl.hidden = view !== "detail";
  emptyStateEl.hidden = !(view === "list" && listEl.children.length === 0);
}

async function refreshList(): Promise<void> {
  const records = await window.api.listCodes();
  listEl.innerHTML = "";
  for (const record of records) {
    const li = document.createElement("li");
    li.className = "row";

    const label = document.createElement("span");
    label.className = "row-label";
    label.textContent = record.label;
    label.addEventListener("click", () => openDetail(record));

    const del = document.createElement("button");
    del.className = "row-delete";
    del.type = "button";
    del.textContent = "🗑";
    del.title = "Eliminar";
    del.addEventListener("click", async (event) => {
      event.stopPropagation();
      await window.api.deleteCode(record.id);
      await refreshList();
      showView("list");
    });

    li.appendChild(label);
    li.appendChild(del);
    listEl.appendChild(li);
  }
}

async function openDetail(record: QrRecord): Promise<void> {
  currentRecord = record;
  detailLabelEl.textContent = record.label;
  detailTextEl.textContent = record.text;
  detailQrEl.src = await window.api.generateQr(record.text);
  showView("detail");
}

document.getElementById("btn-new")!.addEventListener("click", () => {
  inputLabelEl.value = "";
  inputTextEl.value = "";
  showView("form");
  inputTextEl.focus();
});

document.getElementById("btn-cancel")!.addEventListener("click", () => {
  showView("list");
});

document.getElementById("btn-back")!.addEventListener("click", () => {
  currentRecord = null;
  showView("list");
});

document.getElementById("btn-delete")!.addEventListener("click", async () => {
  if (!currentRecord) return;
  await window.api.deleteCode(currentRecord.id);
  currentRecord = null;
  await refreshList();
  showView("list");
});

formEl.addEventListener("submit", async (event) => {
  event.preventDefault();
  const text = inputTextEl.value.trim();
  if (!text) return;
  const record = await window.api.addCode(inputLabelEl.value, text);
  await refreshList();
  await openDetail(record);
});

refreshList().then(() => showView("list"));
