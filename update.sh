#!/usr/bin/env bash
# ==============================================================================
# SCRIPT CẬP NHẬT & TRIỂN KHAI DỰ ÁN DOCKER - NAM SÁCH
# Chạy script này mỗi khi cập nhật mã nguồn hoặc cấu hình mới
# ==============================================================================

set -euo pipefail

# Màu hiển thị terminal
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo -e "${BLUE}======================================================${NC}"
echo -e "${BLUE}   TIẾN TRÌNH CẬP NHẬT DỰ ÁN DOCKER (NAM SÁCH)       ${NC}"
echo -e "${BLUE}======================================================${NC}"

# 1. Kiểm tra Docker
if ! command -v docker &> /dev/null; then
  echo -e "${RED}[LỖI] Docker chưa được cài đặt trên hệ thống! Vui lòng cài Docker trước.${NC}"
  exit 1
fi

# Xác định lệnh Docker Compose (docker compose v2 hoặc docker-compose v1)
if docker compose version &> /dev/null; then
  COMPOSE_CMD="docker compose"
elif command -v docker-compose &> /dev/null; then
  COMPOSE_CMD="docker-compose"
else
  echo -e "${RED}[LỖI] Không tìm thấy lệnh Docker Compose!${NC}"
  exit 1
fi

echo -e "${GREEN}[OK] Sử dụng: $COMPOSE_CMD${NC}"

# 2. Đảm bảo thư mục data ngoài host tồn tại để mount database
if [ ! -d "data" ]; then
  echo -e "${YELLOW}[INFO] Đang tạo thư mục data/ trên máy chủ để lưu database SQLite & files...${NC}"
  mkdir -p data
  chmod 755 data
fi
echo -e "${GREEN}[OK] Thư mục lưu trữ database: ./data (mount vào /data bên trong Docker)${NC}"

# 3. Kiểm tra hoặc khởi tạo file .env
if [ ! -f ".env" ]; then
  echo -e "${YELLOW}[INFO] Chưa tìm thấy file .env, đang tự động khởi tạo...${NC}"
  if command -v openssl &> /dev/null; then
    RAND_TOKEN="$(openssl rand -hex 32)"
  else
    RAND_TOKEN="$(cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 64 | head -n 1)"
  fi

  cat <<EOF > .env
DOMAIN=theogioinamsach.com
SETUP_TOKEN=$RAND_TOKEN
EOF
  chmod 600 .env
  echo -e "${GREEN}[OK] Đã tạo file .env với DOMAIN=theogioinamsach.com và SETUP_TOKEN tự sinh.${NC}"
else
  # Đảm bảo quyền an toàn cho file .env
  chmod 600 .env
  echo -e "${GREEN}[OK] Tìm thấy file .env hiện tại.${NC}"
fi

# Đọc cấu hình DOMAIN từ .env để hiển thị
APP_DOMAIN=$(grep -E '^DOMAIN=' .env | cut -d '=' -f2- | tr -d '"' | tr -d "'" || echo "theogioinamsach.com")

# 4. Rebuild image Docker để cập nhật mã nguồn mới
echo -e "\n${BLUE}>>> Đang Rebuild Docker Image với mã nguồn mới...${NC}"
$COMPOSE_CMD build

# 5. Khởi động lại các container
echo -e "\n${BLUE}>>> Đang khởi động lại dịch vụ qua Docker Compose...${NC}"
$COMPOSE_CMD up -d --remove-orphans

# 6. Dọn dẹp ảnh Docker cũ (dangling images) để tiết kiệm dung lượng ổ đĩa
echo -e "\n${BLUE}>>> Đang dọn dẹp các Docker image rác không sử dụng...${NC}"
docker image prune -f > /dev/null 2>&1 || true

# 7. Kiểm tra trạng thái các container
echo -e "\n${BLUE}>>> Trạng thái các container hiện tại:${NC}"
$COMPOSE_CMD ps

# 8. Xem log kiểm tra ứng dụng
echo -e "\n${BLUE}>>> Kiểm tra log ứng dụng gần nhất:${NC}"
$COMPOSE_CMD logs --tail=15 app

echo -e "\n${GREEN}======================================================${NC}"
echo -e "${GREEN}   CẬP NHẬT DỰ ÁN HOÀN TẤT THÀNH CÔNG!                ${NC}"
echo -e "${GREEN}   Tên miền: https://${APP_DOMAIN}                    ${NC}"
echo -e "${GREEN}   Cơ sở dữ liệu lưu tại: $(pwd)/data                ${NC}"
echo -e "${GREEN}======================================================${NC}"
