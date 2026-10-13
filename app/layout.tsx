import type { Metadata, Viewport } from "next";
import "./globals.css";
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};
export const metadata: Metadata = {
  title: "Đảng ủy xã Nam Sách | Điều hành kết luận",
  description:
    "Hệ thống theo dõi thực hiện kết luận, chỉ đạo của Thường trực, Ban Chấp hành, Ban Thường vụ Đảng ủy xã Nam Sách",
  icons: { icon: "/bua-liem-nam-sach.png" },
};
import { ClientProviders } from "@/components/client-providers";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <body>
        <ClientProviders>{children}</ClientProviders>
      </body>
    </html>
  );
}
