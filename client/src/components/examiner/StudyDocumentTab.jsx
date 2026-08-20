import { useEffect, useState } from 'react';
import {
  BookOpen,
  UploadCloud,
  FileText,
  Eye,
  Download,
  Trash2,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { fetchTopics, fetchDepartments } from '../../services/examiner.service';
import {
  fetchStudyDocuments,
  uploadStudyDocument,
  deleteStudyDocument,
  previewStudyDocument,
  downloadStudyDocument,
} from '../../services/study-document.service';
import { useConfirm } from '../ConfirmDialog';

const SCOPE_COMMON = 'Common';
const SCOPE_DEPARTMENT = 'DepartmentSpecific';

const ACCEPTED_EXTENSIONS = '.pdf,.doc,.docx,.xls,.xlsx';
const MAX_FILE_BYTES = 20 * 1024 * 1024;

const formatDateTime = (value) => {
  if (!value) return '—';
  return new Date(value).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatFileSize = (bytes) => {
  if (!bytes && bytes !== 0) return '';
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
};

const isPdf = (doc) =>
  doc.mimeType === 'application/pdf' || doc.originalFileName?.toLowerCase().endsWith('.pdf');

export const StudyDocumentTab = () => {
  const confirmAction = useConfirm();
  const [documents, setDocuments] = useState([]);
  const [topics, setTopics] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  const [form, setForm] = useState({
    topicId: '',
    title: '',
    scope: SCOPE_COMMON,
    departmentId: '',
  });
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  const [busyId, setBusyId] = useState(null); // id đang xem/tải/xóa dở

  const loadAll = () => {
    setLoading(true);
    setError(null);
    Promise.all([fetchStudyDocuments(), fetchTopics(), fetchDepartments()])
      .then(([docs, topicList, deptList]) => {
        setDocuments(Array.isArray(docs) ? docs : []);
        setTopics(Array.isArray(topicList) ? topicList : []);
        setDepartments(Array.isArray(deptList) ? deptList : []);
      })
      .catch((err) => {
        setError(err?.message || 'Không thể tải danh sách tài liệu.');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadAll();
  }, []);

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0] ?? null;
    if (selected && selected.size > MAX_FILE_BYTES) {
      setFormError('File vượt quá dung lượng cho phép (tối đa 20MB).');
      setFile(null);
      e.target.value = '';
      return;
    }
    setFormError(null);
    setFile(selected);
  };

  const resetForm = () => {
    setForm({ topicId: '', title: '', scope: SCOPE_COMMON, departmentId: '' });
    setFile(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);
    setNotice(null);

    if (!form.topicId) {
      setFormError('Vui lòng chọn chủ đề.');
      return;
    }
    if (!file) {
      setFormError('Vui lòng chọn file tài liệu (PDF, Word hoặc Excel).');
      return;
    }
    if (form.scope === SCOPE_DEPARTMENT && !form.departmentId) {
      setFormError('Vui lòng chọn phòng ban cho tài liệu riêng.');
      return;
    }

    setSubmitting(true);
    try {
      await uploadStudyDocument({
        topicId: form.topicId,
        title: form.title,
        scope: form.scope,
        departmentId: form.scope === SCOPE_DEPARTMENT ? form.departmentId : undefined,
        file,
      });
      setNotice('Đăng tài liệu thành công.');
      resetForm();
      loadAll();
    } catch (err) {
      setFormError(err?.message || 'Đăng tài liệu thất bại. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePreview = async (doc) => {
    setBusyId(doc._id);
    setError(null);
    try {
      await previewStudyDocument(doc._id);
    } catch (err) {
      setError(err?.message || 'Không thể mở tài liệu.');
    } finally {
      setBusyId(null);
    }
  };

  const handleDownload = async (doc) => {
    setBusyId(doc._id);
    setError(null);
    try {
      await downloadStudyDocument(doc._id, doc.originalFileName || doc.title);
    } catch (err) {
      setError(err?.message || 'Không thể tải tài liệu.');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (doc) => {
    const ok = await confirmAction(
      `Gỡ tài liệu "${doc.title}"? Thí sinh sẽ không còn xem được tài liệu này.`,
      { title: 'Gỡ tài liệu', confirmLabel: 'Gỡ tài liệu' }
    );
    if (!ok) return;
    setBusyId(doc._id);
    setError(null);
    try {
      await deleteStudyDocument(doc._id);
      setNotice('Đã gỡ tài liệu.');
      setDocuments((prev) => prev.filter((d) => d._id !== doc._id));
    } catch (err) {
      setError(err?.message || 'Không thể gỡ tài liệu.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* Form đăng tài liệu */}
      <div className="bg-white rounded-xl shadow-z176 border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50">
          <h2 className="text-lg font-bold text-[#0F172A] flex items-center gap-2">
            <UploadCloud className="w-5 h-5 text-[#008BC5]" />
            Đăng tài liệu ôn tập mới
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {formError && (
            <div className="p-3 bg-[#FEECEC] border border-[#E53E3E]/30 text-[#0F172A] rounded-lg flex items-start gap-2.5 text-base">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-[#E53E3E]" />
              <span>{formError}</span>
            </div>
          )}
          {notice && (
            <div className="p-3 bg-[#F0FDF4] border border-[#22C55E]/30 text-[#0F172A] rounded-lg flex items-start gap-2.5 text-base">
              <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5 text-[#22C55E]" />
              <span>{notice}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-base font-semibold text-[#0F172A] mb-1.5">
                Chủ đề <span className="text-[#E53E3E]">*</span>
              </label>
              <select
                value={form.topicId}
                onChange={(e) => setForm((f) => ({ ...f, topicId: e.target.value }))}
                className="w-full min-h-[44px] px-3 py-2 text-base border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#008BC5]/40 focus:border-[#008BC5]"
              >
                <option value="">— Chọn chủ đề —</option>
                {topics.map((t) => (
                  <option key={t._id} value={t._id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-base font-semibold text-[#0F172A] mb-1.5">
                Tiêu đề tài liệu
              </label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Để trống sẽ dùng tên file"
                className="w-full min-h-[44px] px-3 py-2 text-base border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#008BC5]/40 focus:border-[#008BC5]"
              />
            </div>

            <div>
              <label className="block text-base font-semibold text-[#0F172A] mb-1.5">
                Phạm vi
              </label>
              <select
                value={form.scope}
                onChange={(e) => setForm((f) => ({ ...f, scope: e.target.value, departmentId: '' }))}
                className="w-full min-h-[44px] px-3 py-2 text-base border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#008BC5]/40 focus:border-[#008BC5]"
              >
                <option value={SCOPE_COMMON}>Chung (mọi thí sinh)</option>
                <option value={SCOPE_DEPARTMENT}>Riêng theo phòng ban</option>
              </select>
            </div>

            {form.scope === SCOPE_DEPARTMENT && (
              <div>
                <label className="block text-base font-semibold text-[#0F172A] mb-1.5">
                  Phòng ban <span className="text-[#E53E3E]">*</span>
                </label>
                <select
                  value={form.departmentId}
                  onChange={(e) => setForm((f) => ({ ...f, departmentId: e.target.value }))}
                  className="w-full min-h-[44px] px-3 py-2 text-base border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#008BC5]/40 focus:border-[#008BC5]"
                >
                  <option value="">— Chọn phòng ban —</option>
                  {departments.map((d) => (
                    <option key={d._id} value={d._id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div>
            <label className="block text-base font-semibold text-[#0F172A] mb-1.5">
              File tài liệu <span className="text-[#E53E3E]">*</span>
            </label>
            <input
              type="file"
              accept={ACCEPTED_EXTENSIONS}
              onChange={handleFileChange}
              className="w-full text-base file:mr-3 file:min-h-[44px] file:px-4 file:py-2 file:rounded-lg file:border-0 file:bg-[#008BC5] file:text-white file:font-semibold hover:file:bg-[#007ba1] file:cursor-pointer cursor-pointer"
            />
            <p className="text-sm text-slate-500 mt-1.5">
              Định dạng: PDF, Word (.doc, .docx), Excel (.xls, .xlsx) — tối đa 20MB.
              {file && <span className="text-[#0F172A] font-medium"> Đã chọn: {file.name} ({formatFileSize(file.size)})</span>}
            </p>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full sm:w-auto min-h-[48px] px-6 bg-[#008BC5] disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold text-base rounded-lg hover:bg-[#007ba1] transition-colors flex items-center justify-center gap-2"
          >
            {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <UploadCloud className="w-5 h-5" />}
            <span>{submitting ? 'Đang đăng tài liệu...' : 'Đăng tài liệu'}</span>
          </button>
        </form>
      </div>

      {/* Danh sách tài liệu đã đăng */}
      <div className="bg-white rounded-xl shadow-z176 border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50">
          <h2 className="text-lg font-bold text-[#0F172A] flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-[#008BC5]" />
            Tài liệu đã đăng
          </h2>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-slate-500">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Đang tải dữ liệu...</span>
          </div>
        ) : error ? (
          <div className="p-5">
            <div className="p-3 bg-[#FEECEC] border border-[#E53E3E]/30 text-[#0F172A] rounded-lg flex items-start gap-2.5 text-base">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-[#E53E3E]" />
              <span>{error}</span>
            </div>
          </div>
        ) : documents.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-base">
            Chưa có tài liệu nào được đăng.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {documents.map((doc) => (
              <div
                key={doc._id}
                className="p-4 sm:px-5 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4"
              >
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-[#EAF6FF] flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5 text-[#008BC5]" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-[#0F172A] text-base truncate">{doc.title}</div>
                    <div className="text-sm text-slate-500 mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span>{doc.topicId?.name || '—'}</span>
                      <span>·</span>
                      <span>
                        {doc.scope === SCOPE_DEPARTMENT
                          ? `Riêng: ${doc.departmentId?.name || '—'}`
                          : 'Chung'}
                      </span>
                      <span>·</span>
                      <span>{formatDateTime(doc.createdAt)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                  {isPdf(doc) && (
                    <button
                      onClick={() => handlePreview(doc)}
                      disabled={busyId === doc._id}
                      className="min-h-[44px] min-w-[44px] px-3 flex items-center gap-1.5 text-sm font-semibold text-[#008BC5] border border-[#008BC5]/40 rounded-lg hover:bg-[#EAF6FF] disabled:opacity-50 transition-colors"
                      title="Xem trực tiếp"
                    >
                      <Eye className="w-4 h-4" />
                      <span>Xem</span>
                    </button>
                  )}
                  <button
                    onClick={() => handleDownload(doc)}
                    disabled={busyId === doc._id}
                    className="min-h-[44px] min-w-[44px] px-3 flex items-center gap-1.5 text-sm font-semibold text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors"
                    title="Tải về"
                  >
                    <Download className="w-4 h-4" />
                    <span>Tải về</span>
                  </button>
                  <button
                    onClick={() => handleDelete(doc)}
                    disabled={busyId === doc._id}
                    className="min-h-[44px] min-w-[44px] px-3 flex items-center gap-1.5 text-sm font-semibold text-[#E53E3E] border border-[#E53E3E]/30 rounded-lg hover:bg-[#FEECEC] disabled:opacity-50 transition-colors"
                    title="Gỡ tài liệu"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Gỡ</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};