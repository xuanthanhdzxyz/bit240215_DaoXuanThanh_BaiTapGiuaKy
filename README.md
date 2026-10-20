# BIT240215_FoodManager

**Sinh viên: Đào Xuân Thành — BIT240215**  
Bài kiểm tra giữa kỳ môn Phát triển ứng dụng di động: Quản lý món ăn.

Ứng dụng **React Native + Expo SDK 58**, dùng **MockAPI REST API** kết hợp **AsyncStorage** để hoạt động offline và tự đồng bộ. Có đầy đủ màn hình danh sách, chi tiết, thêm/sửa món, quản lý loại món, cấu hình API và giao diện English/Tiếng Việt. Không bao gồm video theo yêu cầu của sinh viên.

## Chạy trên điện thoại Android

Yêu cầu Node.js >= 22.13, npm và Expo Go tương thích SDK 58. Cài thư viện trong thư mục chứa `package.json`:

```bash
npm ci
npm start
```

Điện thoại và máy tính cùng Wi-Fi, mở Expo Go và quét QR. Nếu Wi-Fi chặn kết nối LAN, thử `npx expo start --tunnel` (cần cài dependency tunnel khi Expo yêu cầu). Trên máy đã có Android Studio, bật emulator rồi chạy `npm run android`.

Kiểm tra nhanh trên trình duyệt: `npm run web`. Đây là bản hỗ trợ kiểm tra giao diện; bài nộp vẫn là ứng dụng React Native chạy Android/iOS. Khi quay demo theo đề, dùng điện thoại hoặc emulator.

Nếu Expo Go trên thiết bị chưa hỗ trợ SDK 58, cài phiên bản phù hợp từ trang chính thức https://expo.dev/go hoặc tạo development build. Có thể tạo APK qua tài khoản Expo với `npx eas-cli@latest build --platform android --profile preview`; file `eas.json` đã có cấu hình APK. Repository chưa chứa APK đã biên dịch.

## MockAPI đã cấu hình

- Project quản trị: https://mockapi.io/projects/6ad7559695e98f36aef24ebf
- API gốc: https://6ad7559695e98f36aef24ebe.mockapi.io
- Resource: `BIT240215_DishCategory` và `BIT240215_Dish`.
- Endpoint mặc định trong `src/config.js`; có thể thay tại màn hình **Connection / Kết nối**. Không dán URL trang quản trị `/projects/...` vào ô API.
- Lần chạy mới tạo sẵn 3 loại và 5 món trong local; ứng dụng tự đối chiếu ID và đồng bộ. Dữ liệu mẫu đã tồn tại trên server sẽ được tải về thay vì bị ghi đè bằng dữ liệu mẫu cũ.
- Không bấm Generate all trên MockAPI: dữ liệu sinh ngẫu nhiên không đáp ứng quan hệ/validation của bài.

## Chức năng theo đề

| Yêu cầu                    | Thực hiện                                                                               |
| -------------------------- | --------------------------------------------------------------------------------------- |
| 2 model, dữ liệu tối thiểu | 3 loại, 5 món mẫu; ảnh là mảng object trong mỗi món                                     |
| Tên project                | `BIT240215_FoodManager`; tên và MSSV ở đầu giao diện và mã nguồn                        |
| Tiền tố lưu trữ            | Tên resource, key AsyncStorage, tên trường nghiệp vụ và trường ảnh đều `BIT240215_`     |
| CRUD món                   | Danh sách → chi tiết → sửa; nút thêm; xóa có hộp xác nhận                               |
| Quản lý loại               | Thêm/sửa/xóa; chặn xóa loại đang chứa món, kể cả món ngừng bán                          |
| Tìm/lọc/sắp xếp            | Tên chứa chuỗi, loại, trạng thái, giá cùng lúc; giá tăng/giảm, thời gian tăng           |
| Giữ bộ lọc                 | State ở layout gốc, không bị mất khi chuyển qua chi tiết/thêm/sửa                       |
| Ảnh                        | Nhập URL HTTP/HTTPS, nhiều ảnh, xóa ảnh, đổi ảnh đại diện; tối đa một thumbnail         |
| Chế biến                   | ≤15 phút: Quick/Nhanh; >15 phút: Regular/Thông thường                                   |
| Validation                 | Tên không rỗng; giá/thời gian hữu hạn >0; loại tồn tại; không trùng tên trong cùng loại |
| Trường hợp lỗi             | ID mất, danh sách/ảnh trống, ảnh lỗi, khoảng giá sai, local lỗi, HTTP lỗi/time-out      |
| Đa ngôn ngữ                | English mặc định, chuyển Việt/Anh tại header; lưu lựa chọn qua lần mở lại               |
| Offline nâng cao           | Ghi local trước; hàng chờ nằm cùng một envelope với dữ liệu                             |
| Tự đồng bộ                 | Khi có mạng lại, mở app/trở lại foreground, và mỗi 20 giây khi app đang mở              |
| Không tạo trùng khi retry  | ID nghiệp vụ ổn định; GET đối chiếu trước POST/PUT; test mất phản hồi POST            |

