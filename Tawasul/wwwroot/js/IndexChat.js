// المتغيرات العامة
let currentConvId = null;
let currentType = null;
let fabricCanvas = null;
let currentDrawingColor = '#ff0000';
let currentDrawingWidth = 3;
const appEl = document.querySelector('[data-user-id]');
const currentUserId = appEl ? appEl.dataset.userId : "";
let replyToMessageId = null;
// تسريع Peer Info
const peerCache = new Map(); // convId -> data
let peerFetchAbort = null;   // لإلغاء الطلب السابق إن وُجد
let messagesAbort = null;         // لإلغاء طلب الرسائل السابق
const BATCH_SIZE = 25; 



// 🆕 استخراج الروابط من النص
const URL_REGEX = /https?:\/\/[^\s<>"']+/gi;

function extractUrls(text) {
    if (!text) return [];
    return (text.match(URL_REGEX) || []).slice(0, 6); // حد أقصى 6 روابط لكل رسالة
}

function getDomain(u) {
    try { return new URL(u).hostname.toLowerCase(); } catch { return ""; }
}

function normalizeUrl(u) {
    try {
        const url = new URL(u);
        // إزالة الـfragment فقط
        url.hash = "";
        return url.toString();
    } catch { return u; }
}

// 🆕 تقييم أمان بسيط (عميل) — هيوريستكس سريعة
function quickSafetyCheck(url) {
    const reasons = [];
    let level = "safe"; // safe | warn | dang

    // بروتوكولات ممنوعة
    if (!/^https?:\/\//i.test(url)) {
        reasons.push("بروتوكول غير مدعوم");
        level = "dang";
    }

    const d = getDomain(url);

    // دومين فارغ
    if (!d) { reasons.push("رابط غير صالح"); level = "dang"; }

    // IP مباشرة
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(d)) { reasons.push("رابط إلى IP مباشرة"); level = "warn"; }

    // Punycode
    if (d.startsWith("xn--")) { reasons.push("دومين مموّه (Punycode)"); level = "warn"; }

    // TLDs مشهورة بالسبام (أمثلة)
    if (/\.(zip|mov|top|xyz|click|work|gq|cf|ml)$/.test(d)) { reasons.push("نطاق عالي الخطورة محتمل"); level = (level === "dang" ? "dang" : "warn"); }

    // طول مفرط/معاملات كثيرة
    if (url.length > 300) { reasons.push("رابط طويل بشكل غير اعتيادي"); level = (level === "dang" ? "dang" : "warn"); }
    const paramsCount = (url.split("?")[1] || "").split("&").filter(Boolean).length;
    if (paramsCount > 8) { reasons.push("معاملات كثيرة في الرابط"); if (level !== "dang") level = "warn"; }

    // كلمات مخادعة
    if (/login|verify|update|free-gift|prize|bank|paypal/i.test(url)) {
        reasons.push("كلمات مخادعة محتملة");
        if (level !== "dang") level = "warn";
    }

    return { level, reasons, domain: d };
}





function escapeHtml(s) {
    return String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}



// حالة تحميل الوسائط في المودال
let piMediaPage = 1;
let piMediaPageSize = 24;
let piMediaKind = 'all';
let piMediaTotal = 0;

function resetPiMedia() {
    piMediaPage = 1;
    piMediaTotal = 0;
    $("#piMediaGrid").empty();
    $("#piMediaMore").addClass("d-none");
}

function loadPiMedia({ append = false } = {}) {
    if (!currentConvId) return;
    const grid = $("#piMediaGrid")[0];

    // سكيليتن بسيط
    if (!append) {
        $("#piMediaGrid").html('<div class="col-4"><div class="skel" style="height:100px"></div></div>'.repeat(6));
    }

    fetch(`/Chat/GetConversationMedia?conversationId=${currentConvId}&page=${piMediaPage}&pageSize=${piMediaPageSize}&kind=${piMediaKind}`)
        .then(r => r.ok ? r.json() : Promise.reject())
        .then(({ total, items }) => {
            piMediaTotal = total;

            // حضّر العناصر (نفس منطق buildMediaFragment)
            const frag = (function () {
                const f = document.createDocumentFragment();
                (items || []).forEach(m => {
                    const t = (m.type || "").toLowerCase();
                    const k = (m.kind || (
                        t.startsWith("image/") ? "image" :
                            t.startsWith("video/") ? "video" :
                                t.startsWith("audio/") ? "audio" : "file"
                    )).toLowerCase();

                    let el;
                    if (k === "image") {
                        el = $(`
           <div class="col-4 mb-3">
             <img loading="lazy" src="${m.url}" class="w-100 rounded-3 border"
                  style="object-fit:cover;height:100px;cursor:pointer" />
           </div>`);
                        el.find("img").on("click", () => window.open(m.url, "_blank"));
                    } else if (k === "video") {
                        el = $(`
           <div class="col-4 mb-3">
             <div class="position-relative rounded-3 border bg-black"
                  style="height:100px;cursor:pointer">
               <div class="position-absolute top-50 start-50 translate-middle text-white">🎥</div>
             </div>
           </div>`);
                        el.find("div").on("click", () => window.open(m.url, "_blank"));
                    } else if (k === "audio") {
                        el = $(`
           <div class="col-4 mb-3">
             <div class="d-flex align-items-center justify-content-center rounded-3 border bg-white p-2" style="height:100px;">
               🎧 <a class="ms-2 small text-decoration-none" target="_blank" href="${m.url}">تشغيل</a>
             </div>
           </div>`);
                    } else if (k === "link") {
                        el = $(`
           <div class="col-12 mb-2">
             <a class="d-block p-2 border rounded-3 text-truncate text-decoration-none" target="_blank" href="${m.url}">
               🔗 ${m.url}
             </a>
           </div>`);
                    } else {
                        el = $(`
           <div class="col-4 mb-3">
             <a download class="d-block p-2 rounded-3 border text-center text-decoration-none small" href="${m.url}">📎 ملف</a>
           </div>`);
                    }
                    f.appendChild(el[0]);
                });
                return f;
            })();

            if (!append) $("#piMediaGrid").empty();
            grid.appendChild(frag);

            // إظهار/إخفاء زر المزيد
            const shown = $("#piMediaGrid").children().length;
            if (shown < piMediaTotal) {
                $("#piMediaMore").removeClass("d-none");
            } else {
                $("#piMediaMore").addClass("d-none");
            }
        })
        .catch(() => {
            if (!append) {
                $("#piMediaGrid").html('<div class="text-center text-muted w-100 py-4">تعذّر تحميل الوسائط</div>');
            }
        });
}




// عند تحميل الصفحة
$(document).ready(() => {
    const params = new URLSearchParams(window.location.search);
    const openId = params.get("open");

    if (!openId) {
        $("#chatInputArea").hide();
        $("#emptyState").show();
    } else {
        $(`.conv-item[data-id='${openId}']`).trigger("click");
    }

    // قائمة الحساب
    $("#profileMenuBtn").on("click", function (e) {
        e.stopPropagation();
        $("#profileMenu").toggleClass("active");
    });

    $(document).on("click", function () {
        $("#profileMenu").removeClass("active");
    });

    $("#profileMenu").on("click", function (e) {
        e.stopPropagation();
    });
});


function renderChatSkeleton() {
    const body = $("#chatBody").empty();
    const wrap = $(`
    <div class="p-4">
      <div class="skel mb-3" style="height:16px;width:60%"></div>
      <div class="skel mb-3" style="height:16px;width:40%"></div>
      <div class="skel mb-3" style="height:16px;width:70%"></div>
      <div class="skel mb-3" style="height:16px;width:35%"></div>
      <div class="skel mb-3" style="height:16px;width:50%"></div>
    </div>
  `);
    body.append(wrap);
}

function chunk(arr, size = BATCH_SIZE) {
    const out = []; for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
}



