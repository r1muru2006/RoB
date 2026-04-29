# TODO - RoB Project (Ransomware over Browser)

> Dựa trên bài báo USENIX Security 2023: "RoB: Ransomware over Modern Web Browsers"
> Mục tiêu: Xây dựng PoC tấn công + hệ thống phát hiện + demo phòng thủ

---

## Phase 1: Nghiên cứu & Chuẩn bị môi trường

- [ ] Đọc kỹ tài liệu FSA API: https://wicg.github.io/file-system-access/
- [ ] Đọc security model của FSA API: https://wicg.github.io/file-system-access/#security-ransomware
- [ ] Tìm hiểu WebAssembly (Wasm) cơ bản - cách compile C/C++ sang Wasm
- [ ] Tìm hiểu thư viện Enigma (Wasm-compiled OpenSSL): https://github.com/nicedayzhu/enigma
- [ ] Cài đặt môi trường dev:
  - [ ] Node.js + npm
  - [ ] Chrome/Edge (hỗ trợ FSA API)
  - [ ] Emscripten SDK (compile C sang Wasm)
  - [ ] Python 3 + scikit-learn (cho phần detection)
- [ ] Tạo thư mục test với các file mẫu (docx, xlsx, pdf, txt, jpeg) - mỗi loại 50 file
- [ ] Setup máy ảo (VM) để thử nghiệm an toàn - KHÔNG chạy trên máy thật

---

## Phase 2: Backend Server (Module 1/5)

> Server nhận request từ nạn nhân, tạo cặp khóa, quản lý victim ID

- [ ] Khởi tạo project Node.js: `server/`
- [ ] Tạo REST API endpoints:
  - [ ] `POST /register` - Tạo victim ID + cặp khóa RSA-2048, trả về public key + client ID
  - [ ] `GET /ransom/:victimId` - Trả về trang tống tiền (cho demo)
  - [ ] `POST /decrypt-key/:victimId` - Giả lập trả key sau khi "thanh toán" (cho demo)
- [ ] Database đơn giản (SQLite hoặc JSON file):
  - [ ] Lưu victim_id, public_key, private_key, timestamp
- [ ] Tạo module sinh RSA-2048 key pair (dùng Node.js crypto)
- [ ] Viết unit tests cho từng endpoint

**Cấu trúc thư mục:**
```
server/
├── index.js              # Express server
├── routes/
│   └── api.js            # API routes
├── crypto/
│   └── keygen.js         # RSA key generation
├── db/
│   └── victims.json      # Simple JSON DB
├── package.json
└── tests/
    └── api.test.js
```

---

## Phase 3: Trang Web Phishing - Web UI (Module 2/5)

> Trang web giả dạng ứng dụng hợp pháp để dụ nạn nhân cấp quyền truy cập file

- [ ] Khởi tạo frontend project: `client/`
- [ ] Thiết kế trang web giả dạng (chọn 1):
  - [ ] Option A: Trình chỉnh sửa ảnh online (Image Editor)
  - [ ] Option B: Trình chuyển đổi file (File Converter)
  - [ ] Option C: Trình quản lý file đơn giản (File Manager)
- [ ] Tạo giao diện trông chuyên nghiệp và đáng tin cậy:
  - [ ] Landing page với logo, mô tả tính năng
  - [ ] Nút "Open Folder" / "Select Files" (trigger FSA API)
  - [ ] Progress bar giả (che giấu quá trình mã hóa)
  - [ ] Hiển thị tên file đã "xử lý" để tạo cảm giác bình thường
- [ ] Tích hợp FSA API:
  - [ ] Gọi `window.showDirectoryPicker()` khi user click button
  - [ ] Xử lý permission dialog (read + write)
  - [ ] Lặp qua các file trong directory đã chọn
- [ ] Kết nối với Backend:
  - [ ] Gọi `/register` khi user truy cập lần đầu
  - [ ] Nhận public key từ server

**Cấu trúc thư mục:**
```
client/
├── index.html            # Landing page
├── css/
│   └── style.css
├── js/
│   ├── app.js            # Main app logic
│   ├── fsa.js            # FSA API wrapper
│   └── ui.js             # UI updates
└── assets/
    └── logo.png
```

---

## Phase 4: Module Mã hóa - Encryption (Module 3/5)

> Mã hóa file bằng AES-256-GCM (qua Wasm) + bọc key bằng RSA-2048

