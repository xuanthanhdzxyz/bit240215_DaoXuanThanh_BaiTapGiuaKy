# Kiểm thử — BIT240215_FoodManager

Ngày kiểm tra: 20/10/2026. Người thực hiện bài: Đào Xuân Thành — BIT240215.

## Tương thích iPhone

Project đã chuyển từ Expo SDK 58 sang SDK 57 theo phiên bản thực tế trên iPhone của sinh viên: Expo Go client 57.0.9, supported SDK 57.0.0. Sau khi chuyển SDK đã chạy lại: 9/9 test đạt, lint đạt, typecheck đạt, kiểm tra dependency theo SDK 57 đạt, xuất bundle iOS/Android/web thành công. Các ảnh minh chứng và kết quả MockAPI ban đầu được ghi trước khi chuyển SDK. Cần chạy lại trên iPhone để xác nhận runtime thực tế; việc xuất bundle iOS trên Windows không thay thế kiểm thử trên thiết bị.

## Kết quả đã chạy

| Kiểm tra | Kết quả |
|---|---|
| Node test runner | 9/9 test đạt |
| ESLint (`npm run lint`) | Đạt |
| Kiểm tra cú pháp/cấu trúc JS/JSX (`npm run typecheck`) | Đạt; không bật strict checkJs |
| Expo export web | Đạt |
| Expo export Android/Hermes | Đạt; đây là bundle, không phải APK |
| Giao diện web ở viewport 390×844 | Hiển thị danh sách, bộ lọc, chi tiết, form, hai ngôn ngữ |
| Validation UI | Giá=0 bị từ chối bằng thông báo tiếng Việt |
| Giữ bộ lọc | Tìm “gỏi” + loại Khai vị; vào chi tiết/sửa/hủy/quay lại vẫn còn bộ lọc |
| MockAPI thật | GET/POST/PUT thành công; trạng thái synced, pending=0 |
| Offline tạo/sửa với server thật | Repository mất mạng theo cờ kết nối → ghi món → setOnline(true) tự sync; server có đúng 1 bản ghi, giá cập nhật 35.000 |

Kết quả kiểm tra server thật nằm tại `evidence/mockapi-live.json`. Món “Bánh mì thịt” được giữ lại làm dữ liệu minh họa, nên project MockAPI hiện có **3 loại và 6 món**, nhiều hơn mức tối thiểu. Dữ liệu seed trong mã vẫn là 3 loại/5 món.

Kiểm thử offline thật phía repository mô phỏng sự kiện NetInfo bằng `setOnline(false/true)` và gọi HTTP thật tới MockAPI. Đây không phải bằng chứng đã thao tác chế độ máy bay trên điện thoại. Chưa chạy ứng dụng trong emulator/thiết bị Android ở môi trường này; cần thực hiện kiểm tra trên thiết bị trước khi quay video. Chưa tạo APK hoặc video.

## Nội dung 9 test tự động

1. Seed đủ 3 loại/5 món, quan hệ đúng, trường dữ liệu/ảnh có tiền tố.
2. Tên rỗng, giá/thời gian sai, loại mất, trùng tên cùng loại, URL sai, nhiều thumbnail bị chặn.
3. Tìm/lọc kết hợp, ngừng bán, sort, khoảng giá sai.
4. CRUD offline tồn tại sau mở lại; chặn xóa loại đang dùng và ID không tồn tại.
5. Mất phản hồi POST rồi thử lại không tạo trùng; sửa, xóa mềm, pull thay đổi remote.
6. Lỗi ghi local giữ nguyên database trong RAM và dữ liệu đã lưu.
7. Từ chối URL dashboard và dữ liệu remote sai; giữ local.
8. Cài app mới không ghi đè dữ liệu server bằng seed.
9. Sửa trong lúc request đang chạy không bị phản hồi cũ xóa mất Dirty; chu kỳ sau gửi bản sửa mới.

## Checklist tự thử trên điện thoại/emulator