// عند الضغط على محادثة
$(document).on("click", ".conv-item", function () {
    $(".conv-item").removeClass("active");
    $(this).addClass("active");

    $("#emptyState").hide();
    $("#chatInputArea").show();

    const id = $(this).data("id");
    const type = $(this).data("type");
    currentConvId = id;
    currentType = type;

    const name = $(this).find(".fw-bold:first").text().trim();
    const photo = $(this).find("img").attr("src") || "/images/avatars/default-avatar.png";

    $("#chatHeaderPhoto").attr("src", photo);
    $("#chatHeaderName").text(name);
    $("#chatHeader").show();

    if (type === "group") {
        $("#btnGroupInfo").removeClass("d-none").data("group-id", id);
        $("#btnPeerInfo").addClass("d-none").removeData("conversation-id");
        $("#onlineStatusBadge").hide();
        $("#chatHeaderStatus").text("");
    } else {
        $("#btnGroupInfo").addClass("d-none").removeData("group-id");
        $("#btnPeerInfo").removeClass("d-none").data("conversation-id", id);

        $.get(`/Chat/GetUserStatus?conversationId=${id}`, function (data) {
            if (data.isOnline) {
                $("#onlineStatusBadge").show().removeClass("bg-secondary").addClass("bg-success");
                $("#chatHeaderStatus").text("متصل الآن").css("color", "#10b981");
            } else if (data.lastSeenAt) {
                $("#onlineStatusBadge").show().removeClass("bg-success").addClass("bg-secondary");
                const lastSeen = new Date(data.lastSeenAt);
                const now = new Date();
                const diff = now - lastSeen;
                const minutes = Math.floor(diff / 60000);
                const hours = Math.floor(minutes / 60);
                const days = Math.floor(hours / 24);

                let statusText = "";
                if (minutes < 1) statusText = "آخر ظهور منذ لحظات";
                else if (minutes < 60) statusText = `آخر ظهور منذ ${minutes} دقيقة`;
                else if (hours < 24) statusText = `آخر ظهور منذ ${hours} ساعة`;
                else statusText = `آخر ظهور منذ ${days} يوم`;

                $("#chatHeaderStatus").text(statusText).css("color", "#6b7280");
            } else {
                $("#onlineStatusBadge").hide();
                $("#chatHeaderStatus").text("");
            }
        });
    }

    // سكيلتن سريع
    renderChatSkeleton();
    $("#messageInput, #sendBtn").prop("disabled", false);

    // ألغِ أي طلب سابق
    if (messagesAbort) messagesAbort.abort();
    messagesAbort = new AbortController();

    // ملاحظة: لو API يدعم take استخدمه ?take=60 لتخفيف البيانات
    fetch(`/Chat/LoadMessages/${id}?take=60`, { signal: messagesAbort.signal })
        .then(r => r.ok ? r.json() : Promise.reject())
        .then(data => {
            // تجهيز
            $("#chatBody").empty();
            // تطبيع الحقول
            data.forEach(m => {
                if (typeof m.isMine === "undefined" && typeof m.senderId !== "undefined") {
                    m.isMine = String(m.senderId) === String(currentUserId);
                }
                m.replyTo = m.replyTo ?? m.ReplyTo ?? null;
            });

            // رسم بدُفعات
            const batches = chunk(data, BATCH_SIZE);
            const bodyEl = document.getElementById("chatBody");

            function messageHtml(m) {
                // نسخة سريعة من قالبك مع lazy للصور والفيديو
                const name = m.fileName || "ملف مرفق";
                const safeName = escapeHtml(name);
                const type = (m.fileType || "").toLowerCase();
                const fileUrl = m.fileUrl;
                let filePreview = "";

                if (type.startsWith("image/")) {
                    filePreview = `
          <div class="position-relative mt-2">
            <img loading="lazy" src="${fileUrl}" alt="${safeName}"
                 class="chat-image"
                 style="max-width:200px;max-height:200px;border-radius:12px;object-fit:cover;cursor:pointer;" />
            <a href="${fileUrl}" download="${safeName}" class="btn btn-sm btn-light position-absolute bottom-0 end-0 m-2 shadow-sm">⬇️</a>
          </div>`;
                } else if (type.startsWith("video/")) {
                    filePreview = `
          <div class="position-relative mt-2">
            <video preload="metadata" class="chat-video" style="max-width:220px;max-height:200px;border-radius:12px;cursor:pointer;" controls>
              <source src="${fileUrl}" type="${type}">
              متصفحك لا يدعم تشغيل الفيديو.
            </video>
            <a href="${fileUrl}" download="${safeName}" class="btn btn-sm btn-light position-absolute bottom-0 end-0 m-2 shadow-sm">⬇️</a>
          </div>`;
                } else if (type.startsWith("audio/")) {
                    filePreview = `
          <div class="d-flex align-items-center mt-2 bg-light rounded p-2" style="max-width:240px;">
            <audio controls style="width:180px;">
              <source src="${fileUrl}" type="${type}">
            </audio>
            <a href="${fileUrl}" download="${safeName}" class="btn btn-sm btn-outline-secondary ms-2">⬇️</a>
          </div>`;
                } else if (fileUrl) {
                    filePreview = `
          <div class="position-relative mt-2">
            <div class="chat-file d-flex align-items-center p-3 rounded shadow-sm" data-file="${fileUrl}" data-type="${type}">
              <div class="me-2 fs-4">📄</div>
              <div class="file-info-container">
                <div class="file-name">${safeName}</div>
                <div class="file-details">
                  <span class="file-size">${formatFileSize(m.fileSize || 0)}</span>
                  <span class="file-type">${type.split('/')[1] || 'ملف'}</span>
                </div>
              </div>
            </div>
            <a href="${fileUrl}" download="${safeName}" class="btn btn-sm btn-outline-secondary mt-2">⬇️ تحميل الملف</a>
          </div>`;
                }

                return `
      <div class="msg ${m.isMine ? "me" : "other"}"
           data-id="${m.id}" id="msg-${m.id}"
           data-text="${m.text ? escapeHtml(m.text) : ''}"
           data-file-url="${m.fileUrl || ''}"
           data-file-name="${m.fileName || ''}"
           data-file-type="${(m.fileType || '').toLowerCase()}">
        <div class="msg-content position-relative">
          ${m.replyTo ? `
            <button type="button" class="reply-box bg-light rounded p-2 mb-1 border-start border-3 border-primary w-100 text-start"
                    data-target-id="${m.replyTo.id || m.replyTo.messageId || ''}" title="الانتقال للرسالة الأصلية">
              <div class="small text-muted">
                ${m.replyTo.text ? escapeHtml(m.replyTo.text) : escapeHtml(m.replyTo.fileName || "📎 مرفق")}
              </div>
            </button>` : ``}
          ${m.text ? `<div class="msg-text">${escapeHtml(m.text)}</div>` : ``}
                    ${m.text ? `<div class="msg-text">${escapeHtml(m.text)}</div>` : ``}

          ${m.text ? renderLinkPreviewsHtml(m.text) : ``}

          ${filePreview}
          <div class="small mt-1 text-end opacity-75">
            ${new Date(m.createdAtUtc).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
          <div class="msg-actions">
            ${m.isMine ? `
              <button class="btn btn-sm btn-light edit-msg">✏️</button>
              <button class="btn btn-sm btn-danger delete-msg">🗑️</button>` : ``}
            <button class="btn btn-sm btn-outline-primary reply-msg">↩️</button>
          </div>
        </div>
      </div>`;
            }

            function renderBatch(i = 0) {
                if (i >= batches.length) {
                    // Scroll للأسفل مرة واحدة فقط
                    $("#chatBody").scrollTop($("#chatBody")[0].scrollHeight);
                    return;
                }
                const frag = document.createDocumentFragment();
                batches[i].forEach(m => {
                    const wrapper = document.createElement("div");
                    wrapper.innerHTML = messageHtml(m);
                    frag.appendChild(wrapper.firstElementChild);
                });
                bodyEl.appendChild(frag);
                // الدفعة التالية في الإطار القادم (سلس جدًا)
                requestAnimationFrame(() => renderBatch(i + 1));
            }

            renderBatch(0);
        })
        .catch(() => {
            $("#chatBody").html('<div class="text-center text-muted mt-5">تعذّر تحميل الرسائل</div>');
        });


    function renderPeerSkeleton() {
        $("#piPhoto").attr("src", "/images/avatars/default-avatar.png");
        $("#piName").html('<div class="skel" style="width:140px;height:18px"></div>');
        $("#piOnlineDot").removeClass("bg-success").addClass("bg-secondary").text("...");
        $("#piLastSeen").html('<div class="skel" style="width:110px;height:12px;margin-top:6px"></div>');
        $("#piEmail").html('<div class="skel" style="width:160px;height:12px"></div>');
        $("#piPhone").html('<div class="skel" style="width:120px;height:12px"></div>');
        $("#piMediaGrid").empty().append(
            '<div class="col-4"><div class="skel" style="height:100px"></div></div>'.repeat(6)
        );
    }

    function buildMediaFragment(items) {
        const frag = document.createDocumentFragment();
        items.forEach(m => {
            const t = (m.type || "").toLowerCase();
            const k = (m.kind || (
                t.startsWith("image/") ? "image" :
                    t.startsWith("video/") ? "video" :
                        t.startsWith("audio/") ? "audio" : "file"
            ));

            let el;
            if (k === "image") {
                el = $(`
        <div class="col-4 mb-3">
          <img loading="lazy" src="${m.url}" class="w-100 rounded-3 border"
               style="object-fit:cover;height:100px;cursor:pointer" />
        </div>`);
                el.find("img").on("click", () => window.open(m.url, "_blank"));
            } else if (k === "video") {
                el = $(`
        <div class="col-4 mb-3">
          <div class="position-relative rounded-3 border bg-black"
               style="height:100px;cursor:pointer">
            <div class="position-absolute top-50 start-50 translate-middle text-white">🎥</div>
          </div>
        </div>`);
                el.find("div").on("click", () => window.open(m.url, "_blank"));
            } else if (k === "audio") {
                el = $(`
        <div class="col-4 mb-3">
          <div class="d-flex align-items-center justify-content-center rounded-3 border bg-white p-2" style="height:100px;">
            🎧 <a class="ms-2 small text-decoration-none" target="_blank" href="${m.url}">تشغيل</a>
          </div>
        </div>`);
            } else if (k === "link") {
                el = $(`
        <div class="col-12 mb-2">
          <a class="d-block p-2 border rounded-3 text-truncate text-decoration-none" target="_blank" href="${m.url}">
            🔗 ${m.url}
          </a>
        </div>`);
            } else {
                el = $(`
        <div class="col-4 mb-3">
          <a download class="d-block p-2 rounded-3 border text-center text-decoration-none small" href="${m.url}">📎 ملف</a>
        </div>`);
            }
            frag.appendChild(el[0]);
        });
        return frag;
    }

    function renderPeerDataToModal(data) {
        $("#piPhoto").attr("src", data.photoUrl || "/images/avatars/default-avatar.png");
        $("#piName").text(data.displayName || "(مستخدم)");
        if (data.isOnline) {
            $("#piOnlineDot").removeClass("bg-secondary").addClass("bg-success").text("متصل الآن");
            $("#piLastSeen").text("");
        } else {
            $("#piOnlineDot").removeClass("bg-success").addClass("bg-secondary").text("غير متصل");
            $("#piLastSeen").text(data.lastSeenText || "");
        }
        $("#piEmail").text(data.email || "—");
        $("#piPhone").text(data.phone || "—");

        // ارسم الوسائط بدفعة واحدة
        const grid = $("#piMediaGrid").empty()[0];
        const items = (data.recentMedia || []).map(x => ({
            url: x.url, type: (x.type || "").toLowerCase(), kind: (x.kind || "").toLowerCase()
        }));
        requestAnimationFrame(() => grid.appendChild(buildMediaFragment(items)));
    }


   

    // زر معلومات جهة الاتصال
    // فتح سريع + تحميل بالخلفية + كاش + إلغاء الطلب السابق
    $("#btnPeerInfo").off("click").on("click", function () {
        const convId = $(this).data("conversation-id");
        if (!convId) return;

        // افتح المودال فورًا مع سكيليتن
        const modalEl = document.getElementById("peerInfoModal");
        const modal = new bootstrap.Modal(modalEl);
        renderPeerSkeleton();
        modal.show();

        // إعادة ضبط الفلاتر والتحميل
        $("#piMediaFilters .btn").removeClass("active");
        $("#piMediaFilters [data-kind='all']").addClass("active");
        piMediaKind = 'all';
        resetPiMedia();
        loadPiMedia({ append: false });


        // لو عندنا كاش… اعرضه فورًا (Snap)
        const cached = peerCache.get(convId);
        if (cached) {
            renderPeerDataToModal(cached);
            return;
        }

        // ألغِ أي طلب سابق وابدأ جديد
        if (peerFetchAbort) peerFetchAbort.abort();
        peerFetchAbort = new AbortController();

        fetch(`/Chat/GetPeerProfile?conversationId=${convId}`, { signal: peerFetchAbort.signal })
            .then(r => r.ok ? r.json() : Promise.reject())
            .then(data => {
                peerCache.set(convId, data);
                renderPeerDataToModal(data);
            })
            .catch(() => {
                Swal.fire({ icon: "error", title: "تعذر جلب المعلومات", timer: 1400, showConfirmButton: false });
            });
    });

    let peerPrefetchTimer = null;
    $(document).off("mouseenter", "#btnPeerInfo").on("mouseenter", "#btnPeerInfo", function () {
        const convId = $(this).data("conversation-id");
        if (!convId || peerCache.has(convId)) return;

        clearTimeout(peerPrefetchTimer);
        peerPrefetchTimer = setTimeout(() => {
            fetch(`/Chat/GetPeerProfile?conversationId=${convId}`)
                .then(r => r.ok ? r.json() : Promise.reject())
                .then(data => { peerCache.set(convId, data); })
                .catch(() => { });
        }, 120); // تأخير بسيط لتجنّب طلبات وهمية
    });


    $(this).find(".badge-unread").remove();


  

    if (connection.state === signalR.HubConnectionState.Connected) {
        connection.invoke("JoinConversation", String(id));
    }

});

