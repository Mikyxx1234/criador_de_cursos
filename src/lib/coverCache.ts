/**
 * Cache local de capas de curso usando IndexedDB.
 *
 * Por que existe: o backend Laravel está aceitando uploads mas não consegue
 * servir os arquivos de `/storage/...` (provavelmente falta `php artisan
 * storage:link` no container, ou o disco public está mal configurado). Até que
 * isso seja corrigido no servidor, persistimos a capa no navegador do
 * administrador para que ele veja a imagem que acabou de subir.
 *
 * Quando o backend voltar a funcionar, o componente continua usando a URL real
 * (a chamada local é só um fallback que sobrepõe quando há blob salvo).
 */
import { useEffect, useState } from "react";

const DB_NAME = "curso-platform-admin";
const DB_VERSION = 2;
const STORE = "course-covers";
const URL_STORE = "course-cover-urls";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB não disponível"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
      if (!db.objectStoreNames.contains(URL_STORE)) {
        db.createObjectStore(URL_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
  storeName: string = STORE
): Promise<T> {
  const db = await openDb();
  const transaction = db.transaction(storeName, mode);
  const store = transaction.objectStore(storeName);
  return reqToPromise(fn(store));
}

const urlCache = new Map<number, string>();
const subscribers = new Set<() => void>();

function notify() {
  subscribers.forEach((cb) => cb());
}

function blobToObjectUrl(courseId: number, blob: Blob): string {
  const existing = urlCache.get(courseId);
  if (existing) {
    URL.revokeObjectURL(existing);
  }
  const url = URL.createObjectURL(blob);
  urlCache.set(courseId, url);
  return url;
}

/**
 * Salva o arquivo de capa de um curso no IndexedDB e retorna uma `blob:` URL
 * pronta para uso em `<img src>`.
 */
export async function saveCoverFromFile(
  courseId: number,
  file: File
): Promise<string> {
  const blob = file.slice(0, file.size, file.type || "image/jpeg");
  await withStore("readwrite", (store) => store.put(blob, courseId));
  const url = blobToObjectUrl(courseId, blob);
  notify();
  return url;
}

/**
 * Busca uma capa em cache para o curso. Devolve `null` se não houver.
 * Reaproveita a `blob:` URL entre chamadas.
 */
export async function getCoverBlobUrl(
  courseId: number
): Promise<string | null> {
  const cached = urlCache.get(courseId);
  if (cached) return cached;
  try {
    const blob = await withStore<Blob | undefined>("readonly", (store) =>
      store.get(courseId)
    );
    if (!blob) return null;
    return blobToObjectUrl(courseId, blob);
  } catch {
    return null;
  }
}

/**
 * Remove a capa em cache (caso o usuário queira voltar à imagem do servidor).
 */
export async function removeCover(courseId: number): Promise<void> {
  const existing = urlCache.get(courseId);
  if (existing) {
    URL.revokeObjectURL(existing);
    urlCache.delete(courseId);
  }
  await withStore("readwrite", (store) => store.delete(courseId));
  await withStore("readwrite", (store) => store.delete(courseId), URL_STORE);
  notify();
}

/**
 * Salva uma URL pública (ex.: do Supabase Storage) como capa do curso. É
 * usada quando o backend Laravel pode não conhecer o campo de URL externa,
 * mas queremos que o admin renderize a versão correta na próxima visita.
 */
export async function saveCoverUrl(
  courseId: number,
  url: string
): Promise<void> {
  await withStore("readwrite", (store) => store.put(url, courseId), URL_STORE);
  notify();
}

/**
 * Recupera a URL pública (Supabase) salva localmente para a capa, se houver.
 */
export async function getCoverPublicUrl(
  courseId: number
): Promise<string | null> {
  try {
    const url = await withStore<string | undefined>(
      "readonly",
      (store) => store.get(courseId),
      URL_STORE
    );
    return typeof url === "string" && url.length > 0 ? url : null;
  } catch {
    return null;
  }
}

/**
 * Hook React: retorna a melhor capa local conhecida do curso. Preferência:
 *   1) URL pública persistida (Supabase) — funciona em qualquer aba/cliente
 *      que tenha o cache do IndexedDB
 *   2) `blob:` URL gerada a partir do arquivo enviado nesta sessão
 *   3) `null` se nada for encontrado
 */
export function useCachedCoverUrl(
  courseId: number | null | undefined
): string | null {
  const [url, setUrl] = useState<string | null>(() =>
    typeof courseId === "number" ? urlCache.get(courseId) ?? null : null
  );

  useEffect(() => {
    if (typeof courseId !== "number") {
      setUrl(null);
      return;
    }

    let cancelled = false;
    const refresh = async () => {
      const publicUrl = await getCoverPublicUrl(courseId);
      if (!cancelled && publicUrl) {
        setUrl(publicUrl);
        return;
      }
      const blobUrl = await getCoverBlobUrl(courseId);
      if (!cancelled) setUrl(blobUrl);
    };

    refresh();
    subscribers.add(refresh);
    return () => {
      cancelled = true;
      subscribers.delete(refresh);
    };
  }, [courseId]);

  return url;
}