### 4A: Encryption bằng WebAssembly
- [ ] Compile thư viện crypto (OpenSSL hoặc tương đương) sang Wasm bằng Emscripten
- [ ] Hoặc: Dùng Web Crypto API của trình duyệt (đơn giản hơn, nhưng khác bài báo)
- [ ] Implement AES-256-GCM encryption:
  - [ ] Hàm `generateAESKey()` - tạo symmetric key ngẫu nhiên
  - [ ] Hàm `encryptFile(fileContent, aesKey)` - mã hóa nội dung file
  - [ ] Hàm `encryptAESKey(aesKey, rsaPublicKey)` - bọc AES key bằng RSA public key
- [ ] Implement `clearMemory()` - ghi đè vùng nhớ chứa key bằng giá trị ngẫu nhiên

### 4B: Module File System Access (Module 4/5)
- [ ] Implement vòng lặp read-encrypt-overwrite:
  ```
  1. showDirectoryPicker() -> lấy dirHandle
  2. Lặp qua dirHandle.values()
  3. Với mỗi file: getFile() -> đọc nội dung
  4. encrypt(content) -> nội dung đã mã hóa
  5. createWritable() -> lấy writable stream
  6. write(encryptedContent) -> ghi đè
  7. close()
  ```
- [ ] Xử lý đệ quy cho subdirectories
- [ ] Thêm filter loại file (chỉ mã hóa docx, xlsx, pdf, txt, jpeg, png)
- [ ] Đo tốc độ mã hóa với các file size khác nhau (1MB, 10MB, 100MB)
- [ ] Lưu AES key đã mã hóa (bằng RSA) gửi về server

### 4C: Module Extortion (Module 5/5)
- [ ] Tạo trang ransom note:
  - [ ] Hiển thị victim ID
  - [ ] Thông báo file đã bị mã hóa
  - [ ] Hiển thị "hướng dẫn thanh toán" (giả lập, KHÔNG dùng crypto thật)
  - [ ] Nút "Verify Payment" (giả lập) -> gọi API lấy key giải mã
- [ ] Redirect đến trang ransom note sau khi mã hóa xong

**Cấu trúc thư mục:**
```
client/js/
├── encryption/
│   ├── aes.js            # AES-256-GCM encrypt/decrypt
│   ├── rsa.js            # RSA key wrapping
│   ├── wasm/             # Compiled Wasm modules (nếu dùng Wasm)
│   │   ├── crypto.wasm
│   │   └── crypto.js     # Wasm glue code
│   └── memory.js         # clearMemory()
├── fsa.js                # FSA API - read/encrypt/overwrite loop
└── extortion.js          # Redirect to ransom page
```

---

## Phase 5: Hệ thống Detection (Giải pháp phòng thủ)

> Xây dựng 3 approach phòng thủ như trong bài báo

### 5A: Approach 1 - Malicious Modification Identification
- [ ] Tạo project: `defense/approach1-modification-detection/`
- [ ] Thu thập dataset:
  - [ ] 500K file gốc (benign) - lấy từ Digital Corpora hoặc tự tạo
  - [ ] 500K file đã mã hóa (malicious) - mã hóa bằng AES-256
  - [ ] 500K file đã chỉnh sửa bình thường (benign modification)
- [ ] Trích xuất features cho mỗi cặp (file gốc, file đã sửa):
  - [ ] **Entropy change**: `entropy(modified) - entropy(original)`
  - [ ] **File size change**: `|size(modified) - size(original)| / size(original)`
- [ ] Train ML classifier:
  - [ ] Random Forest
  - [ ] K-Nearest Neighbor (KNN)
  - [ ] Decision Tree
  - [ ] XGBoost
- [ ] Đánh giá: Accuracy, Recall, Precision, F1, TP, TN, FN, FP
- [ ] 10-fold cross-validation
- [ ] Implement browser extension (hooking script):
  - [ ] Hook `showDirectoryPicker()` -> ghi log thư mục được chọn
  - [ ] Hook `createWritable()` -> chặn ghi, tạo bản copy swap file
  - [ ] Hook `write()` -> so sánh entropy/size của file gốc vs file mới
  - [ ] Nếu phát hiện malicious -> chặn ghi, cảnh báo user
- [ ] Test với evasion techniques:
  - [ ] Partial encryption (chỉ mã hóa 25%)
  - [ ] Low-entropy data padding
  - [ ] Post-encryption encoding (Base64, Base32, Hex)
  - [ ] Custom evasion (kết hợp padding + partial encryption)

