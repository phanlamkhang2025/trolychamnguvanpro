import { Attachment } from '../types';
import { extractWordText } from './wordExtract';

export const MAX_FILE_BYTES = 15 * 1024 * 1024;

export const ACCEPTED_FILE_TYPES =
  '.docx,.pdf,.jpg,.jpeg,.png,.webp,.heic,.heif,application/pdf,image/jpeg,image/png,image/webp,application/vnd.openxmlformats-officedocument.wordprocessingml.document';

const hasExtension = (name: string, pattern: RegExp) => pattern.test(name.toLowerCase());

export const isWordFile = (file: { name: string; mimeType?: string; type?: string }): boolean => {
  const mime = (file.mimeType || file.type || '').toLowerCase();
  return hasExtension(file.name, /\.docx$/) || mime.includes('officedocument.wordprocessingml');
};

export const isPdfFile = (file: { name: string; mimeType?: string; type?: string }): boolean => {
  const mime = (file.mimeType || file.type || '').toLowerCase();
  return hasExtension(file.name, /\.pdf$/) || mime === 'application/pdf';
};

export const isImageFile = (file: { name: string; mimeType?: string; type?: string }): boolean => {
  const mime = (file.mimeType || file.type || '').toLowerCase();
  return mime.startsWith('image/') || hasExtension(file.name, /\.(jpe?g|png|webp|heic|heif)$/);
};

// Why a file cannot be used, or null when it can
export function checkFile(file: File): string | null {
  if (hasExtension(file.name, /\.doc$/)) {
    return `"${file.name}" là tệp .doc cũ. Vui lòng mở bằng Word, lưu lại thành .docx rồi tải lên.`;
  }
  if (!isWordFile(file) && !isPdfFile(file) && !isImageFile(file)) {
    return `"${file.name}" không đúng định dạng. App nhận tệp Word (.docx), PDF và ảnh.`;
  }
  if (file.size > MAX_FILE_BYTES) {
    return `"${file.name}" vượt quá dung lượng tối đa 15 MB.`;
  }
  return null;
}

export function readFileAsAttachment(file: File): Promise<Attachment> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      resolve({
        id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        name: file.name,
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
        base64: reader.result as string,
      });
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export async function readWordFile(file: File): Promise<string> {
  return extractWordText(await file.arrayBuffer());
}

// "Nguyen_Van_A_trang2.jpg" -> "Nguyen Van A", so pages of one essay land on one student
export function studentNameFromFileName(fileName: string, stripPageNumber: boolean): string {
  let name = fileName.replace(/\.[^.]+$/, '');
  if (stripPageNumber) {
    // Needs a separator, so a camera's IMG_0001 and IMG_0002 stay two different students
    name = name.replace(/[\s_.-]+(?:\(?\d{1,2}\)?|(?:trang|tr|page|p)[\s_.-]*\d{1,2})$/i, '');
  }
  return name.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim() || fileName;
}

export function formatFileSize(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
