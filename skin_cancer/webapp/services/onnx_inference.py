"""Task 6: Chạy model bằng ONNX Runtime (thay cho PyTorch ở bước dự đoán)."""

from pathlib import Path
import numpy as np

try:
    import onnxruntime as ort
except ImportError:
    ort = None
from PIL import Image

# Giống hệt transforms.Normalize trong app.py
MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32).reshape(1, 3, 1, 1)
STD = np.array([0.229, 0.224, 0.225], dtype=np.float32).reshape(1, 3, 1, 1)


def preprocess_numpy(pil_img):
    """PIL -> numpy (1, 3, 224, 224), tương đương preprocess của PyTorch."""
    img = pil_img.convert("RGB").resize((224, 224), Image.BILINEAR)
    arr = np.asarray(img, dtype=np.float32) / 255.0  # (H, W, 3), giá trị 0..1
    arr = arr.transpose(2, 0, 1)[None]  # (1, 3, H, W)
    return ((arr - MEAN) / STD).astype(np.float32)


def softmax(logits):
    e = np.exp(logits - logits.max(axis=1, keepdims=True))
    return e / e.sum(axis=1, keepdims=True)


class OnnxPredictor:
    """Giữ 2 session ONNX: binary (lành/ác) và multiclass (8 loại)."""

    def __init__(self, ckpt_dir, suffix=""):
        if ort is None:
            raise RuntimeError("Thư viện 'onnxruntime' chưa được cài đặt. Chạy: pip install onnxruntime")
        # suffix = "" -> binary.onnx, multiclass.onnx (FP32)
        # suffix = "_int8" -> binary_int8.onnx, multiclass_int8.onnx
        ckpt_dir = Path(ckpt_dir)
        providers = ["CPUExecutionProvider"]
        self.binary = ort.InferenceSession(
            str(ckpt_dir / f"binary{suffix}.onnx"), providers=providers
        )
        self.multiclass = ort.InferenceSession(
            str(ckpt_dir / f"multiclass{suffix}.onnx"), providers=providers
        )
        weights_path = ckpt_dir / "head_weights.npz"
        if weights_path.is_file():
            data = np.load(weights_path)
            self.W1 = data["W1"]
            self.b1 = data["b1"]
            self.W2 = data["W2"]
            self.b2 = data["b2"]
        else:
            self.W1 = self.b1 = self.W2 = self.b2 = None

    def predict(self, x):
        """x: numpy float32 (1, 3, 224, 224).
        Trả về (xác suất ác tính, mảng xác suất 8 lớp)."""
        bin_logits = self.binary.run(None, {"input": x})[0]
        mc_logits = self.multiclass.run(None, {"input": x})[0]
        p_malig = float(softmax(bin_logits)[0, 1])
        probs_mc = softmax(mc_logits)[0]
        return p_malig, probs_mc

    def predict_with_cam(self, x):
        """Chạy dự đoán đồng thời sinh Grad-CAM analytic trực tiếp từ ONNX feature map,
        hoàn toàn không cần nạp PyTorch hay tốn RAM.
        Trả về: (p_malig, probs_mc, cam_heatmap)"""
        bin_logits = self.binary.run(None, {"input": x})[0]
        mc_out = self.multiclass.run(None, {"input": x})
        mc_logits = mc_out[0]

        p_malig = float(softmax(bin_logits)[0, 1])
        probs_mc = softmax(mc_logits)[0]
        pred_idx = int(probs_mc.argmax())

        cam_224 = None
        if len(mc_out) > 1 and self.W1 is not None:
            feat_map = mc_out[1]  # shape: (1, 1280, 7, 7)
            gap = feat_map[0].mean(axis=(1, 2))
            z1 = self.W1 @ gap + self.b1
            grad_z1 = self.W2[pred_idx] * (z1 > 0)
            w = self.W1.T @ grad_z1
            cam = np.maximum(0, np.tensordot(w, feat_map[0], axes=(0, 0)))
            if cam.max() > 0:
                cam = cam / cam.max()
            cam_img = Image.fromarray((cam * 255).astype(np.uint8)).resize((224, 224), Image.BILINEAR)
            cam_224 = np.array(cam_img, dtype=np.float32) / 255.0

        return p_malig, probs_mc, cam_224
