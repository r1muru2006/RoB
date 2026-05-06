# Báo cáo Đồ án Toàn diện: Phát hiện và ngăn chặn Ransomware trên trình duyệt (RØB)

Dựa trên bài báo nghiên cứu *"RØB: Ransomware over Modern Web Browsers"* tại USENIX Security 2023, báo cáo này trình bày cấu trúc, cơ chế hoạt động, tác động thực nghiệm và các hướng phòng thủ đối với ransomware chạy trực tiếp trên trình duyệt. Nội dung được tổ chức theo các đề mục chính của bài báo, đồng thời bổ sung phần responsible disclosure và ethics.

---

## 1. Introduction (Giới thiệu)

Sự phát triển của nền tảng Web đã đưa nhiều năng lực vốn chỉ có ở ứng dụng desktop lên trình duyệt. Một ví dụ tiêu biểu là **File System Access (FSA) API**, API cho phép web app tương tác trực tiếp với tệp cục bộ của người dùng.

Mặt lợi của FSA API là giúp xây dựng các ứng dụng web giàu tính năng như trình soạn thảo tài liệu, IDE online hoặc công cụ xử lý media. Mặt rủi ro là API này mở ra một bề mặt tấn công mới: kẻ tấn công có thể tạo một web app độc hại và dùng chính quyền truy cập file được người dùng cấp để mã hóa dữ liệu. Bài báo gọi dòng tấn công này là **RØB (Ransomware over Browser)**.

Những điểm chính được nhấn mạnh:
- **Đóng góp mới:** Bài báo là nghiên cứu đầu tiên phân tích toàn diện ransomware dựa trên trình duyệt thông qua FSA API và WebAssembly.
- **Nguy cơ thực tiễn:** RØB không cần tải file thực thi về máy; nạn nhân chỉ cần truy cập website độc hại và cấp quyền đọc/ghi cho thư mục.
- **Tác động rộng:** Thực nghiệm bao phủ 3 hệ điều hành, 29 thư mục/thư mục con, 5 nhà cung cấp cloud và 5 phần mềm antivirus.
- **Tính tàng hình:** RØB né được các cơ chế phòng thủ truyền thống vì hành vi đọc/ghi file được thực hiện bởi tiến trình trình duyệt hợp lệ.
- **Hướng phòng thủ:** Bài báo đề xuất 3 lớp phòng thủ ở mức browser-level, file-system-level và user-level, đồng thời hiện thực hóa proof-of-concept cho 2 hướng đầu.

---

## 2. Background (Cơ sở lý thuyết)

### 2.1. Nguồn gốc và mức hỗ trợ của FSA API

- FSA API được phát triển bởi **WICG (Web Platform Incubator Community Group)** để giúp web app làm việc với hệ thống file cục bộ.
- Tính đến thời điểm bài báo, FSA API chưa phải web standard chính thức nhưng được hỗ trợ đầy đủ trên Chrome và Edge, hỗ trợ một phần trên Opera và Safari. Các trình duyệt này chiếm khoảng **91.29% thị phần desktop browser vào tháng 5/2023**.
- Một số ứng dụng phổ biến đã dùng FSA API, ví dụ `vscode.dev` và Snapchat.
- Mozilla và Brave không tích hợp API này do lo ngại về quyền riêng tư và khả năng người dùng không thể đưa ra quyết định cấp quyền một cách thật sự có ý nghĩa. Safari/WebKit chỉ hỗ trợ giới hạn hơn, chủ yếu qua **Origin Private File System**, thay vì cho truy cập trực tiếp toàn bộ hệ file người dùng.

### 2.2. Cơ chế hoạt động của FSA API

Quy trình cơ bản khi web app thao tác file/thư mục:

1. **Chọn file hoặc thư mục:** Web app gọi API chọn file/thư mục như `showDirectoryPicker()` hoặc cơ chế entry point được paper mô tả là `chooseFileSystemEntries()`.
2. **Cấp quyền đọc:** Trình duyệt hiển thị hộp thoại xin quyền đọc. Nếu người dùng đồng ý, web app nhận `FileSystemFileHandle` hoặc `FileSystemDirectoryHandle`.
3. **Đọc dữ liệu:** Web app dùng `getFile()` để lấy nội dung file.
4. **Cấp quyền ghi:** Khi gọi `createWritable()`, trình duyệt hỏi quyền ghi. Sau khi đã cấp quyền trong cùng session, các lần ghi tiếp theo thường không hỏi lại.
5. **Ghi thay đổi:** Web app dùng `write()` để ghi dữ liệu mới. Thay đổi chỉ trở thành vĩnh viễn khi stream được `close()`.

