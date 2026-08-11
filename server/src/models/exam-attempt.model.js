import mongoose from 'mongoose';
import { ATTEMPT_STATUS, ATTEMPT_TYPE } from './constants.js';

const examAttemptSchema = new mongoose.Schema(
  {
    examCandidateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ExamCandidate',
      required: true,
      index: true,
    },
    attemptType: {
      type: String,
      enum: Object.values(ATTEMPT_TYPE),
      required: true,
    },
    startedAt: { type: Date, required: true, default: Date.now },
    submittedAt: { type: Date },
    status: {
      type: String,
      enum: Object.values(ATTEMPT_STATUS),
      default: ATTEMPT_STATUS.IN_PROGRESS,
      index: true,
    },
    /** Token phiên thi — khác accessToken JWT đăng nhập (GLOSSARY.md) */
    examSessionTokenHash: { type: String, select: false },
    expiresAt: { type: Date },
  },
  { timestamps: true },
);

examAttemptSchema.index(
  { examCandidateId: 1, attemptType: 1, status: 1 },
);

export const ExamAttempt = mongoose.model('ExamAttempt', examAttemptSchema);
