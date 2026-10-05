// Contact details for the whole site. Leave a value empty to show the
// poster's placeholder text instead of a working link.
const CONTACT = {
  phone: "",      // e.g. "0812345678"
  lineId: "",     // LINE Official Account ID including "@", e.g. "@checkkhum"
  lineQr: "",     // e.g. "assets/line-qr.png"
};

(function () {
  const phoneDigits = CONTACT.phone.replace(/\D/g, "");
  const lineUrl = CONTACT.lineId
    ? "https://line.me/R/ti/p/" + encodeURIComponent(CONTACT.lineId)
    : "";

  function formatPhone(digits) {
    return digits.length === 10
      ? digits.replace(/(\d{3})(\d{3})(\d{4})/, "$1-$2-$3")
      : digits;
  }

  // Contact links
  document.querySelectorAll('[data-contact="phone"]').forEach((el) => {
    if (phoneDigits) {
      el.href = "tel:" + phoneDigits;
      el.textContent = formatPhone(phoneDigits);
    } else {
      el.setAttribute("data-placeholder", "");
      el.removeAttribute("href");
    }
  });
  document.querySelectorAll('[data-contact="line"]').forEach((el) => {
    if (lineUrl) {
      el.href = lineUrl;
      el.textContent = CONTACT.lineId;
    } else {
      el.setAttribute("data-placeholder", "");
      el.removeAttribute("href");
    }
  });
  document.querySelectorAll('[data-contact="phone-link"]').forEach((el) => {
    if (phoneDigits) el.href = "tel:" + phoneDigits;
  });
  document.querySelectorAll('[data-contact="line-link"]').forEach((el) => {
    if (lineUrl) el.href = lineUrl;
  });
  document.querySelectorAll('[data-contact="qr"]').forEach((el) => {
    if (CONTACT.lineQr) {
      const img = document.createElement("img");
      img.src = CONTACT.lineQr;
      img.alt = "QR code สำหรับเพิ่มเพื่อนทาง LINE";
      el.appendChild(img);
    } else {
      el.textContent = "พื้นที่สำหรับ QR LINE";
      el.classList.add("is-placeholder");
    }
  });

  // Quote form
  const form = document.getElementById("quote-form");
  const ready = document.getElementById("quote-ready");
  const summaryEl = document.getElementById("quote-summary");
  const sendLine = document.getElementById("send-line");
  const copyBtn = document.getElementById("copy-summary");
  const copyStatus = document.getElementById("copy-status");
  const editBtn = document.getElementById("edit-request");
  const groups = form.querySelectorAll(".field-group");

  function selectedPlan() {
    return form.querySelector('input[name="plan"]:checked');
  }

  function syncGroups() {
    const kind = selectedPlan().dataset.kind === "travel" ? "travel" : "car";
    groups.forEach((g) => { g.hidden = g.dataset.for !== kind; });
  }
  form.addEventListener("change", (e) => {
    if (e.target.name === "plan") syncGroups();
  });
  syncGroups();

  function setError(input, show) {
    const msg = document.getElementById(input.getAttribute("aria-describedby"));
    input.setAttribute("aria-invalid", show ? "true" : "false");
    msg.hidden = !show;
  }

  function validate() {
    const name = form.elements.name;
    const phone = form.elements.phone;
    const nameOk = name.value.trim().length > 0;
    const phoneOk = /^0\d{9}$/.test(phone.value.replace(/\D/g, ""));
    setError(name, !nameOk);
    setError(phone, !phoneOk);
    if (!nameOk) name.focus();
    else if (!phoneOk) phone.focus();
    return nameOk && phoneOk;
  }

  function buildSummary() {
    const f = form.elements;
    const plan = selectedPlan();
    const lines = ["ขอใบเสนอราคา: " + plan.value];
    if (plan.dataset.kind === "travel") {
      if (f.destination.value.trim()) lines.push("ปลายทาง: " + f.destination.value.trim());
      if (f.tripDays.value.trim()) lines.push("จำนวนวัน: " + f.tripDays.value.trim());
    } else {
      if (f.carModel.value.trim()) lines.push("รถ: " + f.carModel.value.trim());
      if (f.carYear.value.trim()) lines.push("ปีรถ: " + f.carYear.value.trim());
    }
    lines.push("ชื่อ: " + f.name.value.trim());
    lines.push("เบอร์โทร: " + formatPhone(f.phone.value.replace(/\D/g, "")));
    return lines.join("\n");
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!validate()) return;
    const text = buildSummary();
    summaryEl.textContent = text;

    if (CONTACT.lineId) {
      sendLine.href = "https://line.me/R/oaMessage/" + encodeURIComponent(CONTACT.lineId) + "/?" + encodeURIComponent(text);
      sendLine.removeAttribute("aria-disabled");
      sendLine.textContent = "ส่งทาง LINE";
    } else if (phoneDigits) {
      sendLine.href = "tel:" + phoneDigits;
      sendLine.removeAttribute("aria-disabled");
      sendLine.textContent = "โทรหาเรา " + formatPhone(phoneDigits);
    } else {
      sendLine.removeAttribute("href");
      sendLine.setAttribute("aria-disabled", "true");
      sendLine.textContent = "ช่องทางส่งยังไม่เปิดใช้งาน";
    }

    copyStatus.textContent = "";
    form.hidden = true;
    ready.hidden = false;
    ready.focus();
  });

  copyBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(summaryEl.textContent);
      copyStatus.textContent = "คัดลอกข้อความแล้ว";
    } catch {
      copyStatus.textContent = "คัดลอกไม่สำเร็จ เลือกข้อความด้านบนแล้วคัดลอกเองได้";
    }
  });

  editBtn.addEventListener("click", () => {
    ready.hidden = true;
    form.hidden = false;
    form.elements.name.focus();
  });

  // Hide the floating mobile button while the quote slip is on screen.
  const mobileCta = document.querySelector(".mobile-cta");
  const quote = document.getElementById("quote");
  if ("IntersectionObserver" in window && mobileCta) {
    new IntersectionObserver(([entry]) => {
      mobileCta.classList.toggle("is-hidden", entry.isIntersecting);
      if (entry.isIntersecting) mobileCta.setAttribute("tabindex", "-1");
      else mobileCta.removeAttribute("tabindex");
    }, { threshold: 0.15 }).observe(quote);
  }
})();