Nếu người dùng cấp quyền đọc/ghi cho một thư mục, handle thư mục cho phép web app truy cập mọi file và thư mục con bên trong mà không cần prompt lại trong cùng session.

### 2.3. Mô hình bảo mật và điểm yếu

FSA API dùng hai chiến lược bảo vệ chính:

- **Permission model:** Người dùng phải cấp quyền đọc và ghi thông qua hộp thoại trình duyệt.
- **Access limitation strategy:** Trình duyệt hard-code việc chặn truy cập vào các vùng nhạy cảm như thư mục gốc hệ thống, thư mục home, thư mục OS và browser profile.

Điểm yếu nằm ở chỗ các thư mục dữ liệu người dùng không bị chặn đầy đủ. Trình duyệt có thể chặn thư mục cấp cao như home hoặc một số thư mục hệ thống, nhưng các thư mục con, thư mục cloud sync, ổ ngoài và network share vẫn có thể bị chọn và mã hóa.

---

## 3. Threat Model (Mô hình mối đe dọa)

RØB giả định FSA API hoạt động đúng thiết kế, nhưng bị lạm dụng bằng **social engineering**.

- **Tiếp cận nạn nhân:** Kẻ tấn công tạo một website độc hại hoặc chiếm quyền một web app có sẵn, rồi phát tán link qua phishing, malvertisement, email hoặc quảng cáo.
- **Ngụy trang:** Website có thể giả làm công cụ hợp pháp như trình chỉnh sửa ảnh/video, công cụ chuyển đổi PDF hoặc công cụ làm việc với tài liệu.
- **Lừa cấp quyền:** Nạn nhân tin rằng website cần quyền để xử lý file, nên bấm cho phép đọc và ghi.
- **Thực thi mã hóa:** Khi có quyền, RØB duyệt thư mục, đọc file, mã hóa và ghi đè dữ liệu bằng FSA API.
- **Tống tiền:** Sau khi mã hóa, RØB chuyển hướng nạn nhân tới trang đòi tiền, tạo ransom note hoặc đổi tên file để gắn thông điệp tống tiền.

Mô hình này thực tế vì người dùng thường tin trình duyệt hơn file `.exe` lạ. RØB cũng bỏ qua nhiều checkpoint của ransomware truyền thống như scanner email attachment, download scanner và kiểm tra file thực thi cục bộ.

---

## 4. RØB - Ransomware over Browser

### 4.1. Kiến trúc của RØB

RØB gồm 5 module chính:

- **Backend module:** Nhận request từ nạn nhân, tạo victim ID và cặp khóa public/private cho từng nạn nhân, lưu khóa trong database và gửi lại các thành phần cần thiết cho client.
- **Web UI module:** Giao diện web dùng để đánh lừa nạn nhân. Tùy kịch bản, UI có thể giả dạng media editor, document editor hoặc công cụ xử lý file.
- **File System Access module:** Dùng FSA API để duyệt file/thư mục theo vòng lặp đọc, mã hóa, ghi đè.
- **Encryption module:** Tạo khóa đối xứng, mã hóa file bằng **AES-256/AES-GCM**, sau đó mã hóa khóa AES bằng **RSA-2048** từ backend. Paper hiện thực module này bằng thư viện Enigma dùng OpenSSL biên dịch sang **WebAssembly (Wasm)**.
- **Extortion module:** Hiển thị thông tin thanh toán, victim ID và ransom note. RØB có thể redirect trang, tạo ransom note trong thư mục hoặc đổi tên file để gắn thông điệp.

Thuật toán lõi của RØB:

1. Gọi `showDirectoryPicker()` để người dùng chọn thư mục.
2. Duyệt từng entry trong `dirHandle.values()`.
3. Gọi `getFile()` để đọc nội dung.
4. Mã hóa nội dung file.
5. Gọi `createWritable()`.
6. Ghi nội dung đã mã hóa bằng `write()`.
7. Gọi `close()` để thay đổi trở thành vĩnh viễn.

