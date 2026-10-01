"""
DermaScan AI - Web Application (Vietnamese)
EfficientNet-B0 skin cancer classification
"""
import os
import io
import base64
import traceback

import torch
import torch.nn as nn
import timm
import numpy as np
from PIL import Image
from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
from torchvision import transforms
from pytorch_grad_cam import GradCAM
from pytorch_grad_cam.utils.image import show_cam_on_image
from pytorch_grad_cam.utils.model_targets import ClassifierOutputTarget

# ============================================================
# CONFIG
# ============================================================
BASE = r'D:\DoAnTriTueNhanTao\skin_cancer'
DEVICE = 'cuda' if torch.cuda.is_available() else 'cpu'

CLASSES = ['MEL', 'NV', 'BCC', 'AK', 'BKL', 'DF', 'VASC', 'SCC']
MALIGNANT = ['MEL', 'BCC', 'SCC', 'AK']

# ============================================================
# CLASS KNOWLEDGE BASE - Tiếng Việt
# ============================================================
CLASS_INFO = {
    'MEL': {
        'name_vi': 'U hắc tố (Melanoma)',
        'short_vi': 'U hắc tố',
        'is_malignant': True,
        'risk_level': 'Rất cao',
        'description': 'U hắc tố là loại ung thư da nguy hiểm nhất, xuất phát từ tế bào sản sinh sắc tố melanin. Bệnh có thể di căn nhanh sang các cơ quan khác nếu không phát hiện và điều trị kịp thời.',
        'detail': 'Nếu được phát hiện ở giai đoạn sớm (khi tổn thương còn khu trú ở lớp biểu bì), tỷ lệ sống trên 5 năm có thể lên tới 98%.',
    },
    'NV': {
        'name_vi': 'Nốt ruồi lành tính (Nevus)',
        'short_vi': 'Nốt ruồi',
        'is_malignant': False,
        'risk_level': 'Không',
        'description': 'Nốt ruồi thông thường, lành tính. Đây là tổn thương da rất phổ biến ở mọi người, hình thành do sự tập trung của các tế bào hắc tố.',
        'detail': 'Hầu hết nốt ruồi đều vô hại. Tuy nhiên nên chú ý nếu nốt ruồi có sự thay đổi bất thường (to ra, đổi màu, chảy máu).',
    },
    'BCC': {
        'name_vi': 'Ung thư tế bào đáy (Basal Cell Carcinoma)',
        'short_vi': 'UT tế bào đáy',
        'is_malignant': True,
        'risk_level': 'Trung bình - Cao',
        'description': 'Ung thư da phổ biến nhất ở người da sáng. Phát triển chậm, ít di căn xa nhưng có thể xâm lấn mô xung quanh nếu không điều trị.',
        'detail': 'Tiên lượng rất tốt nếu được điều trị sớm. Tỷ lệ tái phát thấp sau phẫu thuật cắt bỏ hoàn toàn.',
    },
    'AK': {
        'name_vi': 'Dày sừng ánh sáng (Actinic Keratosis)',
        'short_vi': 'Dày sừng ánh sáng',
        'is_malignant': True,
        'risk_level': 'Trung bình',
        'description': 'Tổn thương tiền ung thư do tiếp xúc với tia UV lâu dài. Có thể tiến triển thành ung thư tế bào vảy nếu không được điều trị.',
        'detail': 'Khoảng 5-10% trường hợp AK tiến triển thành SCC. Điều trị sớm bằng liệu pháp áp lạnh hoặc kem bôi giúp ngăn ngừa tiến triển.',
    },
    'BKL': {
        'name_vi': 'Dày sừng lành tính (Benign Keratosis)',
        'short_vi': 'Dày sừng lành',
        'is_malignant': False,
        'risk_level': 'Không',
        'description': 'Tổn thương lành tính thường gặp ở người trung niên và cao tuổi. Bề mặt sần, màu nâu hoặc đen, trông giống như bị "dán" lên da.',
        'detail': 'Không có nguy cơ ung thư. Có thể loại bỏ vì mục đích thẩm mỹ nếu gây khó chịu hoặc vướng víu.',
    },
    'DF': {
        'name_vi': 'U xơ da (Dermatofibroma)',
        'short_vi': 'U xơ da',
        'is_malignant': False,
        'risk_level': 'Không',
        'description': 'Nốt lành tính ở lớp hạ bì, thường xuất hiện ở cẳng chân hoặc cánh tay. Cứng khi sờ, có thể lõm xuống khi ấn vào.',
        'detail': 'Đây là tổn thương hoàn toàn lành tính. Không cần điều trị trừ khi có triệu chứng khó chịu.',
    },
    'VASC': {
        'name_vi': 'Tổn thương mạch máu (Vascular Lesion)',
        'short_vi': 'Tổn thương mạch',
        'is_malignant': False,
        'risk_level': 'Không',
        'description': 'Các tổn thương mạch máu lành tính như u mạch máu (hemangioma), giãn mạch (angioma), hoặc nốt ruồi đỏ (cherry angioma).',
        'detail': 'Không nguy hiểm. Chỉ cần theo dõi định kỳ và tham khảo bác sĩ nếu có thay đổi về kích thước hoặc chảy máu.',
    },
    'SCC': {
        'name_vi': 'Ung thư tế bào vảy (Squamous Cell Carcinoma)',
        'short_vi': 'UT tế bào vảy',
        'is_malignant': True,
        'risk_level': 'Cao',
        'description': 'Ung thư da ác tính phổ biến thứ hai sau BCC. Có khả năng di căn sang hạch bạch huyết và các cơ quan khác nếu không điều trị kịp thời.',
        'detail': 'Tiên lượng tốt nếu phát hiện sớm. Tỷ lệ sống trên 5 năm khoảng 95% cho giai đoạn khu trú.',
    },
}


