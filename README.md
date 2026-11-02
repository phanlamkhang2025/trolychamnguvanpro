<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/b0fa18d0-5b98-4eb0-acbf-3412226a2827

## Cách dùng

App chạy hoàn toàn trên trình duyệt của giáo viên, không cần máy chủ. Mọi bước đều làm trên đề đang chọn ở đầu trang:

1. **Đề & đáp án:** nhập hoặc tải lên đề bài, đáp án, lời giải, phổ điểm.
2. **Bài làm:** tải lên một lúc nhiều tệp Word, PDF, ảnh. Mỗi tệp là một bài; ảnh đặt tên kiểu `An_1`, `An_2` được ghép thành một bài.
3. **Chấm & duyệt:** AI chấm lần lượt cả lớp, giáo viên xem bài bên cạnh điểm, sửa nếu cần rồi duyệt.
4. **Kết quả:** thống kê, xuất bảng điểm, in phiếu chấm.

- **API key:** mỗi giáo viên nhập key của mình ở đầu trang (lấy key tại https://aistudio.google.com/apikey). Key lưu trong trình duyệt và chỉ được gửi thẳng tới Google.
- **Dữ liệu:** đề thi, bài làm, tệp đính kèm và điểm lưu trong IndexedDB của trình duyệt đang dùng. Đổi máy, đổi trình duyệt hoặc xóa dữ liệu duyệt web thì không còn thấy dữ liệu đó.

## Chạy trên máy

**Cần có:** Node.js

1. Cài thư viện: `npm install`
2. Chạy app: `npm run dev`
3. Mở http://localhost:3000

## Đưa lên Vercel

Đẩy mã nguồn lên GitHub rồi import vào Vercel. Cấu hình build nằm sẵn trong `vercel.json`, không cần đặt biến môi trường nào.