### 4.2. Chi tiết hiện thực

- RØB dùng **hybrid encryption** để người dùng không thể tự phục hồi dữ liệu nếu không có khóa.
- Sau khi mã hóa file bằng AES-256, khóa AES được mã hóa bằng RSA-2048.
- Để giảm rủi ro lộ khóa trong bộ nhớ, paper có hàm `clear_memory` ghi đè vùng nhớ chứa khóa bằng dữ liệu ngẫu nhiên.
- Tốc độ mã hóa được đo trên Chrome 89 với máy macOS dùng Intel Core i5 và 8GB RAM: khoảng **0.62 MB/s với file 1MB**, **3.85 MB/s với file 10MB**, và **33.2 MB/s với file 100MB**.
- Wasm có overhead khi tải binary vào trình duyệt, nhưng tốc độ mã hóa tăng theo kích thước dữ liệu.

### 4.3. So sánh Desktop Ransomware và Browser-based Ransomware

1. **Initial user access:** Desktop ransomware thường phát tán payload qua email, quảng cáo hoặc phishing. RØB phát tán URL đến website độc hại.
2. **Infection and execution:** Desktop ransomware cần người dùng tải và chạy binary. RØB là **fileless** theo nghĩa không cần download hoặc chạy file thực thi; nó chạy trong browser session sau khi người dùng cấp quyền.
3. **Encryption:** Desktop ransomware thường dùng crypto API hoặc thư viện trên OS. RØB nhúng logic mã hóa trong Wasm, nên né được các cơ chế giám sát crypto API của hệ điều hành.
4. **Extortion:** Desktop ransomware có thể đổi wallpaper hoặc lock screen. RØB không có quyền đó, nên dùng redirect, ransom note trong thư mục hoặc đổi tên file.

### 4.4. Attack Surface Investigation (Đánh giá bề mặt tấn công)

Bài báo thử nghiệm trên Windows 10 Pro, Ubuntu 20.04 LTS, macOS Big Sur 11.0.1 và thêm một máy Windows để kiểm tra network share.

- **Local directories:** RØB có thể mã hóa toàn bộ nội dung các thư mục như Pictures, Videos, Music trên Windows; với Documents, Desktop, Downloads và data partition, FSA có thể chặn truy cập trực tiếp thư mục cấp cao nhưng vẫn cho truy cập thư mục con. Trên Linux và macOS, mô hình truy cập toàn thư mục/truy cập thư mục con nhìn chung tương tự; riêng data partition trên Linux/macOS có thể được truy cập toàn phần.
- **Cloud-integrated directories:** Paper thử Google Drive, Dropbox, Box, iCloud và Microsoft OneDrive. RØB mã hóa file trong thư mục sync cục bộ, sau đó sync engine đẩy phiên bản đã mã hóa lên cloud. Các cơ chế ransomware detection tích hợp của cloud provider không phát hiện RØB trong thử nghiệm.
- **Versioning của cloud:** Dropbox, Google Drive và OneDrive có version history nên có thể giảm thiệt hại, nhưng không phải giải pháp tuyệt đối vì bản backup có thể chưa phản ánh thay đổi mới nhất. iCloud và Box Individual không có versioning phù hợp trong thử nghiệm, nên file bị RØB mã hóa không khôi phục được qua tính năng này.
- **External storage:** RØB mã hóa được file trong thư mục được chọn trên ổ ngoài như ổ cứng Western Digital 4TB và USB Toshiba 16GB.
- **Network-shared folders:** Khi thư mục được share qua mạng, RØB chạy trên một máy vẫn có thể mã hóa file nằm trong thư mục shared của máy khác.

Kết luận của phần này: access limitation hiện tại của FSA API không đủ để bảo vệ dữ liệu người dùng vì chỉ chặn một số vị trí hard-code, trong khi nhiều thư mục có giá trị thực tế vẫn truy cập được.

---

## 5. Effectiveness of Current Defenses (Hiệu quả của các phòng thủ hiện tại)

### 5.1. Antivirus thương mại

Paper kiểm tra 5 antivirus bản đầy đủ, mỗi lần với thư mục test chứa 10, 50 và 100 file nhiều định dạng:

