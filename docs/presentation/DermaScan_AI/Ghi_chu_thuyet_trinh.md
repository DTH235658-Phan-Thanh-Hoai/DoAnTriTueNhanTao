# Ghi chú thuyết trình DermaScan AI

## Slide 01 — DERMASCAN AI

Giới thiệu đề tài: ứng dụng EfficientNet-B0 phân loại tổn thương da từ ảnh Dermoscopy. Đây là nguyên mẫu hỗ trợ phân tích, không thay thế chẩn đoán lâm sàng.

Nguồn: Đồ án môn Trí tuệ nhân tạo · Đại học An Giang · Tháng 11/2026

## Slide 02 — Bốn thành viên. Một quy trình nghiên cứu.

Giới thiệu bốn thành viên theo báo cáo; không tự gán phân công chưa được xác nhận.

Nguồn: Báo cáo DermaScan AI, tháng 11/2026.

## Slide 03 — BỐ CỤC TRÌNH BÀY

Trình bày nội dung trên slide, không đọc nguyên văn.

Nguồn: Báo cáo DermaScan AI, tháng 11/2026.

## Slide 04 — Ảnh giống nhau. Quyết định không đơn giản.

Đặc điểm hình thái có thể tương đồng giữa các nhóm tổn thương; AI được định vị là công cụ hỗ trợ.

Nguồn: Báo cáo, §1.1–1.2; §2.1.

## Slide 05 — MỤC TIÊU VÀ PHẠM VI

Trình bày nội dung trên slide, không đọc nguyên văn.

Nguồn: Báo cáo, §1.2–1.3.

## Slide 06 — Ba vai trò trong một hệ thống.

Sơ đồ chức năng chính. Xác thực dùng chung; ADMIN có phạm vi quản lý rộng hơn. Các quyền gắn tài nguyên đều được kiểm tra theo ca.

Nguồn: Vẽ lại theo báo cáo §3.10, §3.14; đối chiếu mã nguồn phân quyền.

## Slide 07 — Dữ liệu theo ca, kết quả theo lần phân tích.

Sơ đồ rút gọn các lớp dữ liệu. File UML kèm theo có thêm các liên kết trực tiếp với Case. Quan hệ AnalysisResult giữ 1–n theo schema.

