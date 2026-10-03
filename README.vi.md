<div align="center">

# R3PLAYX

Trình phát nhạc NetEase Cloud Music bên thứ ba dành cho desktop và web.

[English](README.md) · [Tiếng Việt](README.vi.md) · [简体中文](README.zh-CN.md)

[![Checks](https://github.com/Lynx-1ST/R3PLAY/actions/workflows/check.yml/badge.svg?branch=dev)](https://github.com/Lynx-1ST/R3PLAY/actions/workflows/check.yml)
[![Windows release](https://github.com/Lynx-1ST/R3PLAY/actions/workflows/build.yaml/badge.svg)](https://github.com/Lynx-1ST/R3PLAY/actions/workflows/build.yaml)
![Source version](https://img.shields.io/badge/source_version-2.9.1-2ea44f)
![License](https://img.shields.io/github/license/Lynx-1ST/R3PLAY)

</div>

> [!NOTE]
> R3PLAYX đang được phát triển tích cực. Repository này là fork của [Sherlockouo/music](https://github.com/Sherlockouo/music), dự án được phát triển dựa trên hệ sinh thái YesPlayMusic.

## Phiên bản và kênh phát hành

Phiên bản package trong mã nguồn là **2.9.1**. Bản Windows ổn định dùng tag như `v2.9.1`; bản thử nghiệm dùng `v2.9.1-dev.N` và được đánh dấu prerelease. Badge phiên bản mô tả mã nguồn; xem [GitHub Releases](https://github.com/Lynx-1ST/R3PLAY/releases) để kiểm tra bộ cài đã phát hành và ghi chú thay đổi.

## Tính năng

- Đăng nhập NetEase Cloud Music, bao gồm đăng nhập bằng mã QR
- Album, nghệ sĩ, playlist, tìm kiếm, Private FM và phát MV
- Lời bài hát đồng bộ trong ứng dụng
- Khôi phục hàng đợi, vị trí nghe, âm lượng, phát ngẫu nhiên và lặp lại; mở ứng dụng vẫn tạm dừng
- Hiện bài hát ngay khi nhập tìm kiếm, tìm trong playlist không cần dấu
- Kéo đổi thứ tự hàng đợi hoặc dùng bàn phím
- Discord Rich Presence tùy chọn, hiển thị bài hát, nghệ sĩ, ảnh bìa và thời gian phát
- Chọn thiết bị âm thanh trong Settings và miniplayer gọn hơn
- Theme, màu nhấn và hình nền có thể tùy chỉnh
- Hỗ trợ giao diện tiếng Anh, tiếng Việt và tiếng Trung giản thể
- Nhiều nguồn nhạc dự phòng thông qua UnblockNeteaseMusic
- Chọn chất lượng phát NetEase: 128K, 192K, 320K, Lossless và Hi-Res
- Chọn Spatial Audio, Audio Vivid và Surround Audio ngay trên miniplayer
- Chọn 8 mức chất lượng tải xuống, kiểm tra quyền theo bài hát và tài khoản
- Audio cache có kiểm tra chất lượng trước khi tái sử dụng
- Tùy chọn dùng YouTube làm nguồn dự phòng trên desktop
- Tích hợp metadata từ Apple Music
- Media controls, system tray và phím tắt trên desktop
- Hỗ trợ web/PWA
- Triển khai bằng Docker
- Đóng gói ứng dụng cho Windows, macOS và Linux

## Tải ứng dụng và thiết lập mới

Tải bộ cài Windows tại [GitHub Releases](https://github.com/Lynx-1ST/R3PLAY/releases/latest). Chức năng cập nhật trong ứng dụng cũng lấy bản phát hành từ repository này.

- **Settings → Chung:** bật hiển thị bài hát ngay khi nhập tìm kiếm. Enter mở toàn bộ kết quả; phím mũi tên chọn gợi ý và Enter phát bài đã chọn.
- **Settings → Trình phát:** khôi phục phiên nghe (mặc định bật), chọn thiết bị âm thanh và Discord Rich Presence (mặc định tắt). Discord cần chạy trên cùng máy.
- Kéo tay nắm ở hàng đợi để đổi thứ tự, hoặc chọn tay nắm và nhấn mũi tên lên/xuống. Tìm trong playlist hỗ trợ tên bài, nghệ sĩ, album và nhập không dấu.

Chức năng lời bài hát trên desktop đã được bỏ. Lời bài hát đồng bộ trong ứng dụng vẫn được giữ lại.

## Ảnh chụp màn hình

Các ảnh này minh họa giao diện upstream và có thể khác bản hiện tại.

### Trang chính

<img width="1548" alt="Trang chính R3PLAYX" src="https://github.com/Sherlockouo/music/assets/34598208/a58b5c05-ce35-4f32-8b07-fb94df94fc62">

### Khám phá

<img width="1548" alt="Trang khám phá R3PLAYX" src="https://github.com/Sherlockouo/music/assets/34598208/4f8c3168-ac8a-476a-8db2-2aede6e85534">

### Lời bài hát

![Lyrics](https://github.com/Sherlockouo/music/assets/34598208/82123958-db58-4026-ab4d-19f7c8e26495)

## Công nghệ

| Phần                   | Công nghệ chính                              |
| ---------------------- | -------------------------------------------- |
| Web UI                 | React 19, Vite 7, TypeScript, Tailwind CSS 4 |
| State/data             | Valtio, TanStack Query                       |
| Audio                  | Howler.js, hls.js                            |
| Desktop                | Electron 43                                  |
| Local API trên desktop | Fastify 5, better-sqlite3                    |
| Server độc lập         | Fastify 5, Prisma 6, SQLite                  |
| Build                  | pnpm workspaces, Turborepo                   |
| Đóng gói               | electron-builder, Docker                     |

## Cấu trúc repository

```text
packages/
├── desktop/   # Electron main process, local Fastify server, IPC, cache
├── server/    # Fastify API server độc lập + Prisma/SQLite
├── shared/    # TypeScript types và IPC contracts dùng chung
└── web/       # React UI dùng chung cho bản web và Electron
```

Ứng dụng Electron phục vụ React UI thông qua một Fastify server chạy cục bộ. Bản web có thể chạy riêng và giao tiếp với backend/API service độc lập.

## Yêu cầu

- Node.js **22.12 trở lên**
- pnpm **8.6.12**
- Git

## Thiết lập môi trường phát triển

Clone repository và cài dependencies:

```bash
git clone https://github.com/Lynx-1ST/R3PLAY.git
cd R3PLAY
cp .env.example .env
corepack enable
pnpm install
```

### Chạy ứng dụng desktop

```bash
pnpm dev
```

Lệnh development ở root sẽ khởi động các workspace task cần cho ứng dụng Electron.

### Chạy bản web

Khi phát triển riêng bản web, mở hai terminal để chạy NetEase API helper và Vite:

```bash
pnpm --filter web api:netease
```

```bash
pnpm --filter web dev
```

### Chạy server độc lập

```bash
pnpm --filter server dev
```

Server độc lập mặc định lắng nghe ở port `35530`.

## Build và đóng gói

Build toàn bộ project:

```bash
pnpm build
```

Chỉ build web:

```bash
pnpm build:web
```

Đóng gói ứng dụng Electron:

```bash
pnpm package
```

## Docker

Build và chạy frontend + backend:

```bash
docker compose up --build
```

Frontend được mở tại:

```text
http://localhost:2222
```

Backend chỉ được expose trong Docker Compose network và lưu SQLite database trong volume `server-data`.

## Biến môi trường

File `.env.example` ở root hiện có:

| Biến                            | Mặc định              | Mục đích                                 |
| ------------------------------- | --------------------- | ---------------------------------------- |
| `ELECTRON_WEB_SERVER_PORT`      | `42710`               | Web server của Electron/Vite             |
| `ELECTRON_DEV_NETEASE_API_PORT` | `30001`               | NetEase API dùng khi phát triển Electron |
| `VITE_APP_NETEASE_API_URL`      | `/netease`            | API base path của frontend               |
| `DATABASE_URL`                  | `file:./musicInfo.db` | URL SQLite database                      |

Khi deploy bằng Docker có thể dùng thêm `APPLE_MUSIC_TOKEN`.

## Chất lượng phát nhạc

Fork này bổ sung setting chất lượng phát NetEase và lưu lại lựa chọn của người dùng:

| Setting    | Hiển thị |
| ---------- | -------- |
| `standard` | 128K     |
| `higher`   | 192K     |
| `exhigh`   | 320K     |
| `lossless` | Lossless |
| `hires`    | Hi-Res   |

Cache trên desktop lưu riêng từng phiên bản của bài hát, kèm chất lượng NetEase thực tế, định dạng, bitrate, sample rate và bit depth. Lossless/Hi-Res chỉ được dùng lại khi chất lượng lưu khớp yêu cầu. FLAC cũ thiếu thông tin chất lượng được giữ là unknown, không tự gán Lossless hoặc Hi-Res. Khi phát cache, ứng dụng đọc theo stream và trả đúng đoạn byte được yêu cầu thay vì nạp toàn bộ file vào RAM.

## Chế độ âm thanh và tải xuống

Nhấn icon chế độ âm thanh trên miniplayer để chọn **Tắt**, **Spatial Audio**, **Audio Vivid** hoặc **Surround Audio**. Đổi chế độ áp dụng cho bài hiện tại và giữ vị trí phát cùng trạng thái phát/tạm dừng. Menu nằm trong vùng màn hình ngay cả khi miniplayer thu gọn.

Khi bật tùy chọn hiển thị nút tải xuống trong Settings, nhấn nút tải ở bài hát để chọn chất lượng:

| Mức tải | Giá trị API |
| --- | --- |
| Spatial Audio | `jyeffect` |
| Audio Vivid | `vivid` |
| Surround Audio | `sky` |
| Master | `jymaster` |
| Hi-Res | `hires` |
| Lossless | `lossless` |
| HQ · 320 kbps | `exhigh` |
| Tiêu chuẩn · 128 kbps | `standard` |

Ứng dụng kiểm tra khả năng sử dụng theo bài hát và tài khoản NetEase hiện tại. Mục không hỗ trợ hoặc chưa kiểm tra được sẽ mờ; nhấn vào sẽ hiện thông báo. Quyền tải được kiểm tra riêng bằng API tải xuống và kiểm tra lại trước khi tải. Nếu không được cấp đúng chất lượng đã chọn, ứng dụng không tự tải bản thấp hơn, bản nghe thử hoặc nguồn thay thế. File giữ định dạng do API trả về.

Khả năng sử dụng phụ thuộc quyền tài khoản, phiên bản âm thanh của từng bài và thiết bị đầu ra. Không phải bài nào cũng có đủ các mức chất lượng. Spatial Audio, Audio Vivid, Surround Audio và Lossless giữ nguyên tên trong giao diện tiếng Việt.

Bản trước đây **v2.8.9** đã sửa lỗi đăng ký trùng API tải xuống khiến bản EXE thử nghiệm không mở được. Xem [changelog tiếng Anh](https://github.com/Lynx-1ST/R3PLAY/releases/tag/v2.8.9) để biết đầy đủ thay đổi. Có thể cài đè bản hiện tại mà không cần gỡ app hoặc xóa dữ liệu; nếu bản cũ còn chạy nền, kết thúc R3PLAYX trong Task Manager trước khi cài.

## Một số lệnh hữu ích

```bash
pnpm lint
pnpm format
pnpm --filter web test
pnpm --filter web test:types
pnpm --filter desktop test
pnpm --filter desktop test:types
pnpm --filter desktop test:cache
```

## Các dự án upstream

R3PLAYX kế thừa và sử dụng nhiều dự án mã nguồn mở, bao gồm:

- [Sherlockouo/music](https://github.com/Sherlockouo/music)
- [YesPlayMusic](https://github.com/qier222/YesPlayMusic)
- [NeteaseCloudMusicApi Enhanced](https://github.com/NeteaseCloudMusicApiEnhanced/api-enhanced)
- [UnblockNeteaseMusic](https://github.com/UnblockNeteaseMusic/server)

Thiết kế UI gốc được ghi công cho [JACKCRING](https://jackcring.com).

## Giấy phép và tuyên bố miễn trừ

Repository này được phân phối theo **GNU Affero General Public License v3.0 (AGPL-3.0)** như được khai báo trong file `LICENSE`.

Đây là client không chính thức và không liên kết với NetEase, Apple, YouTube hoặc các nhà cung cấp dịch vụ được nhắc đến. Hãy sử dụng có trách nhiệm và tuân thủ điều khoản dịch vụ cũng như pháp luật áp dụng tại nơi bạn sử dụng phần mềm.

README của upstream còn có thêm các tuyên bố về phạm vi sử dụng. Nên đọc các thông báo của upstream trước khi phân phối lại hoặc triển khai công khai.

## Tài nguyên cho developer

- [Developer wiki của upstream](https://github.com/Sherlockouo/music/wiki/For-Developers)
- [Repository upstream](https://github.com/Sherlockouo/music)
- [Web demo của upstream](https://music.xtify.top/)