**Cấu trúc thư mục:**
```
defense/approach1-modification-detection/
├── dataset/
│   ├── collect_benign.py        # Thu thập file gốc
│   ├── generate_benign_mods.py  # Tạo benign modifications
│   └── generate_malicious.py    # Tạo malicious (encrypted) files
├── features/
│   ├── entropy.py               # Tính entropy
│   └── extract.py               # Trích xuất features
├── classifier/
│   ├── train.py                 # Train 4 classifiers
│   ├── evaluate.py              # Đánh giá performance
│   └── models/                  # Saved models
├── browser_extension/
│   ├── manifest.json
│   ├── background.js
│   ├── content.js               # Hooking script
│   └── popup.html               # UI cảnh báo
└── evasion/
    └── test_evasion.py          # Test adaptive attackers
```

### 5B: Approach 2 - Local Activity Monitoring
- [ ] Tạo project: `defense/approach2-activity-monitoring/`
- [ ] Thu thập dữ liệu hoạt động:
  - [ ] FSA API function calls (hook bằng Node.js script)
  - [ ] System calls (dùng `strace` trên Linux hoặc `lsof` + `strace`)
  - [ ] File system activities (dùng `inotifywait`)
- [ ] Tạo dataset:
  - [ ] Benign: chạy 9 web apps hợp pháp (vscode.dev, photopea, excalidraw, v.v.)
  - [ ] Malicious: chạy RoB với 8 configurations:
    - [ ] RoBEncOne (1 file)
    - [ ] RoBEncHundred (100 files)
    - [ ] RoBReordered (random order API calls)
    - [ ] RoBWithBenign (thêm benign modifications giữa encryptions)
    - [ ] RoBWithBenAPI (thêm benign API calls)
    - [ ] RoBWithEncWait (random wait giữa encryptions)
    - [ ] RoBWithFSAWait (random wait giữa FSA calls)
    - [ ] RoBBothWait (random wait cả hai)
- [ ] N-gram analysis:
  - [ ] 2-gram cho FSA API function calls
  - [ ] 4-gram cho system calls
  - [ ] 1-gram cho file system activities
- [ ] Tính similarity matrix (Euclidean distance, 10% quantile ranges)
- [ ] Tạo heatmap visualization
- [ ] Implement monitoring script:
  - [ ] Hook FSA API calls -> log sequence
  - [ ] Monitor file system với inotifywait -> log events
  - [ ] So sánh patterns real-time với known malicious patterns
  - [ ] Alert khi phát hiện pattern bất thường

**Cấu trúc thư mục:**
```
defense/approach2-activity-monitoring/
├── data_collection/
│   ├── fsa_hook.js              # Hook FSA API calls
│   ├── syscall_monitor.sh       # strace/lsof monitoring
│   └── fs_monitor.sh            # inotifywait monitoring
├── analysis/
│   ├── ngram.py                 # N-gram feature extraction
│   ├── similarity.py            # Euclidean distance matrix
│   └── heatmap.py               # Visualization
├── rob_variants/
│   ├── rob_enc_one.js
│   ├── rob_enc_hundred.js
│   ├── rob_reordered.js
│   ├── rob_with_benign.js
│   ├── rob_with_ben_api.js
│   ├── rob_with_enc_wait.js
│   ├── rob_with_fsa_wait.js
│   └── rob_both_wait.js
└── monitor/
    └── realtime_detector.js     # Real-time detection
```

### 5C: Approach 3 - New UI Design
- [ ] Tạo project: `defense/approach3-new-ui/`
- [ ] Phân tích UI hiện tại của Chrome (chụp screenshot permission dialogs)
- [ ] Thiết kế mockup UI mới cho Read Permission Dialog:
  - [ ] Thêm warning icon
  - [ ] Thêm text "and its subdirectories"
  - [ ] Thêm cảnh báo "might attempt to steal your sensitive information"
  - [ ] Thêm link "Get more information" + "Report suspicious"
- [ ] Thiết kế mockup UI mới cho Write Permission Dialog:
  - [ ] Thêm warning icon
  - [ ] Thêm text "can cause permanent loss of your local data"
  - [ ] Liệt kê danh sách file cụ thể sẽ bị chỉnh sửa
  - [ ] Thêm link "See the impacted files..."
  - [ ] Thêm link "Report it here"
- [ ] Implement UI mới dưới dạng browser extension (Chrome Extension):
  - [ ] Intercept FSA API permission requests
  - [ ] Hiển thị custom dialog thay thế dialog gốc
  - [ ] Ghi log user decisions
- [ ] User study (nếu có thời gian):
  - [ ] So sánh tỷ lệ user cho phép với UI cũ vs UI mới
  - [ ] Đo thời gian ra quyết định

**Cấu trúc thư mục:**
```
defense/approach3-new-ui/
├── mockups/
│   ├── old_read_dialog.png
│   ├── old_write_dialog.png
│   ├── new_read_dialog.png
│   └── new_write_dialog.png
├── chrome_extension/
│   ├── manifest.json
│   ├── background.js
│   ├── intercept.js            # Intercept FSA permission
│   ├── new_dialog.html         # Custom permission dialog
│   ├── new_dialog.css
│   └── new_dialog.js
└── user_study/
    ├── survey.md
    └── results/
```