- **Malwarebytes Premium / Browser Guard:** Không phát hiện RØB, kể cả khi bật extension Browser Guard.
- **AVG Internet Security:** Không phát hiện RØB dù thư mục test được thêm vào danh sách Sensitive Folders.
- **Kaspersky Total Security:** Module anti-ransomware theo dõi hành vi thời gian thực không chặn được RØB.
- **Trend Micro Antivirus+ Security:** Không phát hiện trong các thử nghiệm 10, 50 và 100 file.
- **Avast One Essential:** Không phát hiện RØB dù thêm thư mục vào danh sách cần giám sát.

Nguyên nhân chính: AV nhìn thấy Chrome/Edge, một ứng dụng hợp lệ, đang đọc và ghi file theo quyền người dùng đã cấp. RØB không chạy binary độc lập, không dùng crypto API hệ điều hành, và không cần hành vi hệ thống dễ nhận dạng như ransomware desktop.

### 5.2. Vì sao các hướng phòng thủ ransomware truyền thống thất bại

- **Static analysis:** Không phù hợp vì RØB là web app, có thể obfuscate JavaScript/Wasm và không có payload binary kiểu desktop để phân tích.
- **Dynamic analysis:** Khó áp dụng vì không thực tế khi phân tích mọi website trước khi người dùng truy cập. RØB cũng chỉ cần một HTTP request ban đầu tới backend, nên đặc trưng network traffic không nổi bật.
- **Registry/process monitoring:** Không hiệu quả vì RØB không cài đặt vào hệ thống và không tạo process ransomware riêng.
- **API/system call monitoring:** RØB không dùng OS crypto API. Nếu giám sát toàn bộ system call của browser thì overhead cao và dễ gây false positive vì trình duyệt vốn sinh nhiều process/tab.
- **File-system activity monitoring truyền thống:** Nhiều hệ thống cũ giả định ransomware là process độc lập. Với RØB, actor ghi file lại là trình duyệt hợp lệ.
- **Key extraction/recovery:** Các kỹ thuật hook crypto API của OS không áp dụng được vì RØB dùng Wasm. Paper thử chụp heap snapshot bằng Puppeteer; việc trích khóa có thể xảy ra nhưng không thực tế vì tốn bộ nhớ, ảnh hưởng trải nghiệm và có thể bị né nếu attacker dùng RSA public key để mã hóa từng file.

---

## 6. Potential Defense Solutions (Các giải pháp phòng thủ tiềm năng)

Bài báo đề xuất 3 hướng phòng thủ độc lập và bổ trợ lẫn nhau.

### 6.1. Approach 1: Malicious Modification Identification via API Hooking

Đây là hướng phòng thủ trọng tâm ở cấp trình duyệt: chặn và phân tích thay đổi trước khi file gốc bị ghi đè vĩnh viễn.

**Cơ sở kỹ thuật:**

- Khi FSA API ghi file, trình duyệt tạo swap file tạm có đuôi **`.crswap`**.
- Dữ liệu gốc chỉ bị thay thế khi swap file được commit ở bước cuối.
- Nếu hook đúng thời điểm trước khi commit, hệ thống có thể so sánh file gốc và phiên bản sắp ghi để phát hiện mã hóa.

**Các hàm được hook:**

- `showDirectoryPicker()` để biết thư mục đang được web app truy cập.
- `write()` để tạm dừng hành vi ghi đè theo mẫu read-encrypt-overwrite.
- `removeEntry()` để xử lý ransomware kiểu read-encrypt-delete-write, tức xóa file gốc rồi ghi file mã hóa mới.

**Đặc trưng phát hiện:**

- **Entropy change:** Benign modification thường làm entropy tăng rất nhỏ. Paper đo trên `txt`, `xlsx`, `jpeg`, `docx`, `pdf`: với nhiều loại file, thay đổi là khoảng 0.05 trung bình; mã hóa làm entropy tăng lớn hơn, ví dụ `txt` tăng khoảng 3.5, `jpeg/docx` khoảng 0.60, `xlsx/pdf` khoảng 0.10.
- **File size change:** Mã hóa thường giữ kích thước gần như tương đương, trong khi thao tác chỉnh sửa hợp lệ có thể làm kích thước đổi đáng kể. Paper ghi nhận benign modification làm kích thước `txt/xlsx/jpeg/docx` tăng khoảng 15% trung bình, còn mã hóa chỉ đổi rất nhỏ, ví dụ `txt` khoảng 0.002%, `xlsx` 0.06%, `jpeg` 0.14%, `docx` 0.012%, `pdf` 0.006%.

