FROM python:3.11-slim

# Cài đặt thư viện hệ thống cần thiết cho OpenCV và xử lý ảnh
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Tạo user không phải root (khuyến nghị cho Hugging Face Spaces & bảo mật)
RUN useradd -m -u 1000 user
USER user
ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH \
    PYTHONUNBUFFERED=1 \
    PYTHONUTF8=1 \
    SECRET_KEY=dermascan-online-secret-key-2024 \
    PORT=10000 \
    MODEL_BACKEND=onnx_int8 \
    OMP_NUM_THREADS=1 \
    MKL_NUM_THREADS=1 \
    OPENBLAS_NUM_THREADS=1 \
    VECLIB_MAXIMUM_THREADS=1 \
    NUMEXPR_NUM_THREADS=1

WORKDIR $HOME/app

# Copy requirements trước để tối ưu Docker layer cache
COPY --chown=user requirements-docker.txt .

# Cài PyTorch bản CPU (tiết kiệm ~2GB dung lượng và giảm thời gian build)
RUN pip install --no-cache-dir torch torchvision --index-url https://download.pytorch.org/whl/cpu && \
    pip install --no-cache-dir -r requirements-docker.txt

# Copy toàn bộ mã nguồn vào container
COPY --chown=user . .

# Tạo các thư mục lưu trữ dữ liệu cần thiết
RUN mkdir -p instance uploads reports

# Render lắng nghe cổng 10000 mặc định
EXPOSE 10000

# Khởi tạo database và khởi chạy server gunicorn
CMD ["sh", "-c", "python -m flask --app skin_cancer.webapp.database_app db upgrade && python -m flask --app skin_cancer.webapp.database_app setup-initial --local-starter-accounts || true; exec gunicorn --bind 0.0.0.0:${PORT:-10000} --workers 1 --threads 2 --timeout 180 skin_cancer.webapp.app:app"]
