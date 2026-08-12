import { useState } from 'react';
import { QuestionBankTab } from '../../components/examiner/QuestionBankTab';
import { TopicTab } from '../../components/examiner/TopicTab';
import { DepartmentTab } from '../../components/examiner/DepartmentTab';
import { ExamProposalTab } from '../../components/examiner/ExamProposalTab';
import { BookOpen, FolderOpen, Building, FileSignature } from 'lucide-react';

export const ExaminerDashboard = () => {
  const [activeTab, setActiveTab] = useState('questions');
  // Khi bấm "Xem câu hỏi" trên 1 thẻ chủ đề ở tab Chủ đề, lưu topicId + mốc
  // thời gian (seed) vào đây rồi chuyển sang tab Ngân hàng câu hỏi. Kèm seed
  // để nếu người dùng bấm lại đúng chủ đề cũ lần nữa, QuestionBankTab vẫn
  // nhận biết được đây là 1 yêu cầu áp filter MỚI (không chỉ so sánh topicId
  // không đổi mà bỏ qua).
  const [questionsFilterSeed, setQuestionsFilterSeed] = useState(null);

  const handleViewQuestionsByTopic = (topicId) => {
    setQuestionsFilterSeed({ topicId, ts: Date.now() });
    setActiveTab('questions');
  };

  const tabs = [
    { id: 'questions', label: 'Ngân hàng câu hỏi', icon: <BookOpen className="w-5 h-5" /> },
    { id: 'topics', label: 'Chủ đề', icon: <FolderOpen className="w-5 h-5" /> },
    { id: 'departments', label: 'Bộ phận / Phòng ban', icon: <Building className="w-5 h-5" /> },
    { id: 'proposals', label: 'Đề xuất kỳ thi', icon: <FileSignature className="w-5 h-5" /> },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 mt-16 min-h-screen">
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-[#0F172A] mb-2">QUẢN LÝ NGÂN HÀNG ĐỀ THI</h1>
        <p className="text-slate-500">Soạn thảo, quản lý câu hỏi thi chuyên môn và bộ phận phòng ban.</p>
      </div>

      <div className="bg-white rounded-xl shadow-z176 border border-slate-200 overflow-hidden">
        {/* Tab Navigation */}
        <div className="flex overflow-x-auto border-b border-slate-200 bg-slate-50 scrollbar-hide">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-6 py-4 font-medium text-sm whitespace-nowrap transition-colors border-b-2 outline-none focus:bg-slate-100 ${
                activeTab === tab.id
                  ? 'border-[#008BC5] text-[#008BC5] bg-white'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100/50'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="p-4 md:p-6 bg-slate-50/50 min-h-[400px]">
          {activeTab === 'questions' && <QuestionBankTab initialFilter={questionsFilterSeed} />}
          {activeTab === 'topics' && <TopicTab onViewQuestions={handleViewQuestionsByTopic} />}
          {activeTab === 'departments' && <DepartmentTab />}
          {activeTab === 'proposals' && <ExamProposalTab />}
        </div>
      </div>
    </div>
  );
};