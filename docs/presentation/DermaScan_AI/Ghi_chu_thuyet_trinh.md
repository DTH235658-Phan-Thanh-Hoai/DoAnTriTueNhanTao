# Ghi chú thuyết trình DermaScan AI

## Slide 01 — ỨNG DỤNG EFFICIENTNET-B0

Giới thiệu đề tài môn Trí tuệ nhân tạo. DermaScan AI là nguyên mẫu hỗ trợ phân tích, không thay thế chẩn đoán lâm sàng.

Nguồn: Báo cáo DermaScan AI, tháng 11/2026.

## Slide 02 — NHÓM SINH VIÊN THỰC HIỆN

Giới thiệu bốn thành viên. Không dùng phân công của đề tài RAG vì khác đề tài và báo cáo hiện chưa xác nhận phân công.

Nguồn: Báo cáo DermaScan AI, tháng 11/2026.

## Slide 03 — BỐ CỤC TRÌNH BÀY

Trình bày nội dung trên slide, không đọc nguyên văn.

Nguồn: Báo cáo DermaScan AI, tháng 11/2026.

## Slide 04 — VÌ SAO CẦN NGHIÊN CỨU ĐỀ TÀI?

Nêu khó khăn về hình thái tổn thương, biến thiên ảnh và nhu cầu hỗ trợ bác sĩ. Không đưa số liệu dịch tễ ngoài báo cáo.

Nguồn: Báo cáo, §1.1–1.2; §2.1.

## Slide 05 — MỤC TIÊU VÀ PHẠM VI

Trình bày nội dung trên slide, không đọc nguyên văn.

Nguồn: Báo cáo, §1.2–1.3.

## Slide 06 — USE CASE TỔNG QUÁT

Sơ đồ khái quát, không liệt kê toàn bộ API. ADMIN có quyền rộng hơn; các tác vụ gắn ca đều cần kiểm tra quyền sở hữu.

Nguồn: Vẽ lại theo báo cáo §3.10, §3.14 và mã nguồn phân quyền.

## Slide 07 — SƠ ĐỒ LỚP DỮ LIỆU CỐT LÕI

Đây là class diagram các lớp dữ liệu ORM, không phải sơ đồ đầy đủ toàn hệ thống. Dấu ? chỉ thuộc tính tùy chọn. Multiplicity giữ theo cấu trúc dữ liệu, không giả định AnalysisResult là quan hệ 1–1.

