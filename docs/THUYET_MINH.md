# Thuyết minh mã nguồn — Đào Xuân Thành — BIT240215

## 1. Lựa chọn công nghệ

React Native dựng giao diện di động bằng View/Text/TextInput/Image/Switch/ScrollView. Expo SDK 57 quản lý môi trường chạy Android/iOS. Expo Router quản lý đường dẫn; layout gốc giữ bộ lọc, dữ liệu và ngôn ngữ khi chuyển màn hình. Không tạo thủ công thư mục android/ios.

MockAPI là nguồn dữ liệu REST. AsyncStorage là bản sao local và hàng chờ thay đổi, cho phép thêm/sửa/xóa khi mất mạng. NetInfo phát sự kiện kết nối; AppState nhận lúc người dùng quay lại ứng dụng. Bộ hẹn giờ 20 giây tự thử lại khi server lỗi tạm thời.

## 2. Thiết kế dữ liệu và tiền tố MSSV

`key('Name')` trả về `BIT240215_Name`. `record({Name:'Cơm gà'})` tạo object có trường `BIT240215_Name`. `get(row,'Name')` đọc trường này. Việc này tập trung quy tắc tiền tố tại một nơi và áp dụng cả dữ liệu local, dữ liệu REST và object ảnh.

### DishCategory → resource BIT240215_DishCategory

| Trường lưu trữ        | Kiểu    | Vai trò                 |
| --------------------- | ------- | ----------------------- |
| BIT240215_Id          | string  | Khóa nghiệp vụ ổn định  |
| BIT240215_Name        | string  | Tên loại bắt buộc       |
| BIT240215_Description | string  | Mô tả                   |
| BIT240215_Deleted     | boolean | Xóa mềm phục vụ đồng bộ |

### Dish → resource BIT240215_Dish

| Trường lưu trữ            | Kiểu    | Vai trò                                 |
| ------------------------- | ------- | --------------------------------------- |
| BIT240215_Id              | string  | Khóa nghiệp vụ                          |
| BIT240215_Name            | string  | Không rỗng, không trùng trong cùng loại |
| BIT240215_Price           | number  | Hữu hạn, >0                             |
| BIT240215_PreparationTime | number  | Hữu hạn, >0, đơn vị phút                |
| BIT240215_IsAvailable     | boolean | Đang bán/ngừng bán                      |
| BIT240215_Description     | string  | Mô tả                                   |
| BIT240215_DishCategoryId  | string  | Tham chiếu BIT240215_Id của loại        |
| BIT240215_DishImage       | array   | Mảng object ảnh                         |
| BIT240215_Deleted         | boolean | Xóa mềm                                 |

Mỗi object ảnh có `BIT240215_ImageUrl` và `BIT240215_IsThumbnail`. Chỉ cho phép URL HTTP/HTTPS, tối đa một ảnh có IsThumbnail=true. Ảnh đầu tiên khi thêm được chọn làm đại diện; chọn ảnh khác bỏ cờ đại diện của tất cả ảnh còn lại; xóa ảnh đại diện tự chọn ảnh đầu tiên còn lại. Món không có ảnh vẫn hợp lệ và hiển thị placeholder.

Quan hệ 1–n: mỗi loại có nhiều món; một món thuộc đúng một loại hợp lệ. Do AsyncStorage không có khóa ngoại thật, mỗi lần ghi món đều kiểm tra loại và mỗi lần xóa loại đều kiểm tra món đang dùng.

### Envelope local

Khóa AsyncStorage là `BIT240215_Database`. Bên trong gồm hai mảng tên `BIT240215_DishCategory`, `BIT240215_Dish`, ngôn ngữ `BIT240215_Language`, API gốc `BIT240215_Endpoint`, phiên bản schema `BIT240215_SchemaVersion`. Mỗi record local có thêm:

- `BIT240215_Dirty`: đang chờ đẩy server.
- `BIT240215_Revision`: phiên bản thay đổi, dùng để xử lý sửa trong lúc HTTP đang chạy.
- `BIT240215_RemoteId`: id nội bộ của MockAPI.
- `BIT240215_Seed`: dữ liệu mẫu chưa được người dùng sửa, không ghi đè dữ liệu server đã có.

Các trường metadata local này không được gửi lên REST. MockAPI tự cấp trường `id` hệ thống; đây là ngoại lệ do nền tảng quản lý, không phải trường nghiệp vụ tự đặt tên. Không đổi `id` này vì REST cần `/resource/:id`.

## 3. Luồng CRUD và validation

1. Form thu nhận chuỗi tên, giá, thời gian, loại, mô tả, ảnh, trạng thái.
2. Chuyển giá/thời gian thành Number rồi gửi repository.
3. Repository kiểm tra: record khi sửa vẫn tồn tại, tên không rỗng, số hữu hạn >0, loại hợp lệ, tên không trùng theo loại, URL hợp lệ và số ảnh đại diện ≤1.
4. So trùng tên bằng trim + Unicode NFC + chữ thường tiếng Việt. Cùng tên ở loại khác được phép. Sửa chính record đó không bị tính là trùng với bản thân.
5. Ghi dữ liệu và đánh dấu Dirty trong cùng một lần `setItem`. Chỉ cập nhật snapshot hiển thị sau khi ghi thành công.
6. Bắt đầu đồng bộ không chặn người dùng. Mất mạng vẫn hoàn tất CRUD local.

Xóa món phải qua modal xác nhận. Xóa loại đang được dùng báo lỗi; món ngừng bán vẫn là món đang dùng loại. Lỗi lưu local giữ nguyên dữ liệu và báo lỗi, không tự xóa/reset database.

