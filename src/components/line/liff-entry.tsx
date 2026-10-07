"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { buttonClasses } from "../button";
import { LineIcon } from "../icons";

type Liff = (typeof import("@line/liff"))["default"];

type Phase =
  | { kind: "starting" }
  | { kind: "outside" } // a normal browser, not signed in to LINE yet
  | { kind: "verifying" }
  | { kind: "choose"; account?: string }
  | { kind: "linked" }
  | { kind: "error"; message: string; retry: boolean };

type Reply = { status: string; message?: string; next?: string; invite?: string; account?: string };

const inviteMessages: Record<string, string> = {
  invalid: "ลิงก์เชิญนี้หมดอายุหรือถูกใช้ไปแล้ว ขอลิงก์ใหม่จากทีมงานทาง LINE",
  customer_taken: "ข้อมูลลูกค้าในลิงก์นี้เชื่อมกับบัญชีอื่นแล้ว ติดต่อทีมงาน",
  already_linked: "บัญชีนี้เชื่อมกับข้อมูลลูกค้าอยู่แล้ว",
};

/**
 * LIFF entry: runs in LINE (Rich Menu → https://liff.line.me/<LIFF ID>) and in
 * normal browsers. The SDK is loaded only here, on the client. The page sends
 * the LINE ID token, nothing else, to /api/line/session, which verifies it
 * with LINE before any session exists.
 */
