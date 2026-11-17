# Ghi chú thuyết trình

## 01. Bìa / kết

Giới thiệu đề tài môn Trí tuệ nhân tạo. Nguyên mẫu hỗ trợ nghiên cứu, chưa phải công cụ chẩn đoán lâm sàng.

Nguồn: Báo cáo DOCX, trang bìa.

## 02. Nhóm thực hiện

Không tự gán phân công thành viên chưa được xác nhận.

Nguồn: Báo cáo, trang bìa và Bảng E.1.

## 03. Nội dung trình bày



Nguồn: Bố cục theo yêu cầu người dùng.

## 04. Tính cấp thiết của đề tài

Không thêm số liệu dịch tễ ngoài báo cáo.

Nguồn: Báo cáo §1.1–1.2.

## 05. Mục tiêu và phạm vi



Nguồn: Báo cáo §1.2–1.3.

## 06. Use case tổng quát

Ảnh được dựng từ mô hình UML với actor dạng người que, không phải ảnh chụp WhiteStarUML. Ẩn use case đăng nhập dùng chung để sơ đồ tổng quan dễ đọc.

Nguồn: Dữ liệu từ DermaScan_AI_WhiteStarUML.uml; báo cáo §3.10, §3.14.

## 07. Sơ đồ lớp dữ liệu cốt lõi

Sơ đồ rút gọn thuộc tính, thể hiện các lớp dữ liệu ORM. File .uml có thêm liên kết trực tiếp với Case; đây không phải ảnh chụp ứng dụng WhiteStarUML.

Nguồn: Dữ liệu từ file .uml; báo cáo §3.12 và Phụ lục F.

## 08. Quy trình nghiên cứu



Nguồn: Báo cáo §3.1–3.9.

## 09. Dữ liệu ISIC 2019

Tập dữ liệu công khai có 25.331 ảnh thuộc tám nhóm tổn thương; đây không phải tám loại ung thư.

Nguồn: Báo cáo, Bảng 4.1.

## 10. Chia tập và quy ước nhãn

Chia phân tầng theo tám nhãn, random_state=42. Không trùng image ID; chưa xác nhận độc lập theo bệnh nhân.

Nguồn: Báo cáo §3.2; Bảng 3.1, 4.2–4.3.

## 11. Tiền xử lý ảnh

Augmentation chỉ áp dụng ở Train và không làm tăng số bản ghi metadata. Chuẩn hóa ImageNet.

Nguồn: Báo cáo §3.3.

## 12. Kiến trúc EfficientNet-B0

Hai checkpoint riêng. Binary có 2 logit và Softmax; không dùng mô tả sigmoid một logit.

Nguồn: Báo cáo §3.4–3.5; app.py, SkinCancerEfficientNet.

## 13. Cấu hình huấn luyện

Binary dùng AdamW LR 10^-3, weight decay 10^-4, CosineAnnealingLR T_max15; Multi-class có label smoothing và LR tách backbone/head.

Nguồn: Báo cáo §3.4–3.6.

## 14. Đánh giá mô hình

Đánh giá trên Test nội bộ. Grad-CAM chỉ hỗ trợ quan sát, không chứng minh suy luận lâm sàng đúng.

Nguồn: Báo cáo §3.7–3.8.

## 15. Ứng dụng minh họa: DermaScan AI



Nguồn: Báo cáo §3.11, §3.13; §4.9–4.11.

## 16. 3.1  Môi trường thực nghiệm

Không tự gán VRAM, tổng thời gian hay phiên bản khi báo cáo chưa có log.

Nguồn: Báo cáo §3.6; Google Colab/GPU T4 theo thông tin người dùng.

## 17. 3.2  Kết quả huấn luyện

Biểu đồ nối các mốc epoch thật trích từ báo cáo, không phải toàn bộ lịch sử. Không kết luận mô hình hoàn toàn không overfit.

Nguồn: Báo cáo, Bảng 4.4 và 4.7.

## 18. Kết quả Binary trên tập Test

Test nội bộ 3800 ảnh, ngưỡng0.5. Nhãn1 quy ước gồm MEL,BCC,AK,SCC. TN2118 FP280 FN242 TP1160.

Nguồn: Báo cáo, Bảng 4.5–4.6.

## 19. Kết quả phân loại tám lớp

Biểu đồ F1 theo lớp. Accuracy81.63%, BalancedAccuracy78.15%, MacroF1.7547, Kappa.7305.

Nguồn: Báo cáo §4.5; Bảng 4.9.

## 20. Phân tích những lỗi đáng chú ý



Nguồn: Báo cáo, Bảng 4.8–4.9.

## 21. So sánh hai cách phân loại Binary

Cùng 3800 ảnh và quy ước gộp nhãn. Binary trực tiếp có AUC cao hơn, cách suy ra có Accuracy/Recall/F1 cao hơn; không có phương án thắng mọi chỉ số.

Nguồn: Báo cáo, Bảng 4.10.

## 22. Minh họa Grad-CAM

Ảnh các trường hợp dự đoán đúng. Bản đồ nhiệt không phải phân đoạn và không bảo đảm giải thích y khoa đúng.

Nguồn: Báo cáo §4.7; ảnh hiện vật thật trong dự án.

## 23. Hiện vật triển khai mô hình

Dung lượng theo báo cáo; không suy ra thời gian tăng tốc từ tỷ lệ giảm kích thước.

Nguồn: Báo cáo, Bảng 4.11; §4.8.

## 24. Giao diện ứng dụng minh họa

Ảnh giữ giao diện thật; không tuyên bố toàn bộ chức năng đã nghiệm thu. SMTP và OpenAI phụ thuộc cấu hình.

Nguồn: Báo cáo §4.9–4.12; ảnh giao diện thực tế trong môi trường hiện tại.

## 25. DEMO

Trang chỉ có tiêu đề DEMO.

Nguồn: Theo yêu cầu.

## 26. Kết luận



Nguồn: Báo cáo, Kết luận và kiến nghị.

## 27. Hạn chế và hướng phát triển



Nguồn: Báo cáo, Hạn chế và kiến nghị; §2.1.3; §4.12.

## 28. Bìa / kết

Cảm ơn và mời câu hỏi, góp ý.

Nguồn: Nhóm 4 · Đại học An Giang.