// إرسال الرسائل
$("#sendBtn").click(sendMessage);
$("#messageInput").keypress(function (e) {
    if (e.which === 13) {
        const text = $("#messageInput").val().trim();
        const file = $("#fileInput")[0].files[0];
        if (text || file) {
            sendMessage();
            e.preventDefault();
        }
    }
});

$("#messageInput").on("input", function () {
    const text = $(this).val().trim();
    const file = $("#fileInput")[0].files[0];
    $("#sendBtn").prop("disabled", !(text || file));
});

function sendMessage() {
    const text = $("#messageInput").val().trim();
    const file = $("#fileInput")[0].files[0];

    if (!text && !file) return;

    const formData = new FormData();
    formData.append("conversationId", currentConvId);
    formData.append("text", text || "");

    if (file) {
        console.log("📎 نوع الملف المرسل:", file.type);
        formData.append("file", file);
    }

    if (replyToMessageId)
        formData.append("replyToId", replyToMessageId);


    $.ajax({
        url: "/Chat/SendMessage",
        type: "POST",
        data: formData,
        processData: false,
        contentType: false,
        success: (msg) => {
            //appendMessage(msg);
            $("#messageInput").val("");
            $("#fileInput").val("");
            $("#filePreviewArea").addClass("d-none");
            $("#filePreviewBox").addClass("d-none");
            $("#filePreviewContent").empty();
            $("#btnEditImage").addClass("d-none");
            $("#sendBtn").prop("disabled", true);
            replyToMessageId = null;
            $("#replyPreview").addClass("d-none");
            $("#replyTextPreview").text("");
            $(".chat-input").removeClass("is-replying");

        },
        error: (xhr) => {
            console.error("❌ خطأ في الإرسال:", xhr.responseText);
            alert("حدث خطأ أثناء إرسال الرسالة: " + xhr.responseText);
        }
    });
}




// إدارة الملفات
$("#attachBtn").click(() => $("#fileInput").click());

$("#fileInput").on("change", function () {
    const file = this.files[0];
    const text = $("#messageInput").val().trim();

    if (file) {
        $("#sendBtn").prop("disabled", false);
        $("#messageInput").focus();
    } else if (!text) {
        $("#sendBtn").prop("disabled", true);
    }

    if (!file) return;

    const previewArea = $("#filePreviewArea");
    const previewBox = $("#filePreviewBox");
    const previewContent = $("#filePreviewContent");

    previewArea.addClass("d-none");
    previewBox.addClass("d-none");
    previewContent.empty();

    const type = file.type.toLowerCase();

    if (type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = e => {
            previewContent.html(`
                    <img id="previewImage" src="${e.target.result}"
                         class="img-fluid rounded shadow-sm"
                         style="max-height:300px; object-fit:contain;" />
                `);
            $("#btnEditImage").removeClass("d-none");
        };
        reader.readAsDataURL(file);
        previewArea.removeClass("d-none");
    }
    else if (type.startsWith("video/")) {
        const url = URL.createObjectURL(file);
        previewContent.html(`
                <video controls style="max-width:100%; border-radius:10px; max-height:300px;">
                    <source src="${url}" type="${type}">
                    متصفحك لا يدعم الفيديو.
                </video>
            `);
        $("#btnEditImage").addClass("d-none");
        previewArea.removeClass("d-none");
    }
    else if (type.startsWith("audio/")) {
        const url = URL.createObjectURL(file);
        previewContent.html(`
                <div class="d-flex flex-column align-items-center">
                    <audio controls style="width:100%; max-width:300px;">
                        <source src="${url}" type="${type}">
                        متصفحك لا يدعم الصوت.
                    </audio>
                    <div class="mt-2 text-muted small">${file.name}</div>
                </div>
            `);
        $("#btnEditImage").addClass("d-none");
        previewArea.removeClass("d-none");
    }
    else {
        const size = formatFileSize(file.size);
        previewContent.html(`
                <div class="d-flex align-items-center justify-content-center bg-white rounded p-2 shadow-sm">
                    <span class="me-2">📎</span>
                    <strong>${file.name}</strong>
                    <small class="text-muted ms-2">(${size})</small>
                </div>
            `);
        $("#btnEditImage").addClass("d-none");
        previewBox.removeClass("d-none");
    }
});

// ✅ معالج زر الإلغاء - تم الإصلاح
$("#btnCancelFile").on("click", function () {
    console.log("🚫 إلغاء الملف");
    $("#fileInput").val("");
    $("#filePreviewBox").addClass("d-none");
    $("#filePreviewContent").empty();
    const text = $("#messageInput").val().trim();
    if (!text) {
        $("#sendBtn").prop("disabled", true);
    }
});

// إلغاء معاينة الصورة/الفيديو داخل منطقة filePreviewArea
$("#filePreviewArea").on("click", "#btnRemovePreview", function () {
    $("#fileInput").val("");
    $("#filePreviewArea").addClass("d-none");
    $("#filePreviewContent").empty();
    const text = $("#messageInput").val().trim();
    if (!text) $("#sendBtn").prop("disabled", true);
});


