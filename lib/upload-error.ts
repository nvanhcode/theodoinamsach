// Proxies (Nginx, Cloudflare) answer oversized or failed uploads with HTML or
// plain text, so the client cannot rely on a JSON error body.
export function uploadError(status: number, error: unknown, name: string) {
  if (typeof error === "string" && error) return error;
  if (status === 413)
    return name + ": tệp vượt giới hạn dung lượng của máy chủ (tối đa 25 MB).";
  return (
    name +
    ": máy chủ chưa nhận được tệp (mã lỗi " +
    status +
    "). Vui lòng thử lại."
  );
}