# ============================================================
# INTERPRETATION ENGINE - Sinh thông điệp diễn giải
# ============================================================
def generate_interpretation(p_malig, pred_class, probs_dict):
    """Sinh thông điệp diễn giải bằng tiếng Việt dựa trên xác suất."""

    info = CLASS_INFO[pred_class]
    is_malignant = p_malig > 0.5
    confidence = max(p_malig, 1 - p_malig) * 100

    # Phân loại mức độ
    if p_malig >= 0.85:
        severity = 'urgent'
        severity_label = 'KHẨN CẤP'
        severity_note = 'Cần đi khám ngay'
    elif p_malig >= 0.65:
        severity = 'warning'
        severity_label = 'CẦN CHÚ Ý'
        severity_note = 'Nên đi khám sớm'
    elif p_malig >= 0.45:
        severity = 'caution'
        severity_label = 'THEO DÕI'
        severity_note = 'Cần theo dõi thêm'
    else:
        severity = 'normal'
        severity_label = 'LÀNH TÍNH'
        severity_note = 'Không đáng lo ngại'

    # Headline diễn giải theo mức độ
    if p_malig >= 0.85:
        headline = 'Phát hiện dấu hiệu rất đáng ngờ của tổn thương ác tính'
    elif p_malig >= 0.65:
        headline = 'Có dấu hiệu nghi ngờ tổn thương ác tính'
    elif p_malig >= 0.45:
        headline = 'Tổn thương có một số đặc điểm cần theo dõi'
    else:
        headline = 'Không phát hiện dấu hiệu ung thư rõ ràng'

    # Summary chi tiết
    summary = (
        f"Mô hình phân tích hình ảnh và nhận định đây có khoảng "
        f"{confidence:.0f}% khả năng là {info['name_vi']}. "
    )

    if info['is_malignant']:
        if pred_class == 'AK':
            summary += (
                "Đây là tổn thương tiền ung thư — tuy chưa phải ung thư "
                "nhưng cần được xử lý sớm để tránh tiến triển thành ung thư tế bào vảy. "
            )
        else:
            summary += (
                "Đây là tổn thương ác tính — cần được bác sĩ chuyên khoa "
                "đánh giá và có hướng xử lý phù hợp. "
            )
    else:
        summary += (
            "Đây là tổn thương lành tính, không có dấu hiệu ung thư. "
        )

    summary += info['description']

    # Thêm so sánh với lớp thay thế nếu có
    sorted_probs = sorted(probs_dict.items(), key=lambda x: -x[1])
    if len(sorted_probs) > 1 and sorted_probs[1][1] > 0.15:
        alt_cls, alt_prob = sorted_probs[1]
        alt_info = CLASS_INFO[alt_cls]
        summary += (
            f" Ngoài ra, một số đặc điểm trên ảnh cũng có nét tương đồng với "
            f"{alt_info['name_vi']} ({alt_prob * 100:.0f}%), do đó bác sĩ có thể "
            f"cần phân biệt giữa hai tổn thương này."
        )

    # Hành động cụ thể theo mức độ
    if severity == 'urgent':
        actions = [
            'Đặt lịch khám bác sĩ chuyên khoa da liễu trong vòng 1–2 tuần tới.',
            'Chụp ảnh và ghi lại kích thước tổn thương để theo dõi sự thay đổi.',
            'Không tự ý cào, nặn hoặc bôi thuốc lên tổn thương.',
            'Mang theo kết quả phân tích này khi đi khám để bác sĩ tham khảo.',
            'Hạn chế tiếp xúc trực tiếp với ánh nắng mặt trời.',
        ]
        conclusion = (
            "Kết quả này là cảnh báo quan trọng. Việc khám sớm giúp tăng đáng kể "
            "khả năng điều trị thành công nếu tổn thương thực sự ác tính."
        )
    elif severity == 'warning':
        actions = [
            'Nên đặt lịch khám bác sĩ da liễu trong vòng 2–4 tuần.',
            'Theo dõi sự thay đổi về kích thước, màu sắc và hình dạng tổn thương.',
            'Bảo vệ vùng da bằng kem chống nắng có SPF 50+ khi ra ngoài.',
            'Tránh tiếp xúc với ánh nắng trong khoảng 10h–16h.',
            'Chụp ảnh so sánh mỗi tuần để phát hiện thay đổi sớm.',
        ]
        conclusion = (
            "Tổn thương có một số đặc điểm cần được bác sĩ kiểm tra kỹ hơn. "
            "Không nên quá lo lắng nhưng cũng không nên chủ quan."
        )
    elif severity == 'caution':
        actions = [
            'Theo dõi tổn thương trong 4–6 tuần tới.',
            'Nếu tổn thương có thay đổi bất thường, đi khám ngay.',
            'Chụp ảnh định kỳ để so sánh.',
            'Tham khảo ý kiến bác sĩ nếu cảm thấy lo lắng.',
        ]
        conclusion = (
            "Kết quả phân tích chưa đủ rõ ràng để kết luận. Cần theo dõi thêm "
            "và thăm khám nếu có bất kỳ thay đổi nào."
        )
    else:
        actions = [
            'Kiểm tra da định kỳ 6–12 tháng một lần.',
            'Sử dụng kem chống nắng hàng ngày để bảo vệ da.',
            'Chú ý nếu có nốt ruồi mới xuất hiện hoặc nốt cũ thay đổi.',
            'Duy trì lối sống lành mạnh, không hút thuốc lá.',
        ]
        conclusion = (
            "Kết quả khả quan. Tiếp tục duy trì thói quen chăm sóc da tốt "
            "và kiểm tra định kỳ để phòng ngừa."
        )

    return {
        'severity': severity,
        'severity_label': severity_label,
        'severity_note': severity_note,
        'headline': headline,
        'summary': summary,
        'detail': info['detail'],
        'actions': actions,
        'conclusion': conclusion,
        'class_info': {
            'name_vi': info['name_vi'],
            'short_vi': info['short_vi'],
            'is_malignant': info['is_malignant'],
            'risk_level': info['risk_level'],
        },
    }


