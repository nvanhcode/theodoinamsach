"use client";

import React from "react";
import { Eye, EyeOff, ShieldCheck, LockKeyhole } from "lucide-react";
import { Toaster, toast } from "sonner";
import { useApp } from "@/components/app-context";
import { Btn, Field, api } from "@/components/common-ui";

export function LoginView() {
  const [showCurrentPassword, setShowCurrentPassword] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);
  const {
    user,
    setUser,
    form,
    setForm,
    change,
    error,
    setError,
    busy,
    setBusy,
    load,
    navigate,
    initialized,
  } = useApp();

  return (
    <>
      <Toaster richColors />
      <div className="login-page">
        <section className="login-intro">
          <div className="flex items-center gap-4">
            <span className="brand-mark">
              <img src="/bua-liem-nam-sach.png" alt="Biểu trưng búa liềm" />
            </span>
            <div>
              <strong>ĐẢNG ỦY XÃ NAM SÁCH</strong>
              <div className="eyebrow mt-1">THÀNH PHỐ HẢI PHÒNG</div>
            </div>
          </div>
          <div>
            <div className="eyebrow">VĂN PHÒNG ĐẢNG ỦY</div>
            <h1>
              HỆ THỐNG THEO DÕI THỰC HIỆN
              <br />
              KẾT LUẬN, CHỈ ĐẠO CỦA THƯỜNG TRỰC,
              <br />
              BAN CHẤP HÀNH, BAN THƯỜNG VỤ ĐẢNG ỦY
            </h1>
            <div className="login-line" />
            <p>
              Hệ thống theo dõi thực hiện kết luận, chỉ đạo của Thường trực, Ban
              Chấp hành, Ban Thường vụ Đảng ủy. Kết nối giao việc, tiến độ và
              kết quả thực hiện.
            </p>
          </div>
          <div className="flex items-center gap-3 text-sm text-rose-200">
            <ShieldCheck size={20} />
            Tài khoản được quản lý bởi Văn phòng Đảng ủy
          </div>
        </section>
        <section className="login-form-area">
          <form
            className="login-form"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              try {
                if (user?.mustChange) {
                  await api("password", {
                    old: form.old,
                    password: form.password,
                  });
                  setUser(null);
                  setForm({});
                  toast.success("Đã đổi mật khẩu. Vui lòng đăng nhập lại.");
                  navigate("login");
                } else {
                  const r = await api("login", form);
                  if (r.user.mustChange) setUser(r.user);
                  else {
                    await load();
                    navigate("dashboard");
                  }
                  setForm({});
                }
              } catch (e: any) {
                setError(e.message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <div className="mb-6 inline-flex rounded-xl bg-rose-50 p-3 text-rose-800">
              <LockKeyhole size={25} />
            </div>
            <h2>
              {user?.mustChange ? "Đổi mật khẩu lần đầu" : "Đăng nhập hệ thống"}
            </h2>
            <p>
              {user?.mustChange
                ? "Bạn có thể đổi mật khẩu ngay hoặc chọn Bỏ qua, đổi sau."
                : "Đăng nhập bằng tài khoản do Văn phòng Đảng ủy quản lý."}
            </p>
            {user?.mustChange ? (
              <Field label="Mật khẩu tạm thời / hiện tại">
                <div className="password-input-wrap">
                  <input
                    required
                    type={showCurrentPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={form.old || ""}
                    onChange={(e) => change("old", e.target.value)}
                  />
                  <button
                    className="password-visibility-toggle"
                    type="button"
                    aria-label={
                      showCurrentPassword
                        ? "Ẩn mật khẩu hiện tại"
                        : "Hiện mật khẩu hiện tại"
                    }
                    aria-pressed={showCurrentPassword}
                    title={
                      showCurrentPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"
                    }
                    onClick={() =>
                      setShowCurrentPassword((visible) => !visible)
                    }
                  >
                    {showCurrentPassword ? (
                      <EyeOff size={18} />
                    ) : (
                      <Eye size={18} />
                    )}
                  </button>
                </div>
              </Field>
            ) : (
              <Field label="Tên đăng nhập">
                <input
                  required
                  autoComplete="username"
                  placeholder="Tên đăng nhập của bạn"
                  value={form.username || ""}
                  onChange={(e) => change("username", e.target.value)}
                />
              </Field>
            )}
            <Field
              label={
                user?.mustChange
                  ? "Mật khẩu mới (tối thiểu 12 ký tự)"
                  : "Mật khẩu"
              }
            >
              <div className="password-input-wrap">
                <input
                  required
                  minLength={user?.mustChange ? 12 : 1}
                  type={showPassword ? "text" : "password"}
                  autoComplete={
                    initialized && !user?.mustChange
                      ? "current-password"
                      : "new-password"
                  }
                  placeholder="Nhập mật khẩu"
                  value={form.password || ""}
                  onChange={(e) => change("password", e.target.value)}
                />
                <button
                  className="password-visibility-toggle"
                  type="button"
                  aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                  aria-pressed={showPassword}
                  title={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                  onClick={() => setShowPassword((visible) => !visible)}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </Field>
            {error && (
              <div className="error-box" role="alert">
                {error}
              </div>
            )}
            <Btn type="submit" primary disabled={busy}>
              {busy
                ? "Đang xử lý…"
                : user?.mustChange
                  ? "Lưu mật khẩu mới"
                  : "Đăng nhập"}
            </Btn>
            {user?.mustChange && (
              <Btn
                type="button"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  setError("");
                  try {
                    await api("password-skip", {});
                    await load();
                    setForm({});
                    navigate("dashboard");
                    toast.success(
                      "Đã vào hệ thống. Bạn có thể đổi mật khẩu tại Cài đặt hệ thống → Tài khoản cá nhân.",
                    );
                  } catch (e: any) {
                    setError(e.message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Bỏ qua, đổi sau
              </Btn>
            )}
            <div className="login-foot">
              <ShieldCheck size={15} />
              Phiên đăng nhập được bảo vệ
            </div>
          </form>
        </section>
      </div>
    </>
  );
}
