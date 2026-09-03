import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { emailConfig, emailTemplate, isEmailEnabled } from "@/lib/email";

const ORIGINAL_ENV = { ...process.env };

function resetEnv(): void {
  delete process.env.RESEND_API_KEY;
  delete process.env.EMAIL_FROM;
}

beforeEach(resetEnv);
afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("emailConfig", () => {
  it("null ketika kunci belum diset — email BUKAN kebutuhan wajib", () => {
    expect(emailConfig()).toBeNull();
  });

  it("null ketika hanya salah satu dari API key atau alamat pengirim yang diset", () => {
    process.env.RESEND_API_KEY = "re_test_key";
    expect(emailConfig()).toBeNull();

    resetEnv();
    process.env.EMAIL_FROM = "noreply@tanafus.test";
    expect(emailConfig()).toBeNull();
  });

  it("mengembalikan konfigurasi ketika keduanya diset", () => {
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.EMAIL_FROM = "noreply@tanafus.test";
    expect(emailConfig()).toEqual({
      apiKey: "re_test_key",
      from: "noreply@tanafus.test",
    });
  });

  it("memangkas spasi di sekitar nilai environment", () => {
    process.env.RESEND_API_KEY = "  re_test_key  ";
    process.env.EMAIL_FROM = "  noreply@tanafus.test  ";
    expect(emailConfig()).toEqual({
      apiKey: "re_test_key",
      from: "noreply@tanafus.test",
    });
  });
});

describe("isEmailEnabled", () => {
  it("mengikuti keberadaan konfigurasi", () => {
    expect(isEmailEnabled()).toBe(false);
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.EMAIL_FROM = "noreply@tanafus.test";
    expect(isEmailEnabled()).toBe(true);
  });
});

describe("emailTemplate", () => {
  it("menyertakan judul dan isi apa adanya ketika tidak memuat karakter HTML", () => {
    const html = emailTemplate({
      title: "Sesi diliburkan",
      body: "Sesi Fatimah Hasan pada Kamis diliburkan guru.",
    });
    expect(html).toContain("Sesi diliburkan");
    expect(html).toContain("Sesi Fatimah Hasan pada Kamis diliburkan guru.");
  });

  it("meng-escape karakter HTML pada judul dan isi", () => {
    const html = emailTemplate({
      title: "<script>alert(1)</script>",
      body: 'Murid "Ali & Kawan" < 5 tahun',
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).toContain("&quot;Ali &amp; Kawan&quot; &lt; 5 tahun");
  });

  it("menandai identitas lembaga di setiap email", () => {
    expect(emailTemplate({ title: "T", body: "B" })).toContain(
      "Tanafus Center",
    );
  });
});
