# Hướng dẫn cài đặt và chạy DermaScan AI

## 1. Tạo môi trường Python và cài thư viện

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r skin_cancer\webapp\requirements.txt
pip install -r requirements-database.txt
```

Nếu PowerShell chặn kích hoạt môi trường, có thể bỏ qua lệnh `Activate.ps1` và dùng trực tiếp `\.venv\Scripts\python.exe` thay cho `python`, `pip` trong các bước tiếp theo.

PyTorch có thể cài khá lâu. Máy chỉ cần chạy CPU; không bắt buộc có GPU.

## 4. Tạo cấu hình `.env`

Tại thư mục gốc dự án, tạo file tên `.env` (cùng cấp với `run_app.bat`) với nội dung:

```dotenv
SECRET_KEY=thay-bang-chuoi-bi-mat-ngau-nhien
```

Tạo chuỗi bí mật bằng lệnh sau rồi chép kết quả vào `SECRET_KEY`:

```powershell
python -c "import secrets; print(secrets.token_hex(32))"
```

Không commit hoặc gửi file `.env` lên Git. Cơ sở dữ liệu SQLite sẽ tự tạo trong `instance` khi khởi động. Email SMTP và OpenAI API key chỉ cần cấu hình trong `.env` nếu muốn dùng các chức năng tương ứng; ứng dụng web cơ bản không cần chúng.

## 5. Khởi tạo database và chạy ứng dụng

Đảm bảo terminal đang ở thư mục gốc dự án, sau đó chạy:

```powershell
.\run_app.bat
```

Script sẽ cập nhật schema database, tạo các tài khoản khởi đầu dành cho môi trường phát triển nếu database còn trống, rồi khởi động web server. Mở [http://localhost:5000](http://localhost:5000) nếu trình duyệt không tự mở.

Tài khoản phát triển được tạo tự động:

| Vai trò       | Email                     | Mật khẩu       |
| ------------- | ------------------------- | -------------- |
| Quản trị viên | `admin@dermascan.local`   | `123456123456` |
| Bác sĩ        | `doctor@dermascan.local`  | `123456123456` |
| Người dùng    | `patient@dermascan.local` | `123456123456` |

Các tài khoản này chỉ dành cho chạy thử trên máy cá nhân. Không dùng chúng cho môi trường công khai hoặc triển khai thật.

Để dừng server, nhấn **Ctrl+C** trong cửa sổ đang chạy `run_app.bat`.

## Chạy thủ công (không dùng file `.bat`)

Sau khi tạo `.env` và cài thư viện, chạy các lệnh sau tại thư mục gốc. Hai lệnh đầu thiết lập database; lệnh `setup-initial` có thể chạy lại an toàn trên database đã được thiết lập.

```powershell
python -m flask --app skin_cancer.webapp.database_app db upgrade
python -m flask --app skin_cancer.webapp.database_app setup-initial --local-starter-accounts
python skin_cancer\webapp\app.py
```

## Một số lỗi thường gặp

- **Thiếu `SECRET_KEY`:** kiểm tra `.env` nằm đúng thư mục gốc và có dòng `SECRET_KEY=...`.
- **`python` không được nhận diện:** cài lại Python và bật tùy chọn thêm Python vào `PATH`, hoặc mở terminal mới.
- **Lỗi cài PyTorch:** kiểm tra đang dùng Python 3.11 và thử nâng cấp pip trước khi cài requirements.
- **Cổng 5000 đang được sử dụng:** đóng tiến trình ứng dụng cũ rồi chạy lại.
- **Database đã có dữ liệu:** bước khởi tạo không ghi đè tài khoản hiện có. Giữ nguyên database nếu cần dữ liệu; chỉ xóa database cục bộ khi chủ động muốn tạo lại từ đầu.
