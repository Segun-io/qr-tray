import { app } from "electron";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import type { QrRecord } from "./types";

const storePath = path.join(app.getPath("userData"), "qrcodes.json");

function readAll(): QrRecord[] {
  try {
    const raw = fs.readFileSync(storePath, "utf-8");
    return JSON.parse(raw) as QrRecord[];
  } catch {
    return [];
  }
}

function writeAll(records: QrRecord[]): void {
  fs.writeFileSync(storePath, JSON.stringify(records, null, 2), "utf-8");
}

export function listCodes(): QrRecord[] {
  return readAll().sort((a, b) => b.createdAt - a.createdAt);
}

export function addCode(label: string, text: string): QrRecord {
  const record: QrRecord = {
    id: randomUUID(),
    label: label.trim() || text.trim(),
    text: text.trim(),
    createdAt: Date.now(),
  };
  const records = readAll();
  records.push(record);
  writeAll(records);
  return record;
}

export function deleteCode(id: string): void {
  writeAll(readAll().filter((r) => r.id !== id));
}