## 4. Tìm kiếm, bộ lọc và sort

`filterDishes` kết hợp tất cả điều kiện bằng AND. Tìm chuỗi con tên không phân biệt hoa/thường. Loại rỗng nghĩa là mọi loại. Trạng thái gồm tất cả/đang bán/ngừng bán. Khoảng giá gồm cả hai đầu, có thể bỏ trống một đầu. Giá âm, không phải số, min>max báo lỗi, không silently đảo giá trị.

Sort trên mảng đã lọc, không làm thay đổi database: giá tăng, giá giảm, thời gian tăng. Bộ lọc nằm trong layout gốc nên điều hướng bằng Expo Router không xóa điều kiện đang chọn.

Nhanh/Quick tính lúc hiển thị với điều kiện PreparationTime≤15; không lưu trường phân loại suy diễn.

## 5. Đa ngôn ngữ

Từ điển `src/i18n.js` có cùng key cho English và Tiếng Việt. Mỗi nhãn, nút, trạng thái, lỗi validation được tra qua `translate(lang)(key)`. Mặc định lần cài mới là `en`. Đổi ngôn ngữ ghi AsyncStorage nên còn hiệu lực khi đi màn khác hoặc mở lại app. Theo yêu cầu bổ sung của sinh viên, tên và mô tả có hai phiên bản nhập riêng: NameVi/NameEn, DescriptionVi/DescriptionEn (đều có tiền tố BIT240215_ khi lưu). Dữ liệu mẫu cũ được tra bản dịch chính xác qua contentText mà không reset local/server. Nội dung tùy ý chưa có bản dịch giữ nguyên cho đến khi người dùng bổ sung trong form.

## 6. Offline và tự đồng bộ

### Ghi trước vào local

Mỗi mutation được xếp trong Promise chain. Transaction sao chép database, áp dụng mutation, ghi toàn bộ envelope, rồi mới thay snapshot. Điều này tránh hai thao tác ghi đè local của nhau và tránh trường hợp dữ liệu đã thay nhưng hàng chờ chưa được lưu.

### Đồng bộ

1. Kiểm tra có mạng, có endpoint và không có lượt sync khác đang chạy.
2. GET đủ hai resource; kiểm tra định dạng ID, Deleted và trùng ID.
3. Với từng record Dirty, tra server bằng BIT240215_Id. Tồn tại → PUT dùng `id` nội bộ; chưa có → POST. Loại được gửi trước món.
4. Dữ liệu mẫu chưa sửa đã tồn tại trên server được ưu tiên lấy server. Điều này ngăn một lần cài mới ghi đè sửa đổi cũ bằng seed.
5. Gửi thành công chỉ xóa Dirty nếu Revision local vẫn bằng Revision đã gửi. Nếu người dùng sửa trong lúc HTTP chạy, thay đổi mới tiếp tục nằm trong hàng chờ.
6. Hợp nhất dữ liệu server và local: local Dirty được ưu tiên; phần còn lại lấy từ server. Validate quan hệ và nghiệp vụ trước khi lưu.
7. Nếu HTTP, timeout 15 giây, dữ liệu sai hoặc ghi local thất bại, giữ dữ liệu local và báo lỗi. Sự kiện có mạng lại/foreground/timer sẽ tự thử lại.

### Vì sao retry không tạo bản sao trong kịch bản bài cá nhân?

Giả sử POST được server lưu nhưng thiết bị mất mạng trước khi nhận phản hồi. Local vẫn Dirty. Lượt sau GET thấy BIT240215_Id đã tồn tại nên PUT thay vì POST lần nữa. ID được tạo một lần lúc thêm và được lưu local, không tạo lại trong mỗi lượt gửi. Tombstone giữ thông tin xóa để thiết bị khác có thể loại bỏ bản ghi.

### Giới hạn kỹ thuật

MockAPI không cung cấp unique constraint và transaction nhiều resource. Cơ chế GET-trước-POST bảo vệ retry tuần tự từ một thiết bị; không cam kết chống mọi trường hợp hai thiết bị cùng POST trong cùng thời điểm. Local Dirty được ưu tiên, sau khi gửi thì server chứa bản gửi mới nhất. Nếu phát hiện server có trùng ID hoặc dữ liệu vi phạm quan hệ, app báo lỗi và không nhập dữ liệu sai. Quản trị viên sửa schema/dữ liệu server rồi app sẽ tự thử lại. Ứng dụng không thực hiện giải quyết xung đột đa người dùng bằng CRDT/vector clock.

Đồng bộ khi app đang mở hoặc quay lại foreground; không có dịch vụ nền khi app bị đóng hẳn. Ảnh ngoài Internet cần mạng hoặc cache của hệ điều hành; placeholder là hành vi dự kiến khi offline chưa có ảnh.

## 7. Các vị trí cần chỉ khi trình bày mã

- `app.json`: name `BIT240215_FoodManager`, Android package.
- `src/domain.js`: tiền tố, record/get, seed, validateDish, filterDishes.
- `src/repository.js`: TABLES, STORAGE_KEY, transaction, saveDish, remove, sync.
- `src/config.js`: URL API gốc project của sinh viên.
- `App.js`: DishForm, Categories, modal xác nhận, form URL ảnh, chuyển ngôn ngữ, NetInfo/AppState/timer.
- `tests/repository.test.mjs`: kịch bản mất phản hồi POST rồi thử lại và kiểm tra không trùng.

Video do sinh viên tự quay; tài liệu này giải thích mã nguồn để sinh viên chủ động học và thuyết minh, không thay thế video.