// ✅ معالج زر المعاينة - إصلاح نهائي
$("#btnPreviewFile").on("click", function () {
    console.log("👁️ معاينة الملف قبل الإرسال");
    const file = $("#fileInput")[0].files[0];
    if (!file) {
        Swal.fire({
            title: "⚠️ تنبيه",
            text: "لا يوجد ملف للمعاينة!",
            icon: "warning",
            confirmButtonText: "حسناً",
            confirmButtonColor: "#2563eb"
        });
        return;
    }

    const type = (file.type || "").toLowerCase();
    const blobUrl = URL.createObjectURL(file);

    if (type.includes("pdf")) {
        // PDF - فتح في تبويب جديد
        console.log("📄 Opening PDF preview:", blobUrl);
        window.open(blobUrl, '_blank');
    }
    else if (type.includes("word") || type.includes("officedocument.word")) {
        // Word - رسالة تنبيه
        Swal.fire({
            title: "📄 ملف Word",
            html: "لا يمكن معاينة ملفات Word قبل الإرسال.<br>سيتم إرسال الملف كما هو عند الضغط على إرسال.",
            icon: "info",
            confirmButtonText: "حسناً",
            confirmButtonColor: "#2563eb"
        });
    }
    else if (type.includes("excel") || type.includes("spreadsheetml") || type.includes("sheet")) {
        // Excel - رسالة تنبيه
        Swal.fire({
            title: "📊 ملف Excel",
            html: "لا يمكن معاينة ملفات Excel قبل الإرسال.<br>سيتم إرسال الملف كما هو عند الضغط على إرسال.",
            icon: "info",
            confirmButtonText: "حسناً",
            confirmButtonColor: "#2563eb"
        });
    }
    else {
        Swal.fire({
            title: "📄 " + file.name,
            text: "هذا النوع من الملفات لا يمكن معاينته قبل الإرسال.",
            icon: "info",
            confirmButtonText: "حسناً",
            confirmButtonColor: "#2563eb"
        });
    }
});

// تعديل الصور
$("#btnEditImage").on("click", function () {
    const img = document.getElementById("previewImage");
    if (!img) return;

    const modalHtml = `
            <div class="modal fade show" id="editImageModal" tabindex="-1" style="display: block; background: rgba(0,0,0,0.9);">
                <div class="modal-dialog modal-xl modal-dialog-centered">
                    <div class="modal-content" style="background: #1f1f1f; border: none; border-radius: 16px; overflow: hidden;">
                        <div class="modal-header" style="border-bottom: 1px solid #333; padding: 1rem 1.5rem; background: #2a2a2a;">
                            <h5 class="modal-title text-white fw-bold">
                                <i class="bi bi-palette me-2"></i>تحرير الصورة
                            </h5>
                            <button type="button" class="btn-close btn-close-white" id="btnCloseEditor"></button>
                        </div>
                        
                        <!-- شريط الأدوات -->
                        <div class="p-3" style="background: #2a2a2a; border-bottom: 1px solid #444;">
                            <div class="d-flex flex-wrap gap-2 align-items-center justify-content-center">
                                <!-- أدوات الرسم -->
                                <button class="btn btn-sm btn-outline-light" id="btnDraw" title="رسم حر">
                                    <i class="bi bi-pencil"></i> رسم
                                </button>
                                <button class="btn btn-sm btn-outline-light" id="btnText" title="إضافة نص">
                                    <i class="bi bi-fonts"></i> نص
                                </button>
                                <button class="btn btn-sm btn-outline-light" id="btnCrop" title="اقتصاص الصورة">
                                    <i class="bi bi-crop"></i> اقتصاص
                                </button>
                                <button class="btn btn-sm btn-outline-light" id="btnRect" title="مستطيل">
                                    <i class="bi bi-square"></i> مربع
                                </button>
                                <button class="btn btn-sm btn-outline-light" id="btnCircle" title="دائرة">
                                    <i class="bi bi-circle"></i> دائرة
                                </button>
                                <button class="btn btn-sm btn-outline-light" id="btnArrow" title="سهم">
                                    <i class="bi bi-arrow-up-right"></i> سهم
                                </button>
                                
                                <div class="vr" style="height: 30px; background: #555;"></div>
                                
                                <!-- اختيار اللون -->
                                <div class="d-flex align-items-center gap-2">
                                    <label class="text-white small mb-0">اللون:</label>
                                    <input type="color" id="colorPicker" value="#ff0000" class="form-control form-control-sm" style="width: 50px; height: 35px; cursor: pointer;">
                                </div>
                                
                                <!-- حجم الخط/القلم -->
                                <div class="d-flex align-items-center gap-2">
                                    <label class="text-white small mb-0">الحجم:</label>
                                    <input type="range" id="brushSize" min="1" max="20" value="3" class="form-range" style="width: 100px;">
                                    <span class="text-white small" id="sizeValue">3</span>
                                </div>
                                
                                <div class="vr" style="height: 30px; background: #555;"></div>
                                
                                <!-- أدوات التحكم -->
                                <button class="btn btn-sm btn-outline-danger" id="btnDelete" title="حذف العنصر المحدد">
                                    <i class="bi bi-trash"></i> حذف
                                </button>
                                <button class="btn btn-sm btn-outline-warning" id="btnUndo" title="تراجع">
                                    <i class="bi bi-arrow-counterclockwise"></i> تراجع
                                </button>
                                <button class="btn btn-sm btn-outline-info" id="btnClear" title="مسح الكل">
                                    <i class="bi bi-eraser"></i> مسح الكل
                                </button>
                            </div>
                        </div>
                        
                        <div class="modal-body p-0" style="background: #1a1a1a; display: flex; align-items: center; justify-content: center; min-height: 500px;">
                            <canvas id="fabricCanvas"></canvas>
                        </div>
                        
                        <div class="modal-footer" style="border-top: 1px solid #333; padding: 1rem 1.5rem; background: #2a2a2a;">
                            <button type="button" class="btn btn-secondary" id="btnCancelEdit">
                                <i class="bi bi-x-circle me-1"></i>إلغاء
                            </button>
                            <button type="button" id="btnSaveEdit" class="btn btn-success px-4">
                                <i class="bi bi-check2-circle me-1"></i>حفظ التعديلات
                            </button>
                        </div>
                    </div>
                </div>
            </div>`;

    $("body").append(modalHtml);

    // إنشاء Canvas
    fabricCanvas = new fabric.Canvas('fabricCanvas', {
        backgroundColor: '#1a1a1a',
        isDrawingMode: false
    });

    // تحميل الصورة
    fabric.Image.fromURL(img.src, function (oImg) {
        const canvasWidth = 800;
        const scale = canvasWidth / oImg.width;
        const canvasHeight = oImg.height * scale;

        fabricCanvas.setWidth(canvasWidth);
        fabricCanvas.setHeight(canvasHeight);

        oImg.set({
            scaleX: scale,
            scaleY: scale,
            selectable: false,
            evented: false
        });

        fabricCanvas.setBackgroundImage(oImg, fabricCanvas.renderAll.bind(fabricCanvas));
    });

    // تفعيل الرسم الحر
    $("#btnDraw").on("click", function () {
        fabricCanvas.isDrawingMode = true;
        fabricCanvas.freeDrawingBrush.color = currentDrawingColor;
        fabricCanvas.freeDrawingBrush.width = currentDrawingWidth;
        $(this).addClass("active");
        $("#btnText, #btnCrop, #btnRect, #btnCircle, #btnArrow").removeClass("active");
    });

    // إضافة نص
    $("#btnText").on("click", function () {
        fabricCanvas.isDrawingMode = false;
        const text = new fabric.IText('اكتب هنا...', {
            left: 100,
            top: 100,
            fontSize: parseInt($("#brushSize").val()) * 8,
            fill: currentDrawingColor,
            fontFamily: 'Arial'
        });
        fabricCanvas.add(text);
        fabricCanvas.setActiveObject(text);
        $(this).addClass("active");
        $("#btnDraw, #btnCrop").removeClass("active");
    });

    // اقتصاد الصورة - بالطريقة القديمة الشغالة
    $("#btnCrop").on("click", function () {
        fabricCanvas.isDrawingMode = false;

        // حذف أي زر "تطبيق اقتصاص" قديم
        $("#btnApplyCrop").remove();

        // حذف أي مستطيل اقتصاص قديم
        fabricCanvas.getObjects().forEach(obj => {
            if (obj.cropRect === true) {
                fabricCanvas.remove(obj);
            }
        });

        // إنشاء مستطيل الاقتصاص
        const cropRect = new fabric.Rect({
            left: 50,
            top: 50,
            width: fabricCanvas.width - 100,
            height: fabricCanvas.height - 100,
            fill: 'rgba(0, 255, 0, 0.1)',
            stroke: '#00ff00',
            strokeWidth: 3,
            strokeDashArray: [10, 5],
            cornerColor: '#00ff00',
            cornerSize: 15,
            transparentCorners: false,
            lockRotation: true,
            hasRotatingPoint: false,
            borderColor: '#00ff00',
            cornerStrokeColor: '#00ff00',
            borderScaleFactor: 2,
            cropRect: true
        });

        fabricCanvas.add(cropRect);
        fabricCanvas.setActiveObject(cropRect);
        fabricCanvas.bringToFront(cropRect);
        fabricCanvas.renderAll();

        $(this).addClass("active btn-success");
        $("#btnDraw, #btnText, #btnRect, #btnCircle, #btnArrow").removeClass("active");

        // إضافة زر تطبيق الاقتصاص مرة واحدة فقط
        if ($("#btnApplyCrop").length === 0) {
            $(".modal-footer #btnCancelEdit").after(`
                    <button type="button" id="btnApplyCrop" class="btn btn-success me-2">
                        <i class="bi bi-scissors me-1"></i>تطبيق الاقتصاص
                    </button>
                `);
        }

        // عند تطبيق الاقتصاص
        $("#btnApplyCrop").off("click").on("click", function () {
            console.log("🔥 تطبيق الاقتصاص...");

            // الحصول على حدود المستطيل الدقيقة
            const bound = cropRect.getBoundingRect();
            console.log("📏 Bounds:", bound);

            // إنشاء canvas مؤقت
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = bound.width;
            tempCanvas.height = bound.height;
            const ctx = tempCanvas.getContext('2d');

            // الحصول على الصورة الأصلية من الخلفية
            const bgImage = fabricCanvas.backgroundImage;
            if (!bgImage) {
                alert("⚠️ خطأ: لا توجد صورة للاقتصاص!");
                return;
            }

            // حساب الإحداثيات بالنسبة للصورة الأصلية
            const scaleX = bgImage.scaleX || 1;
            const scaleY = bgImage.scaleY || 1;

            const sourceX = bound.left / scaleX;
            const sourceY = bound.top / scaleY;
            const sourceWidth = bound.width / scaleX;
            const sourceHeight = bound.height / scaleY;

            // رسم الجزء المقصوص
            const imgElement = bgImage._element;
            ctx.drawImage(
                imgElement,
                sourceX, sourceY, sourceWidth, sourceHeight,
                0, 0, bound.width, bound.height
            );

            // تحويل لـ DataURL
            const croppedDataURL = tempCanvas.toDataURL('image/png', 1.0);
            console.log("✅ تم إنشاء الصورة المقصوصة");

            // حذف المستطيل
            fabricCanvas.remove(cropRect);

            // إعادة تحميل الصورة المقصوصة
            fabric.Image.fromURL(croppedDataURL, function (newImg) {
                console.log("🖼️ تحميل الصورة المقصوصة...");

                // مسح كل شي
                fabricCanvas.clear();
                fabricCanvas.backgroundColor = '#1f1f1f';

                // تحديث حجم Canvas
                fabricCanvas.setWidth(bound.width);
                fabricCanvas.setHeight(bound.height);

                // إضافة الصورة الجديدة كخلفية
                newImg.set({
                    left: 0,
                    top: 0,
                    selectable: false,
                    evented: false
                });

                fabricCanvas.setBackgroundImage(newImg, fabricCanvas.renderAll.bind(fabricCanvas));
                fabricCanvas.renderAll();

                console.log("✅ تم تطبيق الاقتصاص بنجاح!");
            });

            // إخفاء الزر وتنظيف
            $("#btnCrop").removeClass("active btn-success");
            $("#btnApplyCrop").remove();
        });
    });

    // رسم مستطيل
    $("#btnRect").on("click", function () {
        fabricCanvas.isDrawingMode = false;
        const rect = new fabric.Rect({
            left: 100,
            top: 100,
            fill: 'transparent',
            stroke: currentDrawingColor,
            strokeWidth: currentDrawingWidth,
            width: 150,
            height: 100
        });
        fabricCanvas.add(rect);
        $(this).addClass("active");
        $("#btnDraw, #btnCrop, #btnCircle").removeClass("active");
    });

    // رسم دائرة
    $("#btnCircle").on("click", function () {
        fabricCanvas.isDrawingMode = false;
        const circle = new fabric.Circle({
            left: 100,
            top: 100,
            fill: 'transparent',
            stroke: currentDrawingColor,
            strokeWidth: currentDrawingWidth,
            radius: 50
        });
        fabricCanvas.add(circle);
        $(this).addClass("active");
        $("#btnDraw, #btnCrop").removeClass("active");
    });

    // رسم سهم
    $("#btnArrow").on("click", function () {
        fabricCanvas.isDrawingMode = false;
        const arrow = new fabric.Path('M 0 0 L 100 0 L 90 -10 M 100 0 L 90 10', {
            left: 100,
            top: 100,
            stroke: currentDrawingColor,
            strokeWidth: currentDrawingWidth,
            fill: 'transparent'
        });
        fabricCanvas.add(arrow);
        $(this).addClass("active");
        $("#btnDraw, #btnCrop, #btnRect, #btnCircle").removeClass("active");
    });

    // تغيير اللون
    $("#colorPicker").on("change", function () {
        currentDrawingColor = $(this).val();
        if (fabricCanvas.isDrawingMode) {
            fabricCanvas.freeDrawingBrush.color = currentDrawingColor;
        }
        const activeObj = fabricCanvas.getActiveObject();
        if (activeObj) {
            if (activeObj.type === 'i-text') {
                activeObj.set('fill', currentDrawingColor);
            } else {
                activeObj.set('stroke', currentDrawingColor);
            }
            fabricCanvas.renderAll();
        }
    });

    // تغيير الحجم
    $("#brushSize").on("input", function () {
        currentDrawingWidth = parseInt($(this).val());
        $("#sizeValue").text(currentDrawingWidth);
        if (fabricCanvas.isDrawingMode) {
            fabricCanvas.freeDrawingBrush.width = currentDrawingWidth;
        }
        const activeObj = fabricCanvas.getActiveObject();
        if (activeObj && activeObj.type !== 'i-text') {
            activeObj.set('strokeWidth', currentDrawingWidth);
            fabricCanvas.renderAll();
        }
    });

    // حذف العنصر المحدد
    $("#btnDelete").on("click", function () {
        const activeObj = fabricCanvas.getActiveObject();
        if (activeObj) {
            fabricCanvas.remove(activeObj);
        }
    });

    // تراجع
    $("#btnUndo").on("click", function () {
        const objects = fabricCanvas.getObjects();
        if (objects.length > 0) {
            fabricCanvas.remove(objects[objects.length - 1]);
        }
    });

    // مسح الكل
    $("#btnClear").on("click", function () {
        fabricCanvas.getObjects().forEach(obj => {
            fabricCanvas.remove(obj);
        });
    });

    // حفظ التعديلات
    $("#btnSaveEdit").on("click", function () {
        const dataURL = fabricCanvas.toDataURL({
            format: 'png',
            quality: 1
        });

        $("#previewImage").attr("src", dataURL);

        // تحويل لـ Blob وتحديث FileInput
        fetch(dataURL)
            .then(res => res.blob())
            .then(blob => {
                const file = new File([blob], "edited-image.png", { type: "image/png" });
                const dataTransfer = new DataTransfer();
                dataTransfer.items.add(file);
                $("#fileInput")[0].files = dataTransfer.files;

                $("#editImageModal").remove();
                fabricCanvas.dispose();
                fabricCanvas = null;
            });
    });

    // إلغاء
    $("#btnCloseEditor, #btnCancelEdit").on("click", function () {
        $("#editImageModal").remove();
        if (fabricCanvas) {
            fabricCanvas.dispose();
            fabricCanvas = null;
        }
    });
});

