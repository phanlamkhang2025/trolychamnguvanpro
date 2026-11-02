import React from 'react';
import { AlertTriangle, Database, ShieldCheck, X } from 'lucide-react';

interface StorageInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const StorageInfoModal: React.FC<StorageInfoModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-xs p-4 overflow-y-auto">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="storage-info-title"
        className="bg-white rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden border border-slate-200 my-8"
      >
        <div className="bg-slate-900 p-5 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-blue-700 rounded-xl shadow-md">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <h2 id="storage-info-title" className="text-lg font-bold">Nơi Lưu Dữ Liệu</h2>
              <p className="text-xs text-slate-300">Đề thi, bài làm và điểm được lưu trong trình duyệt này</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="text-slate-400 hover:text-white p-1 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 text-sm text-slate-700">
          <div className="border border-emerald-200 rounded-xl p-4 bg-emerald-50 space-y-2">
            <h3 className="font-bold text-emerald-900 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              Dữ liệu nằm trên máy của thầy/cô
            </h3>
            <p className="text-xs text-emerald-900">
              Đề thi, bài làm, tệp đính kèm và điểm chỉ lưu trong trình duyệt đang dùng, không gửi lên máy chủ nào. Khi chấm, đề, đáp án và nội dung bài làm được gửi thẳng tới Google AI bằng API Key của thầy/cô. Họ tên nhập trong app không được gửi kèm, nhưng tên viết trên bài làm thì vẫn nằm trong nội dung gửi đi.
            </p>
          </div>

          <div className="border border-amber-200 rounded-xl p-4 bg-amber-50 space-y-2">
            <h3 className="font-bold text-amber-900 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              Trường hợp sẽ không còn thấy dữ liệu
            </h3>
            <ul className="list-disc list-inside text-xs text-amber-900 space-y-1">
              <li>Mở app bằng máy khác hoặc trình duyệt khác.</li>
              <li>Xóa dữ liệu duyệt web của trang này, hoặc dùng cửa sổ ẩn danh.</li>
            </ul>
            <p className="text-xs text-amber-900">
              Vì vậy, nên xuất bảng điểm ra tệp sau mỗi đợt chấm (bước 4. Kết quả).
            </p>
          </div>
        </div>

        <div className="bg-slate-50 p-4 border-t border-slate-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-lg text-sm font-semibold transition cursor-pointer"
          >
            Đã hiểu
          </button>
        </div>
      </div>
    </div>
  );
};
