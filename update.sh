#!/bin/sh
# ==============================================================================
# SCRIPT CẬP NHẬT & TRIỂN KHAI DỰ ÁN DOCKER - NAM SÁCH
# Tương thích 100% cả sh (dash/posix), bash và zsh
# ==============================================================================

set -eu

# Màu hiển thị terminal
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

printf "%b\n" "${BLUE}======================================================${NC}"
printf "%b\n" "${BLUE}   TIẾN TRÌNH CẬP NHẬT DỰ ÁN DOCKER (NAM SÁCH)       ${NC}"
printf "%b\n" "${BLUE}======================================================${NC}"

# 1. Kiểm tra Docker
if ! command -v docker > /dev/null 2>&1; then
  printf "%b\n" "${RED}[LỖI] Docker chưa được cài đặt trên hệ thống! Vui lòng cài Docker trước.${NC}"
  exit 1
fi

# Xác định lệnh Docker Compose (docker compose v2 hoặc docker-compose v1)
if docker compose version > /dev/null 2>&1; then
  COMPOSE_CMD="docker compose"
elif command -v docker-compose > /dev/null 2>&1; then
  COMPOSE_CMD="docker-compose"
else
  printf "%b\n" "${RED}[LỖI] Không tìm thấy lệnh Docker Compose!${NC}"
  exit 1
fi

printf "%b\n" "${GREEN}[OK] Sử dụng: $COMPOSE_CMD${NC}"

# 2. Đảm bảo thư mục data ngoài host tồn tại để mount database
if [ ! -d "data" ]; then
  printf "%b\n" "${YELLOW}[INFO] Đang tạo thư mục data/ trên máy chủ để lưu database SQLite & files...${NC}"
  mkdir -p data
  chmod 755 data
fi
printf "%b\n" "${GREEN}[OK] Thư mục lưu trữ database: ./data (mount vào /data bên trong Docker)${NC}"

# 3. Kiểm tra hoặc khởi tạo file .env
if [ ! -f ".env" ]; then
  printf "%b\n" "${YELLOW}[INFO] Chưa tìm thấy file .env, đang tự động khởi tạo...${NC}"
  if command -v openssl > /dev/null 2>&1; then
    RAND_TOKEN="$(openssl rand -hex 32)"
  else
    RAND_TOKEN="$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')"
  fi

  cat <<EOF > .env
DOMAIN=theogioinamsach.com
HOST_PORT=8208
APP_ORIGIN=https://theogioinamsach.com
SETUP_TOKEN=$RAND_TOKEN
EOF
  chmod 600 .env
  printf "%b\n" "${GREEN}[OK] Đã tạo file .env với DOMAIN=theogioinamsach.com, HOST_PORT=8208.${NC}"
else
  chmod 600 .env
  printf "%b\n" "${GREEN}[OK] Tìm thấy file .env hiện tại.${NC}"
fi

# Đọc cấu hình từ .env để hiển thị
APP_DOMAIN="$(grep -E '^DOMAIN=' .env 2>/dev/null | cut -d '=' -f2- | tr -d '"' | tr -d "'" || echo "theogioinamsach.com")"
APP_PORT="$(grep -E '^HOST_PORT=' .env 2>/dev/null | cut -d '=' -f2- | tr -d '"' | tr -d "'" || echo "8208")"

# 4. Rebuild image Docker để cập nhật mã nguồn mới
printf "%b\n" "\n${BLUE}>>> Đang Rebuild Docker Image với mã nguồn mới...${NC}"
$COMPOSE_CMD build

# 5. Khởi động lại các container
printf "%b\n" "\n${BLUE}>>> Đang khởi động lại dịch vụ qua Docker Compose...${NC}"
$COMPOSE_CMD up -d --remove-orphans

# 6. Dọn dẹp ảnh Docker cũ (dangling images) để tiết kiệm dung lượng ổ đĩa
printf "%b\n" "\n${BLUE}>>> Đang dọn dẹp các Docker image rác không sử dụng...${NC}"
docker image prune -f > /dev/null 2>&1 || true

# 7. Kiểm tra trạng thái các container
printf "%b\n" "\n${BLUE}>>> Trạng thái các container hiện tại:${NC}"
$COMPOSE_CMD ps

# 8. Xem log kiểm tra ứng dụng
printf "%b\n" "\n${BLUE}>>> Kiểm tra log ứng dụng gần nhất:${NC}"
$COMPOSE_CMD logs --tail=15 app

printf "%b\n" "\n${GREEN}======================================================${NC}"
printf "%b\n" "${GREEN}   CẬP NHẬT DỰ ÁN HOÀN TẤT THÀNH CÔNG!                ${NC}"
printf "%b\n" "${GREEN}   Cổng máy thật: http://localhost:${APP_PORT} (hoặc http://IP:${APP_PORT}) ${NC}"
printf "%b\n" "${GREEN}   Tên miền: https://${APP_DOMAIN} (nếu qua Nginx reverse proxy) ${NC}"
printf "%b\n" "${GREEN}   Cơ sở dữ liệu lưu tại: $(pwd)/data                ${NC}"
printf "%b\n" "${GREEN}======================================================${NC}"