# ============================================================
# MODEL
# ============================================================
class SkinCancerEfficientNet(nn.Module):
    def __init__(self, backbone='efficientnet_b0', num_classes=2, dropout=0.3):
        super().__init__()
        self.backbone = timm.create_model(backbone, pretrained=False, num_classes=0)
        feat_dim = self.backbone.num_features
        self.head = nn.Sequential(
            nn.Dropout(dropout),
            nn.Linear(feat_dim, 256),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(256, num_classes)
        )

    def forward(self, x):
        return self.head(self.backbone(x))


print(f"[BOOT] Device: {DEVICE}")
print("[BOOT] Loading binary classifier...")
model_bin = SkinCancerEfficientNet(num_classes=2, dropout=0.3).to(DEVICE)
model_bin.load_state_dict(torch.load(
    f'{BASE}/checkpoints/best_binary.pth', map_location=DEVICE))
model_bin.eval()

print("[BOOT] Loading multiclass classifier...")
model_mc = SkinCancerEfficientNet(num_classes=8, dropout=0.4).to(DEVICE)
model_mc.load_state_dict(torch.load(
    f'{BASE}/checkpoints/best_multiclass.pth', map_location=DEVICE))
model_mc.eval()
print("[BOOT] Models ready.")

preprocess = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
])

