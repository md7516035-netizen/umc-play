import { doc, getDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { UMC_LIMITS } from '../constants/validation';
import type { ProjectSubmission } from '../types/umc';

const CHUNK_RAW_BYTES = 380000; // ~507KB base64 per Firestore document

export async function compressImageToDataUrl(
  file: File,
  maxWidth = 1200,
  maxChars = UMC_LIMITS.IMAGE_DATA_URL_MAX_CHARS
): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error(`"${file.name}" is not a valid image file.`);
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error(`Unable to load image "${file.name}".`));
      el.src = objectUrl;
    });

    const scale = img.width > maxWidth ? maxWidth / img.width : 1;
    let width = Math.max(1, Math.round(img.width * scale));
    let height = Math.max(1, Math.round(img.height * scale));

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Browser canvas image processing is unavailable.');
    }

    const qualities = [0.82, 0.72, 0.6, 0.48, 0.36];
    for (let attempt = 0; attempt < 2; attempt += 1) {
      canvas.width = width;
      canvas.height = height;
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);

      for (const q of qualities) {
        const dataUrl = canvas.toDataURL('image/jpeg', q);
        if (dataUrl.length <= maxChars) {
          return dataUrl;
        }
      }

      // Reduce dimensions by 30% and retry if still too large
      width = Math.max(320, Math.round(width * 0.7));
      height = Math.max(200, Math.round(height * 0.7));
    }

    throw new Error(`Image "${file.name}" is too complex to compress cleanly. Choose a smaller image.`);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  const blockSize = 0x8000;
  const parts: string[] = [];
  for (let i = 0; i < bytes.length; i += blockSize) {
    const sub = bytes.subarray(i, i + blockSize);
    parts.push(String.fromCharCode(...sub));
  }
  return btoa(parts.join(''));
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export async function readFileAsBase64Chunks(file: File): Promise<string[]> {
  if (file.size <= 0) {
    throw new Error('Selected project file is empty.');
  }
  if (file.size > UMC_LIMITS.PROJECT_MAX_FILE_BYTES) {
    throw new Error('Project file exceeds the 3 MB direct upload limit. Upload a file up to 3 MB or provide a download URL.');
  }

  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const chunks: string[] = [];

  for (let offset = 0; offset < bytes.length; offset += CHUNK_RAW_BYTES) {
    const slice = bytes.subarray(offset, offset + CHUNK_RAW_BYTES);
    chunks.push(uint8ArrayToBase64(slice));
  }

  return chunks;
}

export async function downloadSubmissionFile(submission: ProjectSubmission): Promise<void> {
  if (submission.projectFileChunkCount <= 0) {
    if (submission.externalFileUrl) {
      const a = document.createElement('a');
      a.href = submission.externalFileUrl;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return;
    }
    throw new Error('No downloadable file attached to this submission.');
  }

  const chunkIndices = Array.from({ length: submission.projectFileChunkCount }, (_, i) => i);
  const chunkArrays: Uint8Array[] = await Promise.all(
    chunkIndices.map(async (idx) => {
      const chunkPath = `projectSubmissions/${submission.id}/chunks/chunk_${idx}`;
      try {
        const snap = await getDoc(doc(db, 'projectSubmissions', submission.id, 'chunks', `chunk_${idx}`));
        if (!snap.exists()) {
          throw new Error(`Missing file chunk ${idx + 1} of ${submission.projectFileChunkCount}.`);
        }
        const data = snap.data() as { dataBase64?: string };
        if (!data.dataBase64) {
          throw new Error(`Corrupted file chunk ${idx + 1}.`);
        }
        return base64ToUint8Array(data.dataBase64);
      } catch (err) {
        if (err instanceof Error && err.message.includes('Missing or insufficient permissions')) {
          handleFirestoreError(err, OperationType.GET, chunkPath);
        }
        throw err;
      }
    })
  );

  const blobParts: BlobPart[] = chunkArrays.map((arr) => {
    const copy = new Uint8Array(arr.byteLength);
    copy.set(arr);
    return copy.buffer;
  });

  const blob = new Blob(blobParts, {
    type: submission.projectFileMime || 'application/octet-stream',
  });
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = submission.projectFileName || 'umc_project_file';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
}
