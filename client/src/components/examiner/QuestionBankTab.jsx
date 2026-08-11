import { useState, useEffect } from 'react';
import { Search, Plus, Edit2, Trash2, Loader2, X, Upload, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react';
import { fetchQuestions, fetchTopics, fetchDepartments, createQuestion, updateQuestion, deleteQuestion, importQuestions } from '../../services/examiner.service';

export const QuestionBankTab = () => {
  const [questions, setQuestions] = useState([]);
  const [topics, setTopics] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0 });

  // Filters State
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selectedTopic, setSelectedTopic] = useState('');
  const [selectedScope, setSelectedScope] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedDifficulty, setSelectedDifficulty] = useState('');

  // Modals state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState(null);

  // Import State
  const [importFile, setImportFile] = useState(null);

  // Form State
  const [content, setContent] = useState('');
  const [questionKind, setQuestionKind] = useState('theory');
  const [answerType, setAnswerType] = useState('single');
  const [difficulty, setDifficulty] = useState('easy');
  const [scope, setScope] = useState('Common');
  const [topicId, setTopicId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [answers, setAnswers] = useState([
    { content: '', isCorrect: false },
    { content: '', isCorrect: false },
    { content: '', isCorrect: false },
    { content: '', isCorrect: false }
  ]);

  const loadData = async (page = 1) => {
    setLoading(true);
    setError('');
    try {
      const [questionsRes, topicsData, deptsData] = await Promise.all([
        fetchQuestions({
          page,
          limit: 10,
          search,
          topicId: selectedTopic,
          scope: selectedScope,
          departmentId: selectedDept,
          difficulty: selectedDifficulty
        }),
        fetchTopics(),
        fetchDepartments()
      ]);
      setQuestions(questionsRes.items);
      setPagination(questionsRes.pagination);
      setTopics(topicsData);
      setDepartments(deptsData);
    } catch (err) {
      setError(err.message || 'Lỗi tải ngân hàng câu hỏi');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(1);
  }, [selectedTopic, selectedScope, selectedDept, selectedDifficulty]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadData(1);
  };

  const handleOpenAdd = () => {
    setEditingQuestion(null);
    setContent('');
    setQuestionKind('theory');
    setAnswerType('single');
    setDifficulty('easy');
    setScope('Common');
    setTopicId('');
    setDepartmentId('');
    setAnswers([
      { content: '', isCorrect: false },
      { content: '', isCorrect: false },
      { content: '', isCorrect: false },
      { content: '', isCorrect: false }
    ]);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (q) => {
    setEditingQuestion(q);
    setContent(q.content);
    setQuestionKind(q.questionKind || 'theory');
    setAnswerType(q.answerType || 'single');
    setDifficulty(q.difficulty || 'easy');
    setScope(q.scope || 'Common');
    setTopicId(q.topicId || '');
    setDepartmentId(q.departmentId || '');
    // Mapping option responses to form structure
    const mappedAnswers = q.answers.map(a => ({
      id: a.id,
      content: a.content,
      isCorrect: a.isCorrect
    }));
    // Make sure there are at least 4 answers fields for better form layout
    while (mappedAnswers.length < 4) {
      mappedAnswers.push({ content: '', isCorrect: false });
    }
    setAnswers(mappedAnswers);
    setIsFormOpen(true);
  };

  const handleAnswerChange = (index, field, value) => {
    const nextAnswers = [...answers];
    if (field === 'isCorrect' && answerType === 'single') {
      // Toggle all others off
      nextAnswers.forEach((ans, i) => {
        ans.isCorrect = i === index ? value : false;
      });
    } else {
      nextAnswers[index][field] = value;
    }
    setAnswers(nextAnswers);
  };

  const addAnswerField = () => {
    if (answers.length >= 8) return; // Limit to 8 options
    setAnswers([...answers, { content: '', isCorrect: false }]);
  };

  const removeAnswerField = (index) => {
    if (answers.length <= 2) return; // Keep at least 2 options
    setAnswers(answers.filter((_, i) => i !== index));
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!topicId) {
      setError('Vui lòng chọn chủ đề liên kết');
      return;
    }
    if (scope === 'DepartmentSpecific' && !departmentId) {
      setError('Vui lòng chọn bộ phận liên kết');
      return;
    }

    const filteredAnswers = answers.filter(a => a.content.trim() !== '');
    if (filteredAnswers.length < 2) {
      setError('Vui lòng điền ít nhất 2 phương án trả lời');
      return;
    }

    const correctCount = filteredAnswers.filter(a => a.isCorrect).length;
    if (answerType === 'single' && correctCount !== 1) {
      setError('Vui lòng chọn duy nhất 1 đáp án đúng cho câu hỏi Một đáp án.');
      return;
    }
    if (answerType === 'multiple' && correctCount < 1) {
      setError('Vui lòng chọn ít nhất 1 đáp án đúng cho câu hỏi Nhiều đáp án.');
      return;
    }

    setActionLoading(true);
    setError('');
    const payload = {
      content,
      questionKind,
      answerType,
      difficulty,
      scope,
      topicId,
      departmentId: scope === 'DepartmentSpecific' ? departmentId : undefined,
      answers: filteredAnswers
    };

    try {
      if (editingQuestion) {
        await updateQuestion(editingQuestion.id, payload);
      } else {
        await createQuestion(payload);
      }
      setIsFormOpen(false);
      await loadData(pagination.page);
    } catch (err) {
      setError(err.message || 'Lỗi khi lưu câu hỏi');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Bạn có chắc chắn muốn ngừng sử dụng câu hỏi này?')) return;
    setActionLoading(true);
    try {
      await deleteQuestion(id);
      await loadData(pagination.page);
    } catch (err) {
      setError(err.message || 'Lỗi khi xóa câu hỏi');
    } finally {
      setActionLoading(false);
    }
  };

  const handleImportSubmit = async (e) => {
    e.preventDefault();
    if (!importFile) return;
    setActionLoading(true);
    setError('');
    try {
      const res = await importQuestions(importFile);
      alert(`Import thành công! Đã nhập: ${res.imported} câu hỏi, Thất bại: ${res.failed} câu hỏi.`);
      setIsImportOpen(false);
      setImportFile(null);
      await loadData(1);
    } catch (err) {
      setError(err.message || 'Lỗi khi import file Excel');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-800 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Toolbar & Filters */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Tìm kiếm nội dung câu hỏi..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#008BC5]"
            />
            <Search className="w-5 h-5 text-slate-400 absolute left-3 top-2.5" />
          </div>
          <button type="submit" className="px-5 py-2 bg-[#008BC5] text-white rounded-lg font-medium hover:bg-[#007ba1] transition-colors">
            Tìm kiếm
          </button>
        </form>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <select
            value={selectedTopic}
            onChange={(e) => setSelectedTopic(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#008BC5] bg-white text-sm"
          >
            <option value="">-- Tất cả chủ đề --</option>
            {topics.map(t => <option key={t._id} value={t._id}>{t.name}</option>)}
          </select>

          <select
            value={selectedScope}
            onChange={(e) => setSelectedScope(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#008BC5] bg-white text-sm"
          >
            <option value="">-- Phạm vi --</option>
            <option value="Common">Chung</option>
            <option value="DepartmentSpecific">Riêng bộ phận</option>
          </select>

          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            disabled={selectedScope !== 'DepartmentSpecific'}
            className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#008BC5] bg-white text-sm disabled:bg-slate-50 disabled:text-slate-400"
          >
            <option value="">-- Bộ phận --</option>
            {departments.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
          </select>

          <select
            value={selectedDifficulty}
            onChange={(e) => setSelectedDifficulty(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#008BC5] bg-white text-sm"
          >
            <option value="">-- Độ khó --</option>
            <option value="easy">Dễ</option>
            <option value="medium">Trung bình</option>
            <option value="hard">Khó</option>
          </select>
        </div>

        <div className="flex flex-wrap justify-between items-center pt-2 gap-3 border-t border-slate-100">
          <div className="text-sm text-slate-500 font-medium">Tổng cộng: {pagination.total} câu hỏi</div>
          <div className="flex gap-2 w-full sm:w-auto">
            <button
              onClick={() => setIsImportOpen(true)}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50 transition-colors"
            >
              <Upload className="w-4 h-4" />
              <span>Import Excel</span>
            </button>
            <button
              onClick={handleOpenAdd}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 bg-[#008BC5] text-white rounded-lg font-medium hover:bg-[#007ba1] transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Thêm câu hỏi</span>
            </button>
          </div>
        </div>
      </div>

      {/* List Questions */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm animate-pulse space-y-3">
              <div className="h-6 w-3/4 bg-slate-200 rounded"></div>
              <div className="h-4 w-1/4 bg-slate-200 rounded"></div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {questions.map((q) => (
            <div key={q.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4 hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start gap-4">
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2 items-center">
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                      q.difficulty === 'easy' ? 'bg-green-100 text-green-700' :
                      q.difficulty === 'medium' ? 'bg-blue-100 text-blue-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {q.difficulty === 'easy' ? 'Dễ' : q.difficulty === 'medium' ? 'Trung bình' : 'Khó'}
                    </span>
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-xs font-semibold">
                      {q.questionKind === 'theory' ? 'Lý thuyết' : 'Bài tập'}
                    </span>
                    <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs font-semibold">
                      {q.scope === 'Common' ? 'Chung' : 'Riêng bộ phận'}
                    </span>
                  </div>
                  <h4 className="font-bold text-slate-800 text-base leading-snug">{q.content}</h4>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => handleOpenEdit(q)}
                    className="p-2 text-slate-500 hover:text-[#008BC5] hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(q.id)}
                    className="p-2 text-slate-500 hover:text-[#E53E3E] hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Answers list */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pl-2">
                {q.answers.map((ans, idx) => (
                  <div key={ans.id || idx} className={`p-2.5 rounded-lg border text-sm flex items-start gap-2.5 ${ans.isCorrect ? 'bg-green-50 border-green-200 text-green-800' : 'bg-slate-50/50 border-slate-100 text-slate-700'}`}>
                    <span className="font-semibold">{String.fromCharCode(65 + idx)}.</span>
                    <span className="flex-1">{ans.content}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {questions.length === 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-500">
              Không tìm thấy câu hỏi nào.
            </div>
          )}

          {/* Pagination */}
          {pagination.total > pagination.limit && (
            <div className="flex justify-between items-center pt-4">
              <button
                disabled={pagination.page <= 1}
                onClick={() => loadData(pagination.page - 1)}
                className="flex items-center gap-1 px-3 py-1.5 border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 text-sm font-medium"
              >
                <ChevronLeft className="w-4 h-4" /> Trước
              </button>
              <span className="text-sm font-medium text-slate-600">Trang {pagination.page}</span>
              <button
                disabled={pagination.page * pagination.limit >= pagination.total}
                onClick={() => loadData(pagination.page + 1)}
                className="flex items-center gap-1 px-3 py-1.5 border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 text-sm font-medium"
              >
                Sau <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* QUESTION FORM MODAL */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl my-8 overflow-hidden border border-slate-100">
            <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-lg text-[#0F172A]">
                {editingQuestion ? 'Chỉnh sửa câu hỏi' : 'Thêm câu hỏi mới'}
              </h3>
              <button onClick={() => setIsFormOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleFormSubmit} className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Nội dung câu hỏi</label>
                <textarea
                  required
                  placeholder="Nhập nội dung câu hỏi..."
                  rows="3"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#008BC5]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Loại nội dung</label>
                  <select
                    value={questionKind}
                    onChange={(e) => setQuestionKind(e.target.value)}
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#008BC5] bg-white"
                  >
                    <option value="theory">Lý thuyết</option>
                    <option value="practice">Bài tập thực hành</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Độ khó</label>
                  <select
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value)}
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#008BC5] bg-white"
                  >
                    <option value="easy">Dễ</option>
                    <option value="medium">Trung bình</option>
                    <option value="hard">Khó</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Hình thức đáp án</label>
                  <select
                    value={answerType}
                    onChange={(e) => {
                      setAnswerType(e.target.value);
                      // Reset correct checks if switching to single
                      if (e.target.value === 'single') {
                        setAnswers(prev => prev.map((ans, idx) => ({ ...ans, isCorrect: idx === 0 })));
                      }
                    }}
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#008BC5] bg-white"
                  >
                    <option value="single">Một đáp án đúng (Single Choice)</option>
                    <option value="multiple">Nhiều đáp án đúng (Multiple Choice)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Chủ đề liên kết</label>
                  <select
                    required
                    value={topicId}
                    onChange={(e) => setTopicId(e.target.value)}
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#008BC5] bg-white"
                  >
                    <option value="">-- Chọn chủ đề --</option>
                    {topics.map(t => <option key={t._id} value={t._id}>{t.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Phạm vi câu hỏi</label>
                  <select
                    value={scope}
                    onChange={(e) => setScope(e.target.value)}
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#008BC5] bg-white"
                  >
                    <option value="Common">Chung (Toàn nhà máy)</option>
                    <option value="DepartmentSpecific">Riêng bộ phận</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Bộ phận liên kết</label>
                  <select
                    required={scope === 'DepartmentSpecific'}
                    disabled={scope !== 'DepartmentSpecific'}
                    value={departmentId}
                    onChange={(e) => setDepartmentId(e.target.value)}
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#008BC5] bg-white disabled:bg-slate-50 disabled:text-slate-400"
                  >
                    <option value="">-- Chọn bộ phận --</option>
                    {departments.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
                  </select>
                </div>
              </div>

              {/* Answers Area */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="block text-sm font-semibold text-slate-700">Các phương án trả lời (Từ A đến H)</label>
                  {answers.length < 8 && (
                    <button
                      type="button"
                      onClick={addAnswerField}
                      className="text-xs font-semibold text-[#008BC5] hover:underline"
                    >
                      + Thêm phương án
                    </button>
                  )}
                </div>

                <div className="space-y-2">
                  {answers.map((ans, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <input
                        type={answerType === 'single' ? 'radio' : 'checkbox'}
                        name="correct_answer"
                        checked={ans.isCorrect}
                        onChange={(e) => handleAnswerChange(idx, 'isCorrect', e.target.checked)}
                        className="w-4 h-4 text-[#008BC5] focus:ring-[#008BC5]"
                      />
                      <span className="font-bold text-sm text-slate-500 w-5">{String.fromCharCode(65 + idx)}.</span>
                      <input
                        type="text"
                        placeholder={`Nhập phương án ${String.fromCharCode(65 + idx)}...`}
                        value={ans.content}
                        onChange={(e) => handleAnswerChange(idx, 'content', e.target.value)}
                        className="flex-1 px-3 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#008BC5]"
                      />
                      {answers.length > 2 && (
                        <button
                          type="button"
                          onClick={() => removeAnswerField(idx)}
                          className="text-slate-400 hover:text-red-500 p-1"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="flex-1 py-2.5 border border-slate-300 rounded-lg font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="flex-1 py-2.5 bg-[#008BC5] text-white rounded-lg font-semibold hover:bg-[#007ba1] transition-colors flex items-center justify-center gap-2 disabled:opacity-75"
                >
                  {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Lưu câu hỏi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* IMPORT EXCEL MODAL */}
      {isImportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden border border-slate-100">
            <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-lg text-[#0F172A]">Nhập câu hỏi từ file Excel</h3>
              <button onClick={() => setIsImportOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleImportSubmit} className="p-5 space-y-4">
              <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center hover:bg-slate-50 cursor-pointer relative">
                <input
                  type="file"
                  required
                  accept=".xlsx, .xls"
                  onChange={(e) => setImportFile(e.target.files[0])}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <Upload className="w-10 h-10 text-slate-400 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-700">Tải file Excel câu hỏi lên đây</p>
                <p className="text-xs text-slate-400 mt-1">Định dạng hỗ trợ: .xlsx, .xls (Tối đa 5MB)</p>
                {importFile && (
                  <p className="mt-2 text-sm text-[#008BC5] font-semibold">Tệp đã chọn: {importFile.name}</p>
                )}
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsImportOpen(false)}
                  className="flex-1 py-2.5 border border-slate-300 rounded-lg font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={!importFile || actionLoading}
                  className="flex-1 py-2.5 bg-[#008BC5] text-white rounded-lg font-semibold hover:bg-[#007ba1] transition-colors flex items-center justify-center gap-2 disabled:opacity-75"
                >
                  {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Tải lên & Import
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