---

## Phase 6: Tích hợp & Demo End-to-End

- [ ] Tích hợp tất cả modules lại:
  - [ ] Chạy Backend server
  - [ ] Mở trang phishing trên Chrome
  - [ ] Chọn thư mục test -> file bị mã hóa
  - [ ] Redirect đến ransom page
  - [ ] Bật defense -> phát hiện và chặn
- [ ] Quay video demo:
  - [ ] Demo 1: Tấn công thành công (không có defense)
  - [ ] Demo 2: Defense Approach 1 chặn tấn công
  - [ ] Demo 3: Defense Approach 2 phát hiện tấn công
  - [ ] Demo 4: UI mới cảnh báo người dùng
- [ ] Test trên nhiều môi trường:
  - [ ] Windows 10/11 (VM)
  - [ ] Ubuntu 22.04 (VM)
  - [ ] macOS (nếu có)
- [ ] Test với các loại thư mục:
  - [ ] Local directories (Documents, Pictures, Downloads)
  - [ ] Cloud-integrated directories (Google Drive, Dropbox, OneDrive)
  - [ ] External storage (USB)
  - [ ] Network shared folders
- [ ] Đo performance:
  - [ ] Tốc độ mã hóa (MB/s) theo file size
  - [ ] Overhead của detection system
  - [ ] Tỷ lệ phát hiện (TP, FP, FN, TN)

---

## Phase 7: Báo cáo & Tài liệu

- [ ] Viết báo cáo kỹ thuật:
  - [ ] Giới thiệu vấn đề
  - [ ] Mô tả kiến trúc hệ thống
  - [ ] Kết quả thử nghiệm (bảng, biểu đồ)
  - [ ] So sánh với bài báo gốc
  - [ ] Kết luận và hướng phát triển
- [ ] Chuẩn bị slides thuyết trình
- [ ] Cập nhật README.md với hướng dẫn cài đặt và sử dụng
- [ ] Tạo file ETHICS.md - giải thích mục đích nghiên cứu, không phổ biến mã độc
- [ ] Cleanup code, thêm comments cho phần phức tạp
- [ ] Tạo `.gitignore` (loại bỏ node_modules, models, datasets lớn)

---

## Cấu trúc thư mục tổng thể

```
RoB/
├── README.md
├── TODO.md
├── ETHICS.md
├── .gitignore
├── usenixsecurity23-oz.pdf        # Bài báo gốc
│
├── server/                         # Phase 2: Backend
│   ├── index.js
│   ├── routes/
│   ├── crypto/
│   ├── db/
│   └── tests/
│
├── client/                         # Phase 3+4: Phishing site + Encryption
│   ├── index.html
│   ├── css/
│   ├── js/
│   │   ├── app.js
│   │   ├── fsa.js
│   │   ├── ui.js
│   │   ├── extortion.js
│   │   └── encryption/
│   │       ├── aes.js
│   │       ├── rsa.js
│   │       ├── memory.js
│   │       └── wasm/
│   └── assets/
│
├── defense/                        # Phase 5: Detection system
│   ├── approach1-modification-detection/
│   │   ├── dataset/
│   │   ├── features/
│   │   ├── classifier/
│   │   ├── browser_extension/
│   │   └── evasion/
│   ├── approach2-activity-monitoring/
│   │   ├── data_collection/
│   │   ├── analysis/
│   │   ├── rob_variants/
│   │   └── monitor/
│   └── approach3-new-ui/
│       ├── mockups/
│       ├── chrome_extension/
│       └── user_study/
│
├── demo/                           # Phase 6: Demo scripts & videos
│   ├── setup_test_env.sh
│   ├── run_attack_demo.sh
│   ├── run_defense_demo.sh
│   └── videos/
│
└── docs/                           # Phase 7: Báo cáo
    ├── report.md
    ├── slides/
    └── figures/
```

---

## Lưu ý quan trọng

1. **LUÔN chạy trong VM** - Không bao giờ test trên máy thật với dữ liệu thật
2. **Mục đích nghiên cứu** - Project này chỉ dùng cho học tập và nghiên cứu bảo mật
3. **Không phổ biến mã nguồn tấn công** - Chỉ chia sẻ phần defense
4. **Dùng file test** - Tạo file giả để test, không dùng file cá nhân/nhạy cảm
5. **Ethical considerations** - Tuân thủ nguyên tắc responsible disclosure