// عرض الرسائل
function appendMessage(m) {
    let filePreview = "";
    const name = m.fileName || "ملف مرفق";
    const safeName = escapeHtml(name);
    const type = (m.fileType || "").toLowerCase();
    const fileUrl = m.fileUrl;
    const fileSize = m.fileSize || 0;

    if (type.startsWith("image/")) {
        filePreview = `
                <div class="position-relative mt-2">
                    <img src="${fileUrl}" alt="${safeName}"
                         class="chat-image"
                         style="max-width:200px; max-height:200px; border-radius:12px; object-fit:cover; cursor:pointer;" />
                   <a href="${fileUrl}" download="${safeName}" class="btn btn-sm btn-light position-absolute bottom-0 end-0 m-2 shadow-sm">
                        ⬇️
                    </a>
                </div>`;
    }
    else if (type.startsWith("video/")) {
        filePreview = `
                <div class="position-relative mt-2">
                    <video class="chat-video" style="max-width:220px; max-height:200px; border-radius:12px; cursor:pointer;" controls>
                        <source src="${fileUrl}" type="${type}">
                        متصفحك لا يدعم تشغيل الفيديو.
                    </video>
                    <a href="${fileUrl}" download="${safeName}" class="btn btn-sm btn-light position-absolute bottom-0 end-0 m-2 shadow-sm">
                        ⬇️
                    </a>
                </div>`;
    }
    else if (type.startsWith("audio/")) {
        filePreview = `
                <div class="d-flex align-items-center mt-2 bg-light rounded p-2" style="max-width:240px;">
                    <audio controls style="width:180px;">
                        <source src="${fileUrl}" type="${type}">
                    </audio>
                    <a href="${fileUrl}" download="${name}" class="btn btn-sm btn-outline-secondary ms-2">⬇️</a>
                </div>`;
    }
    else if (fileUrl) {
        filePreview = `
            <div class="position-relative mt-2">
                <div class="chat-file d-flex align-items-center p-3 rounded shadow-sm"
                     data-file="${fileUrl}" data-type="${type}">
                    <div class="me-2 fs-4">📄</div>
                    <div class="file-info-container">
                        <div class="file-name">${safeName}</div>
                        <div class="file-details">
                            <span class="file-size">${formatFileSize(fileSize)}</span>
                            <span class="file-type">${type.split('/')[1] || 'ملف'}</span>
                        </div>
                    </div>
                </div>
                <a href="${fileUrl}" download="${safeName}" class="btn btn-sm btn-outline-secondary mt-2">⬇️ تحميل الملف</a>
            </div>`;
    }

    const html = `
  <div class="msg ${m.isMine ? "me" : "other"}"
       data-id="${m.id}" id="msg-${m.id}"
       data-text="${m.text ? escapeHtml(m.text) : ''}"
       data-file-url="${m.fileUrl || ''}"
       data-file-name="${m.fileName || ''}"
       data-file-type="${(m.fileType || '').toLowerCase()}">
    <div class="msg-content position-relative">
      ${m.replyTo ? `
        <button type="button" class="reply-box bg-light rounded p-2 mb-1 border-start border-3 border-primary w-100 text-start"
                data-target-id="${m.replyTo.id || m.replyTo.messageId || ''}"
                title="الانتقال للرسالة الأصلية">
          <div class="small text-muted">
            ${m.replyTo.text ? escapeHtml(m.replyTo.text) : escapeHtml(m.replyTo.fileName || "📎 مرفق")}
          </div>
        </button>` : ``}
      ${m.text ? `<div class="msg-text">${escapeHtml(m.text)}</div>` : ``}
            ${m.text ? renderLinkPreviewsHtml(m.text) : ``}

      ${filePreview}
      <div class="small mt-1 text-end opacity-75">
        ${new Date(m.createdAtUtc).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </div>
      <div class="msg-actions">
        ${m.isMine ? `
          <button class="btn btn-sm btn-light edit-msg">✏️</button>
          <button class="btn btn-sm btn-danger delete-msg">🗑️</button>
        ` : ``}
        <button class="btn btn-sm btn-outline-primary reply-msg">↩️</button>
      </div>
    </div>
  </div>`;


    $("#chatBody").append(html);
}