# ============================================================
# FLASK
# ============================================================
app = Flask(__name__, template_folder='templates', static_folder='static')
CORS(app)


def to_b64(pil_img, fmt='PNG'):
    buf = io.BytesIO()
    pil_img.save(buf, format=fmt)
    return base64.b64encode(buf.getvalue()).decode('utf-8')


def arr_to_b64(arr):
    return to_b64(Image.fromarray(arr))


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/health')
def health():
    return jsonify({
        'status': 'ok',
        'device': DEVICE,
        'gpu': torch.cuda.get_device_name(0) if torch.cuda.is_available() else None,
    })


@app.route('/predict', methods=['POST'])
def predict():
    try:
        if 'image' not in request.files:
            return jsonify({'error': 'Chưa có ảnh được tải lên'}), 400

        file = request.files['image']
        if not file.filename:
            return jsonify({'error': 'Tên file không hợp lệ'}), 400

        pil_img = Image.open(file.stream).convert('RGB')
        w, h = pil_img.size

        preview = pil_img.resize((420, 420), Image.LANCZOS)
        preview_b64 = to_b64(preview, fmt='JPEG')

        inp = preprocess(pil_img).unsqueeze(0).to(DEVICE)

        with torch.no_grad():
            logits_bin = model_bin(inp)
            p_malig = torch.softmax(logits_bin, dim=1)[0, 1].item()

            logits_mc = model_mc(inp)
            probs_mc = torch.softmax(logits_mc, dim=1)[0].cpu().numpy()

        pred_idx = int(probs_mc.argmax())
        pred_class = CLASSES[pred_idx]
        probs_dict = {c: float(p) for c, p in zip(CLASSES, probs_mc)}

        # Grad-CAM
        rgb_img = np.array(pil_img.resize((224, 224))) / 255.0
        with GradCAM(model=model_mc,
                     target_layers=[model_mc.backbone.conv_head]) as cam:
            gray = cam(input_tensor=inp,
                       targets=[ClassifierOutputTarget(pred_idx)])[0]
        cam_vis = show_cam_on_image(rgb_img.astype(np.float32), gray, use_rgb=True)
        gradcam_b64 = arr_to_b64((cam_vis * 255).astype(np.uint8))

        # Sinh diễn giải tiếng Việt
        interpretation = generate_interpretation(p_malig, pred_class, probs_dict)

        return jsonify({
            'success': True,
            'original': preview_b64,
            'gradcam': gradcam_b64,
            'binary': {
                'prob_malignant': float(p_malig),
                'prediction': int(p_malig > 0.5),
                'label_vi': 'NGHI NGỜ ÁC TÍNH' if p_malig > 0.5 else 'LÀNH TÍNH',
                'confidence_pct': round(max(p_malig, 1 - p_malig) * 100, 1),
            },
            'multiclass': {
                'pred_class': pred_class,
                'pred_conf': float(probs_mc[pred_idx]),
                'probs': probs_dict,
                'classes': CLASSES,
                'malignant_list': MALIGNANT,
                'name_vi': CLASS_INFO[pred_class]['name_vi'],
            },
            'interpretation': interpretation,
            'meta': {
                'img_size': f'{w} x {h}',
                'device': DEVICE,
            }
        })

    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    print()
    print("=" * 62)
    print("  DERMASCAN AI - MÁY CHỦ ĐANG CHẠY")
    print(f"  Địa chỉ :  http://localhost:5000")
    print(f"  Thiết bị:  {DEVICE}")
    print("=" * 62)
    print()
    app.run(host='0.0.0.0', port=5000, debug=False, threaded=True)