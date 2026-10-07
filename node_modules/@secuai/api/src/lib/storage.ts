import fs from 'fs';
import path from 'path';
import { SupabaseClient } from '@supabase/supabase-js';
import { memoryDb } from '../db/supabase.js';

// Extend memoryDb to hold storage objects in local memory mode
declare module '../db/supabase.js' {
  interface MemoryDbInterface {
    storage: Map<string, Buffer>;
  }
}

// Ensure memoryDb.storage exists
if (!(memoryDb as any).storage) {
  (memoryDb as any).storage = new Map<string, Buffer>();
}

export const LOCAL_STORAGE_BASE = path.resolve('temp', 'storage');

/**
 * Stores uploaded ZIP file to Supabase Storage bucket 'uploads'
 * at path: uploads/{user_id}/{scan_id}.zip
 * Also caches in local storage/memory for worker processing.
 */
export async function uploadScanZip(
  userId: string,
  scanId: string,
  buffer: Buffer,
  supabaseClient?: SupabaseClient
): Promise<string> {
  const relativePath = `${userId}/${scanId}.zip`;
  const fullStoragePath = `uploads/${relativePath}`;

  // 1. Upload to Supabase Storage if client is provided
  if (supabaseClient) {
    try {
      const { error } = await supabaseClient.storage
        .from('uploads')
        .upload(relativePath, buffer, {
          contentType: 'application/zip',
          upsert: true,
        });

      if (error) {
        console.warn(`[Storage] Supabase storage upload warning: ${error.message}. Saving to fallback store.`);
      }
    } catch (err: any) {
      console.warn(`[Storage] Supabase storage call failed: ${err.message}.`);
    }
  }

  // 2. Always persist in memoryDb and local disk for resilient worker access
  (memoryDb as any).storage.set(fullStoragePath, buffer);
  (memoryDb as any).storage.set(relativePath, buffer);

  try {
    const localUserDir = path.join(LOCAL_STORAGE_BASE, 'uploads', userId);
    fs.mkdirSync(localUserDir, { recursive: true });
    const localFilePath = path.join(localUserDir, `${scanId}.zip`);
    fs.writeFileSync(localFilePath, buffer);
  } catch (err) {
    console.warn(`[Storage] Local disk write notice:`, err);
  }

  return fullStoragePath;
}

/**
 * Retrieves the uploaded ZIP buffer by storage path
 */
export async function getScanZipBuffer(
  storagePath: string,
  supabaseClient?: SupabaseClient
): Promise<Buffer | null> {
  // 1. Check memory store
  const fromMemory = (memoryDb as any).storage.get(storagePath);
  if (fromMemory) return fromMemory;

  // 2. Check local disk
  const cleanPath = storagePath.replace(/^uploads\//, '');
  const localDiskPath = path.join(LOCAL_STORAGE_BASE, 'uploads', cleanPath);
  if (fs.existsSync(localDiskPath)) {
    return fs.readFileSync(localDiskPath);
  }

  // 3. Download from Supabase Storage if client exists
  if (supabaseClient) {
    try {
      const { data, error } = await supabaseClient.storage
        .from('uploads')
        .download(cleanPath);

      if (!error && data) {
        const arrayBuf = await data.arrayBuffer();
        return Buffer.from(arrayBuf);
      }
    } catch (err) {
      console.warn(`[Storage] Supabase download error:`, err);
    }
  }

  return null;
}