// 🆕 HTML أولي سريع لبطاقة معاينة برقمية فقط (قبل الميتاداتا)
function buildLinkCardSkeleton(url) {
    const n = normalizeUrl(url);
    const { level, reasons, domain } = quickSafetyCheck(n);
    const badge = level === "safe" ? "safe" : (level === "dang" ? "dang" : "warn");
    const badgeText = level === "safe" ? "آمن غالباً" : (level === "dang" ? "خطر" : "تنبيه");
    const tips = reasons.length ? `<div class="mt-1 small text-muted">• ${reasons.join(" • ")}</div>` : "";

    const fav = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32`;

    return `
    <div class="link-card" data-url="${escapeHtml(n)}">
      <div class="lc-header">
        <img class="lc-favicon" src="${fav}" alt="">
        <div class="lc-domain">${escapeHtml(domain || n)}</div>
      </div>
      <div class="lc-title">${escapeHtml(n)}</div>
      <div class="lc-desc">جارٍ فحص الرابط وجلب المعاينة…</div>
      <div class="lc-actions">
        <span class="lc-badge ${badge}">${badgeText}</span>
        <a class="lc-open" href="${escapeHtml(n)}" target="_blank" rel="noopener">فتح الرابط ↗</a>
      </div>
      ${tips}
    </div>
  `;
}

// 🆕 إدراج بطاقات المعاينة لعدة روابط في نص واحد
function renderLinkPreviewsHtml(text) {
    const urls = extractUrls(text);
    if (!urls.length) return "";
    // بطاقات سكيليتن أولاً
    const cards = urls.map(u => buildLinkCardSkeleton(u)).join("");
    // بعد إدراج HTML فعلياً، سنقوم بترقية البطاقات بميتا داتا عبر fetch (Deferred)
    setTimeout(() => enhanceLinkCards(urls), 0);
    return cards;
}

// 🆕 ترقية البطاقات بميتا داتا من السيرفر
async function enhanceLinkCards(urls) {
    for (const raw of urls) {
        const u = normalizeUrl(raw);
        const card = document.querySelector(`.link-card[data-url="${CSS.escape(u)}"]`);
        if (!card) continue;

        try {
            const res = await fetch(`/Chat/LinkPreview?url=${encodeURIComponent(u)}`);
            if (!res.ok) throw new Error("preview failed");
            const meta = await res.json();
            applyMetaToCard(card, u, meta);
        } catch {
            // اترك السكيليتن مع تنبيه بسيط
            const desc = card.querySelector(".lc-desc");
            if (desc) desc.textContent = "تعذّر جلب بيانات المعاينة. استخدم رابط الفتح بحذر.";
            const badge = card.querySelector(".lc-badge");
            if (badge && !badge.classList.contains("dang")) {
                badge.classList.remove("safe");
                badge.classList.add("warn");
                badge.textContent = "تنبيه";
            }
        }
    }
}

// 🆕 إسقاط الميتاداتا على البطاقة
function applyMetaToCard(card, url, meta) {
    const title = meta.title || url;
    const desc = meta.description || "";
    const domain = meta.domain || getDomain(url);
    const favicon = meta.favicon || `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32`;
    const safe = typeof meta.safe === "boolean" ? meta.safe : true;
    const risk = meta.risk || "safe"; // safe|warn|dang
    const reasons = meta.reasons || [];

    const hFavi = card.querySelector(".lc-favicon");
    const hDom = card.querySelector(".lc-domain");
    const hTit = card.querySelector(".lc-title");
    const hDesc = card.querySelector(".lc-desc");
    const hOpen = card.querySelector(".lc-open");
    const hBadg = card.querySelector(".lc-badge");

    if (hFavi) hFavi.src = favicon;
    if (hDom) hDom.textContent = domain || url;
    if (hTit) hTit.textContent = title;
    if (hDesc) hDesc.textContent = desc || (safe ? "رابط موثوق على الأرجح." : "قد يكون الرابط غير آمن.");

    if (hOpen) {
        hOpen.href = url;
        hOpen.rel = "noopener noreferrer";
    }

    // شارة الأمان
    hBadg.classList.remove("safe", "warn", "dang");
    if (risk === "dang") { hBadg.classList.add("dang"); hBadg.textContent = "خطر"; }
    else if (risk === "warn") { hBadg.classList.add("warn"); hBadg.textContent = "تنبيه"; }
    else { hBadg.classList.add("safe"); hBadg.textContent = "آمن غالباً"; }

    // أسباب إضافية
    if (reasons.length) {
        const tips = document.createElement("div");
        tips.className = "mt-1 small text-muted";
        tips.textContent = "• " + reasons.join(" • ");
        card.appendChild(tips);
    }
}


// تعديل وحذف الرسائل
let editingMessageId = null;
let removeExistingAttachment = false;

$(document).on("click", ".edit-msg", function () {
    const $msg = $(this).closest(".msg");
    editingMessageId = $msg.data("id");
    removeExistingAttachment = false;

    // حمّل القيم الحالية
    const currentText = String($msg.data("text") || "");
    const fileUrl = String($msg.data("file-url") || "");
    const fileName = String($msg.data("file-name") || "");
    const fileType = String($msg.data("file-type") || "");

    // عبيء الحقول
    $("#editMsgText").val(currentText);
    renderEditPreview({ fileUrl, fileName, fileType });

    $("#btnRemoveExistingFile")
        .prop("disabled", !fileUrl)
        .off("click").on("click", () => {
            removeExistingAttachment = true;
            renderEditPreview({ fileUrl: "", fileName: "", fileType: "" });
        });

    $("#editMsgFile").val("");
    $("#editMsgFile").off("change").on("change", function () {
        const f = this.files[0];
        if (!f) { renderEditPreview({ fileUrl, fileName, fileType }); return; }
        const url = URL.createObjectURL(f);
        renderEditPreview({ fileUrl: url, fileName: f.name, fileType: f.type, isTemp: true });
    });

    // افتح المودال
    const modal = new bootstrap.Modal(document.getElementById("editMsgModal"));
    modal.show();

    // حفظ
    $("#saveEditMsgBtn").off("click").on("click", async () => {
        const newText = $("#editMsgText").val().trim();
        const newFile = $("#editMsgFile")[0].files[0] || null;

        if (!newText && !newFile && !removeExistingAttachment) {
            return showEditError("أدخل نصًا أو اختر مرفقًا أو أزل المرفق الحالي.");
        }

        const fd = new FormData();
        fd.append("messageId", editingMessageId);
        fd.append("newText", newText || "");
        fd.append("removeAttachment", removeExistingAttachment ? "true" : "false");
        if (newFile) fd.append("file", newFile);

        try {
            await $.ajax({
                url: "/Chat/EditMessage",
                type: "POST",
                data: fd, processData: false, contentType: false
            });

            modal.hide();

            // ✅ تحديث سريع في الـDOM
            const $target = $(`.msg[data-id='${editingMessageId}']`);
            $target.attr("data-text", newText || "");
            const textEl = $target.find(".msg-text");
            if (newText) {
                if (textEl.length) textEl.text(newText); else $target.find(".msg-content").prepend(`<div class="msg-text">${escapeHtml(newText)}</div>`);
            } else {
                textEl.remove();
            }

            // مبدئيًا نترك المرفق للتحديث عبر SignalR أو Reload لاحقًا
            // (اختياري: أرسل تفاصيل المرفق من السيرفر وحدثها هنا)

            Swal.fire({ icon: "success", title: "تم الحفظ", timer: 1100, showConfirmButton: false });
        } catch (e) {
            showEditError("فشل الحفظ، حاول مرة أخرى.");
        }
    });
});

function renderEditPreview({ fileUrl, fileName, fileType, isTemp = false }) {
    const box = $("#editFilePreview");
    if (!fileUrl) { box.html("لا يوجد مرفق."); return; }
    const safeName = fileName || "ملف";
    const type = (fileType || "").toLowerCase();

    if (type.startsWith("image/")) box.html(`<img src="${fileUrl}" alt="${safeName}" style="max-height:280px;max-width:100%;border-radius:12px">`);
    else if (type.startsWith("video/")) box.html(`<video controls style="max-width:100%;max-height:300px;border-radius:12px"><source src="${fileUrl}" type="${type}"></video>`);
    else if (type.startsWith("audio/")) box.html(`<audio controls style="width:100%"><source src="${fileUrl}" type="${type}"></audio>`);
    else box.html(`<div class="d-flex align-items-center gap-2"><span>📄</span><strong>${safeName}</strong></div>`);

    if (isTemp) box.append(`<div class="mt-2 small text-muted">(معاينة محلية)</div>`);
}
function showEditError(msg) { $("#editMsgError").removeClass("d-none").text(msg); }


// عند الضغط على فلتر
$(document).on("click", "#piMediaFilters [data-kind]", function () {
    $("#piMediaFilters .btn").removeClass("active");
    $(this).addClass("active");
    piMediaKind = $(this).data("kind") || "all";
    resetPiMedia();
    loadPiMedia({ append: false });
});

// زر "عرض المزيد"
$(document).on("click", "#piMediaMore", function () {
    // إن كان ما يزال هناك عناصر غير معروضة
    const shown = $("#piMediaGrid").children().length;
    if (shown < piMediaTotal) {
        piMediaPage += 1;
        loadPiMedia({ append: true });
    } else {
        $(this).addClass("d-none");
    }
});


$(document).on("click", ".reply-msg", function () {
    const msgDiv = $(this).closest(".msg");
    replyToMessageId = msgDiv.data("id");

    // لو فيها نص بنأخذ النص، غير هيك بنعرض "📎 مرفق"
    let msgText = (msgDiv.find(".msg-text").text().trim()) || "📎 مرفق";

    // قصّ المقتطف لو كان طويل
    if (msgText.length > 120) msgText = msgText.slice(0, 120) + "…";

    $("#replyTextPreview").text(msgText).data("targetId", replyToMessageId);
    $("#replyPreview").removeClass("d-none");
    $(".chat-input").addClass("is-replying");
});

$("#cancelReply").click(() => {
    replyToMessageId = null;
    $("#replyPreview").addClass("d-none");
    $("#replyTextPreview").text("");
    $(".chat-input").removeClass("is-replying");

});

// القفز من شريحة الرد (التي تظهر فوق الإدخال)
$("#replyPreview").on("click", function (e) {
    // تجاهل النقر على زر الإلغاء
    if ($(e.target).closest("#cancelReply").length) return;

    const targetId = String($("#replyTextPreview").data("targetId") || "");
    if (!targetId) return;

    const $target = $(`.msg[data-id='${targetId}']`);
    if ($target.length) {
        const container = document.getElementById('chatBody');
        if (container) {
            const top = $target[0].offsetTop - (container.clientHeight / 2);
            container.scrollTo({ top: Math.max(top, 0), behavior: 'smooth' });
        } else {
            $target[0].scrollIntoView({ behavior: "smooth", block: "center" });
        }

        $target.addClass("jump-highlight");
        setTimeout(() => $target.removeClass("jump-highlight"), 1800);
    }
});


$(document).on("click", ".delete-msg", function () {
    const msgDiv = $(this).closest(".msg");
    const msgId = msgDiv.data("id");

    Swal.fire({
        title: "🗑️ هل أنت متأكد؟",
        text: "سيتم حذف هذه الرسالة نهائيًا.",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#d33",
        cancelButtonColor: "#6c757d",
        confirmButtonText: "نعم، احذفها",
        cancelButtonText: "إلغاء",
        reverseButtons: true,
        customClass: {
            popup: "rounded-4 shadow-lg p-4",
            title: "fw-bold fs-5",
            confirmButton: "btn btn-danger px-4 fw-bold",
            cancelButton: "btn btn-secondary px-4 fw-bold"
        }
    }).then((result) => {
        if (result.isConfirmed) {
            $.post("/Chat/DeleteMessage", { messageId: msgId, deleteForAll: true }, () => {
                Swal.fire({
                    title: "✅ تم الحذف",
                    text: "تم حذف الرسالة بنجاح.",
                    icon: "success",
                    timer: 1300,
                    showConfirmButton: false
                });
                msgDiv.html('<div class="text-muted fst-italic">🚫 تم حذف هذه الرسالة</div>');
            });
        }
    });
});


// القفز إلى الرسالة الأصلية عند الضغط على الصندوق المُقتبس
$(document).on("click", ".reply-box[data-target-id]", function () {
    const targetId = String($(this).data("targetId") || "");
    if (!targetId) return;

    const $target = $(`.msg[data-id='${targetId}']`);

    if ($target.length) {
        // تمرير سلس لموضع الرسالة داخل #chatBody
        $target[0].scrollIntoView({ behavior: "smooth", block: "center" });
        // إبراز مؤقت
        $target.addClass("jump-highlight");
        setTimeout(() => $target.removeClass("jump-highlight"), 1800);
    } else {
        // الرسالة أقدم ولم تُحمّل بعد
        Swal.fire({
            icon: "info",
            title: "الرسالة غير معروضة",
            text: "الرسالة الأصلية أقدم من المعروض حالياً. اسحب للأعلى لتحميل رسائل أقدم.",
            confirmButtonText: "حسناً",
            confirmButtonColor: "#2563eb"
        });
        // (اختياري) لو عندك API لجلب رسالة محددة ثم إدراجها، نفّذه هنا.
    }
});


// معاينة الوسائط
$(document).on("click", ".chat-image", function () {
    const src = $(this).attr("src");
    const fileName = $(this).attr("alt") || "image";
    $("#previewImage").attr("src", src);
    $("#downloadImageBtn").attr("href", src);
    $("#downloadImageBtn").attr("download", fileName);
    $("#imagePreviewModal").modal("show");
});

$(document).on("click", ".chat-video", function () {
    const src = $(this).find("source").attr("src");
    $("#previewVideo").attr("src", src);
    $("#downloadVideoBtn").attr("href", src);
    $("#downloadVideoBtn").attr("download", "video.mp4");
    $("#videoPreviewModal").modal("show");
});

// 📄 معالج النقر على الملفات (PDF, Word, Excel)
$(document).on("click", ".chat-file", function () {
    const fileUrl = $(this).data("file");
    const type = ($(this).data("type") || "").toLowerCase();
    const fileName = $(this).find(".file-name").text() || "ملف";

    console.log("🔍 File Click:", { fileUrl, type, fileName });

    const iframe = $("#previewFileFrame");
    const downloadBtn = $("#downloadFileBtn");

    downloadBtn.attr("href", fileUrl);
    downloadBtn.attr("download", fileName);

    // التعامل مع الأنواع المختلفة
    if (type.includes("pdf")) {
        // PDF - فتح في تبويب جديد مباشرة
        console.log("📄 Opening PDF in new tab:", fileUrl);
        window.open(fileUrl, '_blank');
    }
    else if (type.includes("word") || type.includes("officedocument.word") ||
        type.includes("msword")) {
        // Word - استخدام Google Docs Viewer (أكثر استقراراً)
        console.log("📝 Opening Word:", fileUrl);
        const fullUrl = /^https?:\/\//i.test(fileUrl) ? fileUrl : (window.location.origin + fileUrl);
        const viewerUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(fullUrl)}&embedded=true`;

        iframe.parent().html(`
                <div class="d-flex flex-column align-items-center justify-content-center" style="height: 65vh; background: #f8f9fa;">
                    <div class="spinner-border text-primary mb-3" role="status" style="width: 3rem; height: 3rem;">
                        <span class="visually-hidden">جارٍ التحميل...</span>
                    </div>
                    <p class="text-muted">جارٍ تحميل المستند...</p>
                    <small class="text-muted mt-2">قد يستغرق الأمر بضع ثوان</small>
                </div>
                <iframe id="previewFileFrame" src="${viewerUrl}" 
                        width="100%" 
                        height="100%" 
                        style="border:none; background:#f5f5f5; display:none;"></iframe>
            `);

        // إظهار iframe بعد فترة
        setTimeout(function () {
            $("#previewFileFrame").show();
            $("#previewFileFrame").siblings("div").hide();
        }, 3000);

        $("#filePreviewModal").modal("show");
    }
    else if (type.includes("excel") || type.includes("spreadsheetml") ||
        type.includes("sheet")) {
        // Excel - استخدام Google Docs Viewer
        console.log("📊 Opening Excel:", fileUrl);
        const fullUrl = /^https?:\/\//i.test(fileUrl) ? fileUrl : (window.location.origin + fileUrl);
        const viewerUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(fullUrl)}&embedded=true`;

        iframe.parent().html(`
                <div class="d-flex flex-column align-items-center justify-content-center" style="height: 65vh; background: #f8f9fa;">
                    <div class="spinner-border text-primary mb-3" role="status" style="width: 3rem; height: 3rem;">
                        <span class="visually-hidden">جارٍ التحميل...</span>
                    </div>
                    <p class="text-muted">جارٍ تحميل الملف...</p>
                    <small class="text-muted mt-2">قد يستغرق الأمر بضع ثوان</small>
                </div>
                <iframe id="previewFileFrame" src="${viewerUrl}" 
                        width="100%" 
                        height="100%" 
                        style="border:none; background:#f5f5f5; display:none;"></iframe>
            `);

        // إظهار iframe بعد فترة
        setTimeout(function () {
            $("#previewFileFrame").show();
            $("#previewFileFrame").siblings("div").hide();
        }, 3000);

        $("#filePreviewModal").modal("show");
    }
    else {
        // أنواع أخرى - عرض رسالة
        Swal.fire({
            title: "📄 " + fileName,
            text: "هذا النوع من الملفات لا يمكن معاينته مباشرة. يمكنك تحميل الملف.",
            icon: "info",
            showCancelButton: true,
            confirmButtonText: "⬇️ تحميل الملف",
            cancelButtonText: "إلغاء",
            confirmButtonColor: "#2563eb"
        }).then((result) => {
            if (result.isConfirmed) {
                const link = document.createElement('a');
                link.href = fileUrl;
                link.download = fileName;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }
        });
    }
});

$('#videoPreviewModal').on('hidden.bs.modal', function () {
    const video = document.getElementById("previewVideo");
    if (video) {
        video.pause();
        video.currentTime = 0;
    }
});

// تنظيف iframe عند إغلاق النافذة
$('#filePreviewModal').on('hidden.bs.modal', function () {
    console.log("🧹 Cleaning up file preview modal");
    $(this).find(".modal-body").html(`
            <iframe id="previewFileFrame" src="" 
                    width="100%" 
                    height="100%" 
                    style="border:none; background:#1f2937;"></iframe>
        `);
});

// المجموعات والبحث
$("#tab-chats").click(() => {
    $("#tab-chats").addClass("active");
    $("#tab-groups").removeClass("active");
    $("#chatList").removeClass("d-none");
    $("#groupList").addClass("d-none");
    $("#createGroupBox").hide();
    $("#userSearchInput").attr("placeholder", "ابحث بالإيميل أو رقم الهاتف...");
});

$("#tab-groups").click(() => {
    $("#tab-groups").addClass("active");
    $("#tab-chats").removeClass("active");
    $("#groupList").removeClass("d-none");
    $("#chatList").addClass("d-none");
    $("#createGroupBox").show();
    $("#userSearchInput").attr("placeholder", "ابحث باسم المجموعة...");
});

$("#btnNewGroup").click(() => $("#createGroupModal").modal("show"));

$("#saveGroupBtn").click(() => {
    let title = $("#groupNameInput").val().trim();
    if (!title) return alert("الرجاء إدخال اسم المجموعة.");
    $.post("/Groups/Create", { title }, () => location.reload())
        .fail(() => alert("حدث خطأ أثناء إنشاء المجموعة."));
});

$("#userSearchInput").on("keyup", function () {
    const q = $(this).val().trim();
    if (q.length < 2) return $("#userSearchResults").empty();

    $.get(`/Chat/SearchUsers`, { query: q }, users => {
        const box = $("#userSearchResults");
        box.empty();

        if (users.length === 0) {
            box.html('<div class="text-muted text-center">لا يوجد نتائج</div>');
            return;
        }

        users.forEach(u => {
            box.append(`
                    <div class="search-user-card d-flex align-items-center justify-content-between p-2 border rounded mb-2" data-id="${u.id}" style="cursor:pointer;">
                        <div class="d-flex align-items-center gap-2">
                            <img src="${u.photoUrl ?? '/images/avatars/default-avatar.png'}" width="35" height="35" class="rounded-circle" />
                            <div>
                                <strong>${u.displayName ?? "(مستخدم غير معروف)"}</strong><br/>
                                <small class="text-muted">${u.email ?? ""}</small>
                            </div>
                        </div>
                    </div>
                `);
        });
    });
});

// عند النقر على الكرت يبدأ المحادثة مباشرة
$(document).on("click", ".search-user-card", function () {
    const targetUserId = $(this).data("id");
    $.post("/Chat/StartChat", { targetUserId }, res => {
        if (res.conversationId) {
            location.href = `/Chat?open=${res.conversationId}`;
        } else {
            alert("حدث خطأ أثناء إنشاء المحادثة.");
        }
    }).fail(() => {
        alert("حدث خطأ أثناء محاولة بدء المحادثة.");
    });
});

$("#btnGroupInfo").on("click", function () {
    const id = $(this).data("group-id");
    if (id) window.location.href = `/Groups/Details/${id}`;
});

function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    const mb = kb / 1024;
    if (mb < 1024) return `${mb.toFixed(1)} MB`;
    const gb = mb / 1024;
    return `${gb.toFixed(1)} GB`;
}

// SignalR
const connection = new signalR.HubConnectionBuilder()
    .withUrl("/hubs/tawasul")
    .build();

connection.on("ReceiveMessage", (msg) => {
    console.log("📩 Received:", msg);

    msg.isMine = String(msg.senderId) === String(currentUserId);
    msg.replyTo = msg.replyTo ?? msg.ReplyTo ?? null;


    if (String(msg.conversationId) === String(currentConvId)) {
        appendMessage(msg);
        $("#chatBody").scrollTop($("#chatBody")[0].scrollHeight);
    } else {
        const item = $(`.conv-item[data-id='${msg.conversationId}']`);
        if (item.length) {
            let badge = item.find(".badge-unread");
            if (badge.length === 0) {
                item.find(".fw-bold")
                    .after(`<span class="badge bg-primary rounded-pill badge-unread ms-2">1</span>`);
            } else {
                let count = parseInt(badge.text()) || 0;
                badge.text(count + 1);
            }
        }
    }
});


connection.on("MessageEdited", (msg) => {
    const $div = $(`.msg[data-id='${msg.id}']`);
    if (!$div.length) return;

    // نص
    if (typeof msg.text !== "undefined") {
        const textEl = $div.find(".msg-text");
        if (msg.text) {
            if (textEl.length) textEl.text(msg.text);
            else $div.find(".msg-content").prepend(`<div class="msg-text">${escapeHtml(msg.text)}</div>`);
            $div.attr("data-text", msg.text);
        } else {
            textEl.remove();
            $div.attr("data-text", "");
        }
    }

    // مرفق (اختياري – إذا أرسلت هذه الحقول من السيرفر)
    if (typeof msg.fileUrl !== "undefined") {
        $div.attr("data-file-url", msg.fileUrl || "");
        $div.attr("data-file-name", msg.fileName || "");
        $div.attr("data-file-type", (msg.fileType || "").toLowerCase());

        // TODO: أعد بناء جزء المعاينة داخل الرسالة حسب النوع
        // لم ألمس قالبك الحالي لتقليل التغيير.
    }
});


connection.on("MessageDeleted", (data) => {
    const msgDiv = $(`.msg[data-id='${data.id}']`);

    if (msgDiv.length > 0) {
        if (data.deletedCompletely) {
            msgDiv.animate({
                opacity: 0,
                height: 0,
                marginTop: 0,
                marginBottom: 0,
                paddingTop: 0,
                paddingBottom: 0
            }, 300, function () {
                $(this).remove();
            });
        } else {
            msgDiv.html('<div class="text-muted fst-italic">🚫 تم حذف هذه الرسالة</div>');
        }
    }
});

connection.start()
    .then(() => console.log("✅ Connected to ChatHub!"))
    .catch(err => console.error("❌ Hub Error:", err));



// 🔽🔽 (أضف هذا الكود الجديد هنا) 🔽🔽
// --- (الكود الجديد: إضافة الإيموجي) ---

// (1) زر فتح "البوب أب"
$("#emojiBtn").on("click", function (e) {
    e.stopPropagation();
    $("#emojiPickerContainer").toggleClass("active");
});

// (2) إغلاق "البوب أب" عند الضغط خارجه
$(document).on("click", function () {
    $("#emojiPickerContainer").removeClass("active");
});

// (3) جلب الإيموجي عند الضغط عليه
// (ملاحظة: هذا الكود "Vanilla JS" لأنه Web Component)
// (3) جلب الإيموجي عند الضغط عليه - مع فحص الوجود
const emojiPickerEl = document.querySelector('emoji-picker');
if (emojiPickerEl) {
    emojiPickerEl.addEventListener('emoji-click', (event) => {
        const emoji = event.detail.unicode;
        const input = $("#messageInput");
        input.val(input.val() + emoji).focus();
        $("#sendBtn").prop("disabled", false);
    });
}





