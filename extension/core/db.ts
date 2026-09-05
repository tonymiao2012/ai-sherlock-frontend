// IndexedDB 极简 Promise 封装：background 写入问题包，报告页读取；
// 另存侧边栏未提交草稿
import type { IssuePackage, SidebarDraft } from './types';

const DB_NAME = 'ai-sherlock';
const STORE = 'reports';
export const REPORT_KEY = 'latest-report';
export const DRAFT_KEY = 'sidebar-draft';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveReport(pkg: IssuePackage): Promise<void> {
  return putValue(REPORT_KEY, pkg);
}

export async function loadReport(): Promise<IssuePackage | null> {
  return getValue<IssuePackage>(REPORT_KEY);
}

/** 侧边栏草稿：未提交的标题/描述/截图/录制片段 */
export async function saveDraft(draft: SidebarDraft): Promise<void> {
  return putValue(DRAFT_KEY, draft);
}

export async function loadDraft(): Promise<SidebarDraft | null> {
  return getValue<SidebarDraft>(DRAFT_KEY);
}

export async function clearDraft(): Promise<void> {
  return deleteValue(DRAFT_KEY);
}

function putValue<T>(key: string, value: T): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(value, key);
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => {
          db.close();
          reject(tx.error);
        };
      })
  );
}

function getValue<T>(key: string): Promise<T | null> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readonly');
        const req = tx.objectStore(STORE).get(key);
        req.onsuccess = () => {
          db.close();
          resolve((req.result as T) ?? null);
        };
        req.onerror = () => {
          db.close();
          reject(req.error);
        };
      })
  );
}

function deleteValue(key: string): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise((resolve) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).delete(key);
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => {
          db.close();
          resolve();
        };
      })
  );
}