export function LiffEntry({ liffId, intent }: { liffId: string; intent: "login" | "link" }) {
  const [phase, setPhase] = useState<Phase>({ kind: "starting" });
  const liffRef = useRef<Liff | null>(null);
  const triedRefresh = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);

  const params = typeof window === "undefined" ? null : new URLSearchParams(window.location.search);
  const invite = params?.get("invite") ?? undefined;

  const send = useCallback(
    async (choice?: "link" | "new") => {
      const liff = liffRef.current;
      if (!liff) return;
      const idToken = liff.getIDToken();
      if (!idToken) {
        setPhase({ kind: "error", message: "LINE ไม่ส่งข้อมูลยืนยันตัวตนมา (ตรวจว่า LIFF app เปิด scope openid แล้ว)", retry: false });
        return;
      }
      setPhase({ kind: "verifying" });
      let reply: Reply;
      let status = 0;
      try {
        const res = await fetch("/api/line/session", {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ idToken, mode: intent, choice, invite: invite && /^[0-9a-f]{48}$/.test(invite) ? invite : undefined }),
        });
        status = res.status;
        reply = (await res.json().catch(() => ({ status: "error" }))) as Reply;
      } catch {
        setPhase({ kind: "error", message: "เชื่อมต่ออินเทอร์เน็ตไม่ได้ ลองใหม่อีกครั้ง", retry: true });
        return;
      }

      if (status === 401 && intent === "login" && !triedRefresh.current) {
        // The LINE token was stale: sign in to LINE again once for a fresh one.
        triedRefresh.current = true;
        liff.logout();
        liff.login({ redirectUri: window.location.href });
        return;
      }
      if (reply.status === "choose") return setPhase({ kind: "choose", account: reply.account });
      if (reply.status === "signed_in" || reply.status === "linked") {
        const inviteNote = reply.invite && reply.invite !== "linked" ? inviteMessages[reply.invite] : undefined;
        if (inviteNote) {
          setPhase({ kind: "error", message: `${inviteNote} (เข้าสู่ระบบแล้ว)`, retry: false });
          window.setTimeout(() => window.location.replace(reply.next ?? "/customer"), 3500);
          return;
        }
        if (reply.status === "linked") setPhase({ kind: "linked" });
        window.location.replace(reply.next ?? "/customer");
        return;
      }
      setPhase({ kind: "error", message: reply.message ?? "เข้าสู่ระบบด้วย LINE ไม่สำเร็จ ลองใหม่อีกครั้ง", retry: reply.status !== "staff" });
    },
    [intent, invite],
  );

  const start = useCallback(async () => {
    try {
      const { default: liff } = await import("@line/liff");
      await liff.init({ liffId });
      liffRef.current = liff;
      // LIFF re-opens the page at the right path itself after init.
      if (new URLSearchParams(window.location.search).has("liff.state")) return;

      if (!liff.isLoggedIn()) {
        if (liff.isInClient() || new URLSearchParams(window.location.search).get("start") === "1") {
          liff.login({ redirectUri: withoutStart(window.location.href) });
          return;
        }
        setPhase({ kind: "outside" });
        return;
      }
      await send();
    } catch {
      setPhase({
        kind: "error",
        message: "เปิดการเข้าสู่ระบบด้วย LINE ไม่สำเร็จ ลองเปิดจากเมนูในแชท LINE ของเช็กคุ้ม หรือใช้อีเมลแทน",
        retry: true,
      });
    }
  }, [liffId, send]);

  useEffect(() => {
    // Starts the LIFF SDK once; every state update in start() happens after an await.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void start();
  }, [start]);

  useEffect(() => {
    if (phase.kind !== "starting" && phase.kind !== "verifying") heading.current?.focus();
  }, [phase.kind]);

  const loginInBrowser = () => {
    const liff = liffRef.current;
    if (liff) liff.login({ redirectUri: window.location.href });
  };
  const openInLine = `https://liff.line.me/${liffId}${invite ? `?invite=${invite}` : ""}`;

  return (
    <div aria-live="polite">
      {(phase.kind === "starting" || phase.kind === "verifying" || phase.kind === "linked") && (
        <div className="flex items-center gap-3 py-2" role="status">
          <span className="size-6 shrink-0 animate-spin rounded-full border-[3px] border-mint border-t-teal motion-reduce:animate-none" aria-hidden="true" />
          <p className="font-semibold text-navy">
            {phase.kind === "starting" ? "กำลังเปิด LINE" : phase.kind === "linked" ? "เชื่อมบัญชี LINE แล้ว" : "กำลังตรวจสอบกับ LINE"}
          </p>
        </div>
      )}

      {phase.kind === "outside" && (
        <div>
          <h2 ref={heading} tabIndex={-1} className="text-[1.35rem] outline-none">
            คุณเปิดหน้านี้นอกแอป LINE
          </h2>
          <p className="mt-2">
            เปิดจากเมนูในแชท LINE ของเช็กคุ้มเพื่อเข้าใช้งานได้ทันที หรือเข้าสู่ระบบด้วยบัญชี LINE ในเบราว์เซอร์นี้
          </p>
          <div className="mt-5 grid gap-3">
            <button type="button" onClick={loginInBrowser} className={`${buttonClasses("primary", "md", true)} gap-2`}>
              <LineIcon className="size-6 shrink-0" />
              {intent === "link" ? "ยืนยันบัญชี LINE เพื่อเชื่อม" : "เข้าสู่ระบบด้วย LINE"}
            </button>
            <a href={openInLine} className={buttonClasses("outline", "md", true)}>
              เปิดในแอป LINE
            </a>
            {intent === "login" && (
              <Link href="/customer/login" className={buttonClasses("quiet", "md", true)}>
                ใช้อีเมลเข้าสู่ระบบแทน
              </Link>
            )}
          </div>
        </div>
      )}

      {phase.kind === "choose" && (
        <div>
          <h2 ref={heading} tabIndex={-1} className="text-[1.35rem] outline-none">
            เชื่อมบัญชี LINE กับบัญชีที่เข้าสู่ระบบอยู่?
          </h2>
          <p className="mt-2">
            เบราว์เซอร์นี้เข้าสู่ระบบด้วยบัญชี {phase.account ?? "อีเมล"} อยู่ เชื่อม LINE กับบัญชีนี้ แล้วครั้งต่อไปเปิดจาก LINE ได้เลยโดยไม่ต้องใส่รหัสผ่าน
          </p>
          <div className="mt-5 grid gap-3">
            <button type="button" onClick={() => void send("link")} className={buttonClasses("primary", "md", true)}>
              เชื่อมกับบัญชีนี้
            </button>
            <button type="button" onClick={() => void send("new")} className={buttonClasses("outline", "md", true)}>
              ไม่ใช่ฉัน ใช้บัญชี LINE แยก
            </button>
          </div>
        </div>
      )}

      {phase.kind === "error" && (
        <div>
          <h2 ref={heading} tabIndex={-1} className="text-[1.35rem] outline-none">
            ยังเข้าสู่ระบบไม่ได้
          </h2>
          <p role="alert" className="mt-3 rounded-[var(--radius-control)] bg-error-bg px-3 py-2 text-error">
            {phase.message}
          </p>
          <div className="mt-5 grid gap-3">
            {phase.retry && (
              <button
                type="button"
                onClick={() => {
                  setPhase({ kind: "starting" });
                  void start();
                }}
                className={buttonClasses("primary", "md", true)}
              >
                ลองอีกครั้ง
              </button>
            )}
            <Link href="/customer/login" className={buttonClasses("outline", "md", true)}>
              ใช้อีเมลเข้าสู่ระบบ
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function withoutStart(href: string): string {
  const url = new URL(href);
  url.searchParams.delete("start");
  return url.toString();
}