**Dataset và ML:**

- Paper tạo dataset gồm **5000 file** thuộc 5 định dạng nhạy cảm (`pdf`, `docx`, `xlsx`, `txt`, `jpeg`) lấy từ Digital Corpora.
- Với mỗi file, tạo 100 phiên bản chỉnh sửa hợp lệ: 50 phiên bản xóa nội dung và 50 phiên bản thêm nội dung.
- Tổng cộng có khoảng **500K benign modifications** và **500K malicious/encryption modifications**.
- Các classifier được thử gồm Random Forest, KNN, Decision Tree và XGBoost, dùng 10-fold cross-validation.
- Kết quả nhìn chung rất cao. Random Forest mạnh với `txt` và `docx`, Decision Tree đạt khoảng **99.5% accuracy cho `jpeg` mà không có false positive**, KNN tốt nhất với `xlsx`.

**Adaptive attackers:**

- Paper kiểm tra partial encryption 25%, low-entropy padding, post-encryption encoding bằng Base64/Base32/Hex và custom evasion.
- Partial encryption và low-entropy padding tạo một số false negative nhưng không né hoàn toàn.
- Base64/Base32/Hex làm entropy có giá trị cố định và tăng kích thước lần lượt khoảng **33%, 60%, 100%**; Hex là biến thể hiệu quả nhất trong nhóm encoding nhưng vẫn không mô phỏng hoàn toàn benign modification.
- Custom evasion kết hợp partial encryption và padding để bắt chước entropy/size của chỉnh sửa hợp lệ, có thể gây nhiều false negative hơn. Tuy nhiên kỹ thuật này làm attacker phức tạp hơn và có thể giảm hiệu quả phá hoại.

**Usability:**

Approach 1 có thể gây false positive với web app hợp lệ nhưng nén/mã hóa/xử lý file nặng. Vì vậy paper đề xuất alerting module: hiển thị hộp thoại thứ ba, nói rõ có thay đổi nghi ngờ gây mất dữ liệu vĩnh viễn và cho người dùng chọn tiếp tục hoặc hủy.

### 6.2. Approach 2: Local Activity Monitoring

Approach 2 không chỉ nhìn nội dung file mà theo dõi pattern hoạt động cục bộ của web app dùng FSA API.

Ba nhóm tín hiệu:

- **FSA API function calls:** Chuỗi gọi như `getFile() -> write() -> write.close()` xuất hiện ở cả benign app và RØB, nhưng RØB thường lặp pattern một lần cho rất nhiều file, còn ứng dụng hợp lệ thường sửa một file nhiều lần.
- **Browser process system calls:** Có thể thu thập bằng công cụ như `lsof` và `strace`, nhưng tín hiệu này kém phân biệt hơn và overhead cao hơn.
- **File system activities:** Có thể thu thập bằng `inotifywait`; pattern của RØB thường xuất hiện một lần trên mỗi file, trong khi ứng dụng như VS Code có thể tạo nhiều hoạt động lặp lại trên cùng một file.

Paper đánh giá 9 web app benign và 8 mẫu malicious/adaptive bằng n-gram:

- 2-gram cho FSA API function calls.
- 4-gram cho system calls.
- 1-gram cho file system activities.

Kết quả: FSA API calls và file system activities phân biệt ransomware tốt hơn system calls. System-call-only detection có thể bỏ sót hoặc tạo false positive, đặc biệt khi attacker thêm thời gian chờ hoặc khi benign app như Photopea, text-editor, Excalidraw có hành vi chỉnh sửa phức tạp.

Các adaptive variants được thử gồm reorder API calls, thêm benign modifications, thêm benign API calls, chờ ngẫu nhiên trong mã hóa, chờ giữa FSA calls và kết hợp cả hai loại chờ.

Hướng triển khai thực tế có thể là: browser đặt ngưỡng số lượng file/số lượng ghi trong một khoảng thời gian, sau đó yêu cầu người dùng xác nhận thêm khi web app đang sửa hàng loạt file.

