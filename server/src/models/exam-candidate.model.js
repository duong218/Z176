import mongoose from 'mongoose';

const examCandidateSchema = new mongoose.Schema(
  {
    examId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Exam',
      required: true,
      index: true,
    },
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      index: true,
    },
    examCodeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ExamCode',
      required: true,
      index: true,
    },
  },
  { timestamps: true },
);

examCandidateSchema.index({ examId: 1, employeeId: 1 }, { unique: true });

export const ExamCandidate = mongoose.model('ExamCandidate', examCandidateSchema);