Nguồn: Báo cáo §3.12, Phụ lục F; models/*.py.

## Slide 08 — QUY TRÌNH NGHIÊN CỨU

Trình bày nội dung trên slide, không đọc nguyên văn.

Nguồn: Báo cáo §3.1–3.9.

## Slide 09 — DỮ LIỆU ISIC 2019: 25.331 ẢNH

NV chiếm 50,83%; DF chỉ 239 ảnh. Không gọi tám nhãn là tám loại ung thư. Dữ liệu thuộc tập huấn luyện công khai của ISIC 2019.

Nguồn: Báo cáo, Bảng 4.1.

## Slide 10 — 70 / 15 / 15 — tách tập trước khi học.

Trình bày nội dung trên slide, không đọc nguyên văn.

Nguồn: Báo cáo §3.2; Bảng 3.1, 4.2–4.3.

## Slide 11 — TIỀN XỬ LÝ VÀ TĂNG CƯỜNG DỮ LIỆU

Augmentation không làm tăng số bản ghi trong bảng Train. Ảnh được chuyển RGB và chuẩn hóa theo ImageNet. Resize vuông có thể làm biến dạng tỷ lệ tổn thương.

Nguồn: Báo cáo §3.3.

## Slide 12 — Một kiến trúc. Hai nhiệm vụ phân loại.

Binary có hai logit và Softmax, không dùng mô tả một logit với sigmoid. Head gồm Dropout, Linear 256, ReLU, Dropout, Linear cuối.

Nguồn: Báo cáo §3.4–3.5; SkinCancerEfficientNet trong app.py.

## Slide 13 — CẤU HÌNH HUẤN LUYỆN

Batch size 32. Binary chọn checkpoint theo Validation ROC-AUC. Multi-class dùng early stopping; không dùng các siêu tham số LoRA của slide mẫu RAG.

Nguồn: Báo cáo §3.4–3.6.

## Slide 14 — ĐÁNH GIÁ VÀ GIẢI THÍCH DỰ ĐOÁN

Trình bày nội dung trên slide, không đọc nguyên văn.

Nguồn: Báo cáo §3.7–3.8; §2.7.

## Slide 15 — DERMASCAN AI: TỪ ẢNH ĐẾN BÁO CÁO

Trình bày nội dung trên slide, không đọc nguyên văn.

Nguồn: Báo cáo §3.11, §3.13; §4.9–4.11.

## Slide 16 — 3.1  MÔI TRƯỜNG THỰC NGHIỆM

Google Colab và GPU T4 do người dùng xác nhận trong yêu cầu. Báo cáo chưa kèm log GPU, VRAM, thời gian tổng hay phiên bản đầy đủ; không tự điền các con số này.

Nguồn: Báo cáo §3.6; thông tin Google Colab / GPU T4 do nhóm cung cấp.

## Slide 17 — Huấn luyện có theo dõi. Chọn bằng Validation.

Đường biểu diễn nối các mốc epoch được trích trong báo cáo. Binary có 15 epoch; Multi-class có 19 dòng log và early stopping. Không kết luận hoàn toàn không overfit.

Nguồn: Báo cáo, Bảng 4.4 và 4.7.

## Slide 18 — 86,26% Accuracy. Còn 242 mẫu bị bỏ sót.

TN 2118, FP 280, FN 242, TP 1160. Nhãn 1 là nhóm nghiên cứu MEL, BCC, AK, SCC. Cần nhấn mạnh giới hạn bỏ sót.

Nguồn: Báo cáo, Bảng 4.5–4.6.

## Slide 19 — KẾT QUẢ PHÂN LOẠI TÁM LỚP

Trình bày nội dung trên slide, không đọc nguyên văn.

Nguồn: Báo cáo, §4.5; Bảng 4.9.

## Slide 20 — PHÂN TÍCH LỖI: CÁC NHÓM CẦN CHÚ Ý

MEL bị nhầm sang NV 143 ảnh. SCC chỉ có 94 mẫu test, recall 55,3%. VASC recall cao nhưng support 38 nên cần thận trọng khi diễn giải.

Nguồn: Báo cáo, Bảng 4.8–4.9.

## Slide 21 — Đánh đổi giữa phân loại và xếp hạng nguy cơ.

Cách suy ra Binary có Accuracy, Recall và F1 cao hơn; Binary trực tiếp có ROC-AUC cao hơn. Không kết luận một phương án thắng mọi chỉ số.

Nguồn: Báo cáo, Bảng 4.10.

## Slide 22 — Mô hình đang chú ý vào đâu?

Ảnh Grad-CAM là hiện vật thật. Bản đồ nhiệt không phải phân đoạn tổn thương và không bảo đảm giải thích đúng về y khoa.

Nguồn: Báo cáo §4.7; hiện vật Grad-CAM của dự án.

## Slide 23 — INT8: gọn hơn khoảng 3,4 lần.

Dung lượng theo báo cáo. Không suy ra thời gian tăng tốc từ tỷ lệ giảm kích thước.

Nguồn: Báo cáo, Bảng 4.11; §4.8.

## Slide 24 — Từ notebook đến giao diện sử dụng.

Ảnh chụp giao diện thật trong môi trường hiện tại; không tuyên bố toàn bộ test case đã nghiệm thu. SMTP và OpenAI phụ thuộc cấu hình.

Nguồn: Báo cáo §4.9–4.12; ảnh chụp ứng dụng hiện tại.

## Slide 25 — DEMO

Mở ứng dụng để trình diễn trực tiếp.

Nguồn: Theo yêu cầu.

## Slide 26 — KẾT LUẬN

Trình bày nội dung trên slide, không đọc nguyên văn.

Nguồn: Báo cáo, Kết luận và kiến nghị.

## Slide 27 — HẠN CHẾ VÀ HƯỚNG PHÁT TRIỂN

Trình bày nội dung trên slide, không đọc nguyên văn.

Nguồn: Báo cáo, Hạn chế và kiến nghị; §2.1.3; §4.12.

## Slide 28 — Cảm ơn thầy và các bạn.

Cảm ơn và mời câu hỏi, góp ý về phương pháp, số liệu và ứng dụng.

Nguồn: Nhóm 4 · Đồ án môn Trí tuệ nhân tạo · Đại học An Giang