### 6.3. Approach 3: New UI Design

Approach 3 không phát hiện mã độc trực tiếp mà tăng nhận thức rủi ro của người dùng tại thời điểm cấp quyền.

Vấn đề của UI hiện tại:

- Hộp thoại read/write không nói rõ nguy cơ rò rỉ thông tin nhạy cảm hoặc mất dữ liệu vĩnh viễn.
- Hộp thoại đọc và ghi trông quá giống nhau, dễ khiến người dùng bấm nhầm hoặc bấm theo thói quen.
- Hộp thoại write không liệt kê file nào sẽ bị chỉnh sửa.
- UI không nhấn mạnh rằng web app cũng truy cập được **subdirectories** bên trong thư mục được chọn.

Thiết kế mới được đề xuất:

- Thêm warning icon và màu sắc cảnh báo.
- Ghi rõ website có thể đọc/chỉnh sửa file trong thư mục và thư mục con.
- Với quyền đọc, nhấn mạnh rủi ro **sensitive information disclosure**.
- Với quyền ghi, nhấn mạnh rủi ro **permanent loss**, **encryption** hoặc **ransomware**.
- Hiển thị danh sách file bị ảnh hưởng trước khi người dùng chấp nhận thay đổi.
- Thêm link cung cấp thông tin về API và rủi ro bảo mật.

Ưu điểm của Approach 3 là có thể tích hợp trực tiếp vào browser/API source code, không yêu cầu người dùng cài thêm extension. Hạn chế là attacker vẫn có thể dùng social engineering để chiếm lòng tin của người dùng.

---

## 7. Related Work (Nghiên cứu liên quan)

Bài báo đặt RØB trong hai nhóm nghiên cứu chính:

- **Ransomware defense:** Các nghiên cứu trước tập trung vào static analysis, dynamic analysis, system/API calls, I/O patterns, file entropy, backup/recovery hoặc key extraction. Chúng thường giả định ransomware là chương trình chạy trên OS, nên không phù hợp với ransomware nằm trong browser process và dùng Wasm.
- **Web API security:** Các nghiên cứu về Geolocation API, screen-sharing API và FSA API chỉ ra rằng API web mới có thể tạo bề mặt tấn công mới. RØB tiếp nối hướng này bằng cách chứng minh FSA API có thể bị lạm dụng để mã hóa dữ liệu cục bộ ở quy mô ransomware.

---

## 8. Conclusion (Kết luận)

Bài báo chứng minh FSA API, dù hữu ích cho web app hiện đại, có thể bị lạm dụng để xây dựng ransomware chạy trên trình duyệt. RØB kết hợp FSA API và WebAssembly để mã hóa file cục bộ, thư mục cloud sync, ổ ngoài và network share mà không cần cài binary độc hại lên máy nạn nhân.

Thực nghiệm cho thấy các cơ chế phòng thủ hiện tại, bao gồm antivirus thương mại và nhiều hướng nghiên cứu ransomware truyền thống, không đủ hiệu quả vì RØB chạy bên trong trình duyệt, không dùng OS crypto API, không có payload desktop rõ ràng và tận dụng quyền người dùng đã cấp hợp lệ.

Ba hướng phòng thủ của paper gồm: phát hiện thay đổi độc hại bằng entropy/size qua API hooking, giám sát hoạt động cục bộ của FSA API/file system, và thiết kế lại UI cấp quyền để người dùng hiểu rõ rủi ro. Trong đó, Approach 1 là hướng phù hợp nhất để hiện thực hóa trong đồ án vì có khả năng chặn trước khi thay đổi được commit vĩnh viễn xuống file gốc.

---

## 9. Responsible Disclosure và Ethics

Bài báo cho biết nhóm tác giả đã disclosure vấn đề tới Google/Chromium, trao đổi với các nhà phát triển FSA API và nhận phản hồi tích cực về việc cải thiện tài liệu bảo mật cũng như cân nhắc countermeasure thực tế.

Nhóm cũng disclosure tới một số cloud provider và AV vendor. Do cân nhắc đạo đức, mã nguồn ransomware RØB không được công khai; chỉ mã nguồn các giải pháp phòng thủ được phát hành để hỗ trợ nghiên cứu tiếp theo.
