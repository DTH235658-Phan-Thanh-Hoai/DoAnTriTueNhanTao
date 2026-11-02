// Task 1: Modal cho bác sĩ vẽ polygon khoanh vùng tổn thương.
//
// openFocusRegionModal(file, oldPoints) trả về Promise:
//   - mảng điểm [[x, y], ...] (toạ độ 0..1) nếu bấm "Lưu vùng"
//   - mảng rỗng []              nếu bấm "Xóa vùng đã lưu"
//   - null                      nếu bấm "Hủy"

function openFocusRegionModal(file, oldPoints) {
  return new Promise((resolve) => {
    const opener = document.activeElement;
    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      // Co ảnh cho vừa màn hình, giữ nguyên tỉ lệ
      const scale = Math.min(
        700 / img.width,
        (window.innerHeight * 0.65) / img.height,
        1,
      );
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.style.cssText =
        "cursor:crosshair;display:block;border-radius:6px;";
      canvas.tabIndex = 0;
      canvas.setAttribute("aria-label", "Ảnh khoanh vùng tổn thương");
      canvas.setAttribute("aria-describedby", "focus-region-keyboard-hint");
      canvas.addEventListener("focus", () => {
        canvas.style.outline = "3px solid #1c6730";
        canvas.style.outlineOffset = "3px";
      });
      canvas.addEventListener("blur", () => {
        canvas.style.outline = "";
      });
      const ctx = canvas.getContext("2d");

      // Điểm lưu theo pixel canvas, đổi sang 0..1 khi trả về
      let points = (oldPoints || []).map(([x, y]) => [
        x * canvas.width,
        y * canvas.height,
      ]);
      let cursor = [canvas.width / 2, canvas.height / 2];
      let pointStatus;

      function draw() {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        if (points.length >= 2) {
          ctx.beginPath();
          points.forEach(([x, y], i) =>
            i ? ctx.lineTo(x, y) : ctx.moveTo(x, y),
          );
          if (points.length >= 3) {
            ctx.closePath();
            ctx.fillStyle = "rgba(255, 200, 0, 0.25)";
            ctx.fill();
          }
          ctx.strokeStyle = "#ffc800";
          ctx.lineWidth = 2;
          ctx.stroke();
        }
        points.forEach(([x, y]) => {
          ctx.beginPath();
          ctx.arc(x, y, 4, 0, Math.PI * 2);
          ctx.fillStyle = "#ff3b30";
          ctx.fill();
        });
        ctx.beginPath();
        ctx.moveTo(cursor[0] - 7, cursor[1]);
        ctx.lineTo(cursor[0] + 7, cursor[1]);
        ctx.moveTo(cursor[0], cursor[1] - 7);
        ctx.lineTo(cursor[0], cursor[1] + 7);
        ctx.strokeStyle = "#1c6730";
        ctx.lineWidth = 2;
        ctx.stroke();
        saveBtn.disabled = points.length < 3;
        if (pointStatus) {
          pointStatus.textContent = `${points.length} điểm đã chọn.`;
        }
      }

      canvas.addEventListener("click", (e) => {
        const rect = canvas.getBoundingClientRect();
        cursor = [
          ((e.clientX - rect.left) * canvas.width) / rect.width,
          ((e.clientY - rect.top) * canvas.height) / rect.height,
        ];
        points.push(cursor.slice());
        draw();
      });
      canvas.addEventListener("keydown", (e) => {
        const step = e.shiftKey
          ? 1
          : Math.max(1, Math.round(Math.min(canvas.width, canvas.height) * 0.02));
        const moves = {
          ArrowUp: [0, -step],
          ArrowDown: [0, step],
          ArrowLeft: [-step, 0],
          ArrowRight: [step, 0],
        };
        if (moves[e.key]) {
          cursor = [
            Math.max(0, Math.min(canvas.width, cursor[0] + moves[e.key][0])),
            Math.max(0, Math.min(canvas.height, cursor[1] + moves[e.key][1])),
          ];
          draw();
          e.preventDefault();
        } else if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
          points.push(cursor.slice());
          draw();
          e.preventDefault();
        }
      });

      // ----- giao diện modal -----
      const overlay = document.createElement("div");
      overlay.style.cssText =
        "position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9999;" +
        "display:flex;align-items:center;justify-content:center;";
      const box = document.createElement("div");
      box.setAttribute("role", "dialog");
      box.setAttribute("aria-modal", "true");
      box.setAttribute("aria-label", "Khoanh vùng tổn thương");
      box.tabIndex = -1;
      box.style.cssText =
        "background:#fff;padding:16px;border-radius:10px;max-width:95vw;";

      const hint = document.createElement("p");
      hint.textContent =
        "Bấm lên ảnh để chấm các điểm quanh vùng tổn thương (tối thiểu 3 điểm).";
      hint.style.cssText = "margin:0 0 8px;font-size:14px;";
      hint.id = "focus-region-keyboard-hint";
      hint.textContent += " Dùng phím mũi tên để di chuyển, Enter hoặc Space để thêm điểm; Shift + mũi tên di chuyển chậm.";

      pointStatus = document.createElement("p");
      pointStatus.setAttribute("role", "status");
      pointStatus.setAttribute("aria-live", "polite");
      pointStatus.style.cssText = "margin:0;font-size:13px;";

      const bar = document.createElement("div");
      bar.style.cssText =
        "display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;";

      function makeButton(text, onClick) {
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = text;
        b.className = "workflow-small-btn";
        b.addEventListener("click", onClick);
        bar.append(b);
        return b;
      }

      function close(result) {
        URL.revokeObjectURL(url);
        overlay.remove();
        if (opener && typeof opener.focus === "function") opener.focus();
        resolve(result);
      }

      makeButton("Hoàn tác điểm cuối", () => {
        points.pop();
        draw();
      });
      makeButton("Vẽ lại", () => {
        points = [];
        draw();
      });
      makeButton("Xóa vùng đã lưu", () => close([]));
      makeButton("Hủy", () => close(null));
      const saveBtn = makeButton("Lưu vùng", () =>
        close(points.map(([x, y]) => [x / canvas.width, y / canvas.height])),
      );
      saveBtn.classList.add("primary");

      box.append(hint, canvas, pointStatus, bar);
      box.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
          close(null);
          e.preventDefault();
          return;
        }
        if (e.key !== "Tab") return;
        const focusable = [canvas, ...bar.children].filter((item) => !item.disabled);
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          last.focus();
          e.preventDefault();
        } else if (!e.shiftKey && document.activeElement === last) {
          first.focus();
          e.preventDefault();
        }
      });
      overlay.append(box);
      document.body.append(overlay);
      draw();
      canvas.focus();
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}
