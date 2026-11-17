# Bản lồng ghép mô hình — 35 trang

Dùng chính file người dùng gửi **DermaScan_AI_ThuyetTrinh_Moi (1).pptx** làm bản gốc (32 trang).

- **[PowerPoint đã lồng ghép](DermaScan_AI_LongGhep_MoHinh.pptx)** — các sơ đồ mới dùng khối, mũi tên và chữ PowerPoint chỉnh sửa được.
- **[PDF xem nhanh](DermaScan_AI_LongGhep_MoHinh.pdf)**
- **[Xem trước ba trang mới](Xem_truoc_3_trang_mo_hinh.jpg)**

Chèn sau trang 14 “Kiến trúc EfficientNet-B0”, trước “Cấu hình huấn luyện”:

15. Backbone EfficientNet-B0 chi tiết: stem, 7 stage, conv head; kích thước, kernel, số lần lặp và stride.
16. Head phân loại và hai checkpoint: Dropout 0,3, Linear 1280→256, ReLU, Dropout, Linear cuối; Binary/8 lớp có trọng số riêng.
17. MBConv & SE: expansion, depthwise, SE, projection, điều kiện residual và khác biệt MBConv1/6.

Dựng lại sơ đồ theo khổ 16:9 để dễ đọc, dùng nền/layout và kiểu chữ của file mới gửi. Giữ 32 trang gốc, chỉ cập nhật số trang sau điểm chèn. Compound scaling vẫn nằm trong [bộ sơ đồ chi tiết](../architecture); không thêm vào luồng trình bày chính.

Đã kiểm tra đủ 35 trang, đối chiếu chữ/bảng/biểu đồ/ảnh/ghi chú của 32 trang gốc. Bản xuất PDF của các trang cũ giống bản gốc ở phần nội dung (ngoài vùng chân trang đổi số); chữ của các trang mới xuất đủ và nằm trong trang. Chưa kiểm tra trực tiếp trên PowerPoint Windows.

![Ba trang mô hình](Xem_truoc_3_trang_mo_hinh.jpg)
