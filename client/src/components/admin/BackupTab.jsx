import { useState, useEffect, useRef } from 'react';
import {
  Cloud,
  Download,
  Loader2,
  AlertCircle,
  AlertTriangle,
  ServerCrash,
  CheckCircle,
  UploadCloud,
  RefreshCw,
  FileArchive,
} from 'lucide-react';
import { fetchBackups, downloadBackupFile, restoreBackupFile } from '../../services/admin.service';

// Cụm từ bắt buộc gõ đúng (không dấu, dễ gõ) trước khi cho phép bấm khôi
// phục — thao tác này mongorestore --drop XOÁ TOÀN BỘ dữ liệu hiện tại rồi
// ghi đè, không có đường lùi, nên chỉ 1 nút "Xác nhận" bình thường là chưa
// đủ an toàn cho 1 thao tác nghiêm trọng như thế này.
const CONFIRM_PHRASE = 'XOA DU LIEU HIEN TAI';

function formatBytes(bytes) {
  const n = Number(bytes) || 0;
  if (n === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(n) / Math.log(1024)), units.length - 1);
  return `${(n / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function formatDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const BackupTab = () => {
  const [items, setItems] = useState([]);
  const [maxKept, setMaxKept] = useState(5);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloadingId, setDownloadingId] = useState(null);

  // Khôi phục
  const [selectedFile, setSelectedFile] = useState(null);
  const [confirmText, setConfirmText] = useState('');
  const [restoring, setRestoring] = useState(false);
  const [restoreResult, setRestoreResult] = useState(null); // { success, message }
  const fileInputRef = useRef(null);

  const loadBackups = async () => {
    setLoading(true);
    setError('');
    try {
      const { items: list, maxKept: max } = await fetchBackups();
      setItems(list);
      if (max) setMaxKept(max);
    } catch (err) {
      setError(err.message || 'Không tải được danh sách bản sao lưu');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBackups();
  }, []);

  const handleDownload = async (item) => {
    setDownloadingId(item.id);
    setError('');
    try {
      await downloadBackupFile(item.id, item.name);
    } catch (err) {
      setError(err.message || 'Tải bản sao lưu thất bại');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0] ?? null;
    setRestoreResult(null);
    if (file && !file.name.endsWith('.gz')) {
      setError('Chỉ chấp nhận file .gz (được tạo từ chức năng backup).');
      setSelectedFile(null);
      return;
    }
    setError('');
    setSelectedFile(file);
  };

  const canRestore =
    Boolean(selectedFile) && confirmText.trim().toUpperCase() === CONFIRM_PHRASE && !restoring;

  const handleRestore = async () => {
    if (!canRestore) return;
    setRestoring(true);
    setRestoreResult(null);
    setError('');
    try {
      const res = await restoreBackupFile(selectedFile);
      setRestoreResult({ success: true, message: res.message || 'Khôi phục dữ liệu thành công.' });
      setSelectedFile(null);
      setConfirmText('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      setRestoreResult({ success: false, message: err.message || 'Khôi phục thất bại.' });
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div className="space-y-8">
      {error && (
        <div className="p-4 bg-[#FEECEC] border border-[#E53E3E]/30 text-[#0F172A] rounded-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* DANH SÁCH BẢN SAO LƯU */}
      <div>
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-[#0F172A]">Các bản sao lưu trên Google Drive</h3>
            <p className="text-xs text-slate-500 mt-0.5">Hệ thống tự động giữ tối đa {maxKept} bản mới nhất.</p>
          </div>
          <button
            type="button"
            onClick={loadBackups}
            disabled={loading}
            className="flex items-center justify-center gap-2 px-3.5 py-2 text-sm border border-slate-300 rounded-lg font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50 w-full sm:w-auto"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Tải lại
          </button>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-slate-200 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-slate-500">
            <Cloud className="w-8 h-8 mx-auto mb-2 text-slate-300" />
            Chưa có bản sao lưu nào. Bấm "Backup dữ liệu" ở tab Tổng quan để tạo bản đầu tiên.
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-3 p-4 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-[#008BC5]/10 text-[#008BC5] flex items-center justify-center shrink-0">
                    <FileArchive className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-sm text-[#0F172A] truncate" title={item.name}>
                      {item.name}
                    </p>
                    <p className="text-xs text-slate-500">
                      {formatDateTime(item.createdTime)} · {formatBytes(item.size)}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleDownload(item)}
                  disabled={downloadingId === item.id}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm border border-slate-300 rounded-lg font-medium text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-50 shrink-0"
                >
                  {downloadingId === item.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  <span className="hidden sm:inline">Tải về</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* KHÔI PHỤC — vùng nguy hiểm, tách biệt hẳn về mặt hình ảnh */}
      <div className="border-2 border-[#E53E3E]/30 bg-[#FEECEC]/40 rounded-xl p-4 sm:p-5 space-y-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-6 h-6 text-[#E53E3E] shrink-0 mt-0.5" />
          <div>
            <h3 className="text-base sm:text-lg font-bold text-[#0F172A]">Khôi phục dữ liệu</h3>
            <p className="text-sm text-slate-600 mt-1">
              Chọn 1 file sao lưu (.gz) — có thể tải từ danh sách phía trên hoặc file backup đã lưu sẵn trên máy.
              Thao tác này sẽ <b>XOÁ TOÀN BỘ dữ liệu hiện tại</b> và ghi đè bằng dữ liệu trong file, không thể hoàn
              tác. Toàn bộ phiên đăng nhập hiện có (kể cả của chính bạn) có thể bị ảnh hưởng nếu tài khoản không còn
              tồn tại sau khi khôi phục.
            </p>
          </div>
        </div>

        {restoreResult && (
          <div
            className={`p-3 rounded-lg flex items-start gap-2.5 border text-sm ${
              restoreResult.success
                ? 'bg-[#F0FDF4] border-[#22C55E]/40 text-[#0F172A]'
                : 'bg-white border-[#E53E3E]/40 text-[#0F172A]'
            }`}
          >
            {restoreResult.success ? (
              <CheckCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#16A34A]" />
            ) : (
              <ServerCrash className="w-4 h-4 shrink-0 mt-0.5 text-[#C53030]" />
            )}
            <span>{restoreResult.message}</span>
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">File sao lưu (.gz)</label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".gz"
              onChange={handleFileChange}
              disabled={restoring}
              className="block w-full text-sm text-slate-600 file:mr-3 file:py-2 file:px-3.5 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-[#008BC5] file:text-white hover:file:bg-[#007ba1] disabled:opacity-50"
            />
            {selectedFile && (
              <p className="text-xs text-slate-500 mt-1.5">
                Đã chọn: <b>{selectedFile.name}</b> ({formatBytes(selectedFile.size)})
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              Gõ chính xác <span className="font-mono bg-slate-200 px-1.5 py-0.5 rounded text-[#E53E3E]">{CONFIRM_PHRASE}</span> để
              xác nhận
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              disabled={restoring}
              placeholder={CONFIRM_PHRASE}
              className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E53E3E] disabled:bg-slate-100"
            />
          </div>

          <button
            type="button"
            onClick={handleRestore}
            disabled={!canRestore}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 bg-[#E53E3E] text-white rounded-lg font-semibold hover:bg-[#C53030] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {restoring ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
            {restoring ? 'Đang khôi phục — không tắt trình duyệt...' : 'Khôi phục dữ liệu'}
          </button>
        </div>
      </div>
    </div>
  );
};