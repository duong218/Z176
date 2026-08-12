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
    // unique + sparse: chặn trùng employeeCode ở tầng DB (ngoài check tay ở
    // user.service.js#importEmployeesFromExcelFile) — sparse để các document
    // không có employeeCode (rỗng/null) không bị tính là trùng nhau.
    // ⚠️ CHỈ bật unique sau khi đã chạy check_employee_code_duplicates.js xác
    // nhận DB hiện tại không còn mã trùng, nếu không MongoDB sẽ báo lỗi khi
    // build index lúc khởi động server.
    employeeCode: { type: String, trim: true, unique: true, sparse: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const Employee = mongoose.model('Employee', employeeSchema);