Nguồn: Báo cáo §3.12, Phụ lục F; đối chiếu models/*.py.

## Slide 08 — QUY TRÌNH NGHIÊN CỨU

Trình bày nội dung trên slide, không đọc nguyên văn.

Nguồn: Báo cáo §3.1–3.9.

## Slide 09 — DỮ LIỆU ISIC 2019: 25.331 ẢNH

NV chiếm 50,83%; DF chỉ 239 ảnh. Không gọi tám nhãn là tám loại ung thư. Dữ liệu thuộc tập huấn luyện công khai của ISIC 2019.

Nguồn: Báo cáo, Bảng 4.1.

## Slide 10 — CHIA TẬP VÀ QUY ƯỚC NHÃN

Trình bày nội dung trên slide, không đọc nguyên văn.

Nguồn: Báo cáo §3.2; Bảng 3.1, 4.2–4.3.

## Slide 11 — TIỀN XỬ LÝ VÀ TĂNG CƯỜNG DỮ LIỆU

Augmentation không làm tăng số bản ghi trong bảng Train. Ảnh được chuyển RGB và chuẩn hóa theo ImageNet. Resize vuông có thể làm biến dạng tỷ lệ tổn thương.

Nguồn: Báo cáo §3.3.

## Slide 12 — KIẾN TRÚC EFFICIENTNET-B0

Không mô tả Binary là sigmoid một logit. Hai checkpoint riêng cho hai nhiệm vụ. Backbone tạo vector 1.280 chiều; head 256 chiều, ReLU, Dropout, Linear.

Nguồn: Báo cáo §3.4–3.5; app.py: SkinCancerEfficientNet.

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

## Slide 17 — 3.2  KẾT QUẢ HUẤN LUYỆN

Các điểm là trích lịch sử thật trong báo cáo, không phải toàn bộ epoch. Val AUC Binary cao nhất được nêu là 0,9419; Test AUC là 0,9366, cần phân biệt.

Nguồn: Báo cáo, Bảng 4.4 và 4.7.

## Slide 18 — KẾT QUẢ BINARY TRÊN 3.800 ẢNH TEST

TN=2118, FP=280, FN=242, TP=1160. Recall 82,74%, F1 0,8163, ROC-AUC 0,9366. FN vẫn là hạn chế quan trọng.

Nguồn: Báo cáo, Bảng 4.5–4.6.

## Slide 19 — KẾT QUẢ PHÂN LOẠI TÁM LỚP

Trình bày nội dung trên slide, không đọc nguyên văn.

Nguồn: Báo cáo, §4.5; Bảng 4.9.

## Slide 20 — PHÂN TÍCH LỖI: CÁC NHÓM CẦN CHÚ Ý

MEL bị nhầm sang NV 143 ảnh. SCC chỉ có 94 mẫu test, recall 55,3%. VASC recall cao nhưng support 38 nên cần thận trọng khi diễn giải.

Nguồn: Báo cáo, Bảng 4.8–4.9.

## Slide 21 — BINARY TRỰC TIẾP HAY SUY RA TỪ TÁM LỚP?

Multi-class suy ra Binary có Accuracy, Recall, F1 cao hơn ở thí nghiệm này; Binary trực tiếp có AUC cao hơn. Không kết luận một cách thắng mọi chỉ số.

Nguồn: Báo cáo, Bảng 4.10.

## Slide 22 — GRAD-CAM: QUAN SÁT VÙNG MÔ HÌNH CHÚ Ý

Hình có sẵn trong dự án; không tạo bản đồ nhiệt giả. Vùng sáng không phải phân đoạn tổn thương hay chứng minh lý giải lâm sàng.

Nguồn: Báo cáo §4.7; hình Grad-CAM từ hiện vật của dự án.

## Slide 23 — HIỆN VẬT TRIỂN KHAI: PYTORCH / ONNX / INT8

Kích thước theo số liệu báo cáo, không suy ra tốc độ. Cần benchmark cùng phần cứng và cùng tập ảnh trước khi khẳng định tăng tốc hay bảo toàn chất lượng.

Nguồn: Báo cáo, Bảng 4.11; §4.8.

## Slide 24 — ỨNG DỤNG MINH HỌA: GIAO DIỆN VÀ CHỨC NĂNG

Ảnh chụp trang chủ thực tế. Các chức năng dưới đây được mô tả theo báo cáo và mã nguồn; không tuyên bố toàn bộ test case đã nghiệm thu. SMTP/OpenAI phụ thuộc cấu hình.

Nguồn: Báo cáo §4.9–4.12; ảnh chụp ứng dụng trong môi trường hiện tại.

## Slide 25 — DEMO

Mở ứng dụng và trình diễn trực tiếp; không thêm nội dung trên slide.

Nguồn: Theo yêu cầu.

## Slide 26 — KẾT LUẬN

Trình bày nội dung trên slide, không đọc nguyên văn.

Nguồn: Báo cáo, Kết luận và kiến nghị.

## Slide 27 — HẠN CHẾ VÀ HƯỚNG PHÁT TRIỂN

Trình bày nội dung trên slide, không đọc nguyên văn.

Nguồn: Báo cáo, Hạn chế và kiến nghị; §2.1.3; §4.12.

## Slide 28 — CẢM ƠN THẦY VÀ CÁC BẠN

Trình bày nội dung trên slide, không đọc nguyên văn.

Nguồn: Nhóm 4 · Đồ án môn Trí tuệ nhân tạo · Đại học An Giang