import mongoose from 'mongoose';

const employeeSchema = new mongoose.Schema(
  {
    fullname: { type: String, required: true, trim: true },
    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    employeeCode: { type: String, trim: true, sparse: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const Employee = mongoose.model('Employee', employeeSchema);