| Thao tác | Kết quả mong đợi |
|---|---|
| Cài mới, có mạng | English mặc định; tự tải/đồng bộ, MSSV hiện ở header |
| Thêm “Món mới”, giá 50.000, 15 phút, chọn loại | Lưu; hiện Quick/Nhanh; thuộc loại đã chọn |
| Thêm món cùng tên khác hoa/thường vào cùng loại | Báo trùng; không tạo bản ghi |
| Thêm cùng tên ở loại khác | Cho phép |
| Giá/thời gian 0, âm hoặc chữ | Báo validation; dữ liệu cũ còn nguyên |
| Nhập URL ảnh rồi bấm Thêm ảnh; thêm ảnh thứ hai | Chi tiết hiển thị hai ảnh |
| Chọn ảnh thứ hai làm đại diện | Chỉ ảnh hai có cờ đại diện, list đổi cover |
| Xóa hết ảnh trong form và lưu | Hiện placeholder, app không crash |
| Sửa thành ngừng bán | Vẫn ở danh sách tất cả; biến mất khi lọc đang bán |
| Tìm tên + loại + trạng thái + min/max + sort | Đồng thời thỏa mọi điều kiện |
| Min lớn hơn max | Báo lỗi; không âm thầm đảo giá |
| Vào chi tiết/sửa rồi quay về | Điều kiện lọc và sort được giữ |
| Xóa loại đang có món | Hộp xác nhận, sau xác nhận báo không được xóa |
| Thêm loại không có món rồi xóa | Xóa được, không ảnh hưởng món khác |
| Xóa món, chọn Hủy | Không xóa |
| Xóa món, xác nhận | Biến mất trong quản lý; server có Deleted=true sau sync |
| Chuyển Việt/Anh ở từng màn | Nhãn, trạng thái, validation theo ngôn ngữ; dữ liệu tên không bị dịch |
| Đóng/mở app | Dữ liệu và ngôn ngữ còn; bộ lọc chỉ cần giữ khi điều hướng trong phiên |
| Tắt Internet, thêm/sửa món, đóng/mở app | Thay đổi vẫn còn local, hàng chờ còn |
| Bật Internet khi app mở | Tự gửi lên MockAPI, hàng chờ về 0, không cần nút đồng bộ |
| Mạng lỗi tạm thời | Thông báo lỗi; dữ liệu local còn; tự thử lại tối đa mỗi 20 giây |

## Cách kiểm tra trực tiếp trên MockAPI

Mở project mới, bấm Data ở resource `BIT240215_Dish`. Đối chiếu `BIT240215_Id`, tên, giá và `BIT240215_DishImage` với ứng dụng. Sau khi demo offline, chờ trạng thái “Up to date / Đã đồng bộ”, tải lại Data. Không Generate random data. Không sửa `id` hệ thống hoặc xóa resource khi app đang dùng.

## Tự chạy lại

```bash
npm ci
npm test
npm run lint
npm run typecheck
npx expo export --platform web
npx expo export --platform android
```

Video do sinh viên tự thực hiện theo đề; tài liệu này không thay thế yêu cầu nộp video/LMS.

## Kiểm tra bổ sung Anh–Việt

- 13/13 test đạt (9 nghiệp vụ/đồng bộ, 4 kiểm tra hiển thị và lưu nội dung song ngữ).
- Lint và typecheck đạt.
- Đổi ngôn ngữ áp dụng cả footer, tên loại, tên và mô tả món mẫu, trạng thái và thông báo.
- Form thêm/sửa có hai tên bắt buộc và hai mô tả; khi chuyển màn hình/ngôn ngữ bản nháp không bị tự dịch hay ghi đè.
- Tìm “spring” trong English tìm được Fresh spring rolls; tìm tiếng Việt khi đang ở Vietnamese.
- Bản dịch tùy chỉnh được ưu tiên hơn dữ liệu mẫu và tồn tại sau khi lưu offline/mở lại app.