## Cấu trúc và tài liệu

```text
App.js                      Giao diện, form, bộ lọc và trạng thái hiển thị
src/app/_layout.jsx         Layout gốc bền vững với Expo Router
src/app/index.jsx           Route danh sách
src/app/[...screen].jsx     Route chi tiết, form, loại món, cấu hình
src/config.js               API gốc mặc định
src/domain.js               Model theo tiền tố, seed, validation, tìm/lọc/sort
src/repository.js           Đọc/ghi local, CRUD, outbox, REST và tự đồng bộ
src/i18n.js                 Từ điển English/Tiếng Việt
tests/                      Kiểm thử nghiệp vụ và đồng bộ
docs/THUYET_MINH.md          Giải thích dữ liệu, kiến trúc, luồng xử lý
docs/KIEM_THU.md             Bước kiểm thử, demo và kết quả đã xác minh
```

## Lệnh kiểm tra

```bash
npm test
npm run lint
npm run typecheck
npx expo export --platform web
npx expo export --platform android
```

`typecheck` kiểm tra cấu trúc/cú pháp JS/JSX qua TypeScript, không phải chế độ kiểm tra kiểu nghiêm ngặt (`checkJs=false`). Test chạy bằng Node test runner, không cần kết nối dịch vụ thật. Các test repository dùng HTTP/storage giả lập để kiểm soát mất mạng và lỗi.

## Điểm cần hiểu khi bảo vệ

AsyncStorage là key–value, **không phải CSDL quan hệ**. Ứng dụng tự kiểm tra khóa ngoại và tên món trong `domain.js`/`repository.js`. MockAPI có `id` nội bộ bắt buộc dùng cho URL REST; khóa nghiệp vụ của bài là **`BIT240215_Id`**, không dùng `id` nội bộ để liên kết món với loại. Mọi trường tự định nghĩa đều có tiền tố MSSV.

Xóa dùng tombstone `BIT240215_Deleted=true` để đồng bộ việc xóa sang thiết bị khác và tránh dữ liệu cũ xuất hiện trở lại. Bản ghi này bị ẩn khỏi mọi danh sách quản lý. Vì vậy số lượng bản ghi trong trang MockAPI có thể bao gồm bản ghi đã xóa mềm.

Đồng bộ là cơ chế phục vụ bài cá nhân/một thiết bị: thay đổi local đang chờ được ưu tiên; dữ liệu không có thay đổi local được lấy từ server. Hai thiết bị đồng thời sửa cùng một món không có transaction/unique constraint trên MockAPI; xem giới hạn và chính sách xung đột trong tài liệu thuyết minh. Không tuyên bố hỗ trợ cộng tác thời gian thực.

Ảnh qua URL cần Internet để tải lần đầu. Khi offline, dữ liệu món vẫn hoạt động; ảnh chưa có cache hiện placeholder. Tự đồng bộ chạy khi ứng dụng đang hoạt động, không phải tác vụ nền khi ứng dụng bị hệ điều hành đóng.

## Nộp bài

Nộp link repository theo đề. Sinh viên tự quay Video 1/Video 2 và tự nộp LMS; các video không được tạo trong repository này. Cần đọc tài liệu và tự chạy các thao tác để giải thích được mã nguồn.
