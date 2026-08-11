# Z176 — Module thi chuyên môn (demo / khóa luận)

- **client/** — React + Vite + Tailwind (trang chủ, modal thi demo trên dữ liệu mẫu). Chi tiết: [structure/client.md](../structure/client.md).
- **server/** — Express + Mongoose (MVP đang dựng). Chi tiết: [structure/server.md](../structure/server.md).
- **docs/** — Schema và tài liệu kỹ thuật: [MONGOOSE_SCHEMA.md](./MONGOOSE_SCHEMA.md).
- **mock-data/** — Dữ liệu giả cho AI/dev (không dùng dữ liệu thật Z176).

## Chạy nhanh (dev)

```bash
# Terminal 1 — API (cần MongoDB + file .env, xem env.example)
cd server
cp .env.example .env   # điền MONGODB_URI tối thiểu
npm install
npm run dev

# Terminal 2 — Giao diện
cd client
npm install
npm run dev
```

Client mặc định port **3000** (`client/package.json`); CORS server nên gồm `http://localhost:3000` (đã liệt kê trong `env.example`).

## Quy ước

Đọc [AGENTS.md](../AGENTS.md) trước khi code. Biến môi trường mẫu: [env.example](../env.example).
