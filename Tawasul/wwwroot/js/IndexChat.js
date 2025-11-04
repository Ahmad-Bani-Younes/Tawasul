// wwwroot/js/chat.js

// المتغيرات العامة
let currentConvId = null;
let currentType = null;
let cropper = null;

// ✅ تهيئة الصفحة
function initializeChat() {
    const params = new URLSearchParams(window.location.search);
    const openId = params.get("open");

    if (!openId) {
        $("#chatInputArea").hide();
        $("#emptyState").show();
    } else {
        $(`.conv-item[data-id='${openId}']`).trigger("click");
    }
}

// ✅ إدارة المحادثات
function setupConversationEvents() {
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
        } else {
            $("#btnGroupInfo").addClass("d-none");
        }

        $("#chatBody").html('<div class="text-center text-muted mt-5">جارٍ تحميل الرسائل...</div>');
        $("#messageInput, #sendBtn").prop("disabled", false);

        $.get(`/Chat/LoadMessages/${id}`, function (data) {
            $("#chatBody").empty();
            data.forEach(m => appendMessage(m));
        });

        // 🟢 إزالة البادج عند فتح المحادثة
        $(this).find(".badge-unread").remove();
    });
}

// ✅ إرسال الرسائل
function setupMessageSending() {
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
}

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

    $.ajax({
        url: "/Chat/SendMessage",
        type: "POST",
        data: formData,
        processData: false,
        contentType: false,
        success: (msg) => {
            appendMessage(msg);
            resetMessageForm();
        },
        error: (xhr) => {
            console.error("❌ خطأ في الإرسال:", xhr.responseText);
            alert("حدث خطأ أثناء إرسال الرسالة: " + xhr.responseText);
        }
    });
}

function resetMessageForm() {
    $("#messageInput").val("");
    $("#fileInput").val("");
    $("#filePreviewArea").addClass("d-none");
    $("#filePreviewBox").addClass("d-none");
    $("#filePreviewContent").empty();
    $("#btnEditImage").addClass("d-none");
    $("#sendBtn").prop("disabled", true);
}

// ✅ إدارة الملفات
function setupFileHandling() {
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

        showFilePreview(file);
    });

    $("#btnCancelFile").click(() => {
        $("#fileInput").val("");
        $("#filePreviewBox").addClass("d-none");
        $("#filePreviewContent").empty();
    });

    $("#btnRemovePreview").on("click", function () {
        $("#fileInput").val("");
        $("#filePreviewArea").addClass("d-none");
        $("#filePreviewBox").addClass("d-none");
        $("#filePreviewContent").empty();
        $("#btnEditImage").addClass("d-none");
    });

    $("#btnPreviewFile").click(previewFileBeforeSend);
}

function showFilePreview(file) {
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
}

function previewFileBeforeSend() {
    const file = $("#fileInput")[0].files[0];
    if (!file) return;

    const type = (file.type || "").toLowerCase();
    const blobUrl = URL.createObjectURL(file);
    const iframe = $("#previewFileFrame");
    const downloadBtn = $("#downloadFileBtn");

    downloadBtn.attr("href", blobUrl);
    downloadBtn.attr("download", file.name);

    if (type.includes("pdf")) {
        iframe.attr("src", blobUrl);
    } else if (type.includes("word") || type.includes("officedocument.word")) {
        iframe.attr("src", `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(blobUrl)}`);
    } else if (type.includes("excel") || type.includes("spreadsheetml")) {
        iframe.attr("src", `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(blobUrl)}`);
    } else {
        alert("لا يمكن عرض هذا النوع من الملفات مسبقًا.");
        return;
    }

    $("#filePreviewModal").modal("show");
}

// ✅ تعديل الصور
function setupImageEditing() {
    $("#btnEditImage").on("click", function () {
        const img = document.getElementById("previewImage");
        if (!img) return;

        const modalHtml = `
            <div class="modal fade show" id="editImageModal" tabindex="-1" style="display: block; background: rgba(0,0,0,0.85);">
                <div class="modal-dialog modal-lg modal-dialog-centered">
                    <div class="modal-content" style="background: #1a1a1a; border: none; border-radius: 12px;">
                        <div class="modal-header" style="border-bottom: 1px solid #333; padding: 1rem 1.5rem;">
                            <h5 class="modal-title text-white fw-bold">
                                <i class="bi bi-crop me-2"></i>اقتصاص الصورة
                            </h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body p-3" style="height: 500px; display: flex; align-items: center; justify-content: center; background: #000;">
                            <img id="cropImage" src="${img.src}" style="max-width: 100%; max-height: 100%; display: block;" />
                        </div>
                        <div class="modal-footer" style="border-top: 1px solid #333; padding: 1rem 1.5rem;">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                                <i class="bi bi-x-circle me-1"></i>إلغاء
                            </button>
                            <button type="button" id="btnCropApply" class="btn btn-success px-4">
                                <i class="bi bi-check2-circle me-1"></i>حفظ
                            </button>
                        </div>
                    </div>
                </div>
            </div>`;
        
        $("body").append(modalHtml);
        const modal = document.getElementById("editImageModal");
        
        const cropImg = document.getElementById("cropImage");
        cropper = new Cropper(cropImg, { 
            aspectRatio: NaN,
            viewMode: 1,
            dragMode: 'move',
            autoCropArea: 0.8,
            restore: false,
            guides: true,
            center: true,
            highlight: false,
            cropBoxMovable: true,
            cropBoxResizable: true,
            toggleDragModeOnDblclick: false,
            background: false,
            modal: false,
            responsive: true,
            checkCrossOrigin: false
        });

        $("#btnCropApply").on("click", function () {
            const canvas = cropper.getCroppedCanvas({ 
                maxWidth: 1200,
                maxHeight: 1200,
                imageSmoothingEnabled: true,
                imageSmoothingQuality: 'high'
            });
            
            canvas.toBlob((blob) => {
                const url = URL.createObjectURL(blob);
                $("#previewImage").attr("src", url);
                
                const file = new File([blob], "cropped-image.png", { type: "image/png" });
                const dataTransfer = new DataTransfer();
                dataTransfer.items.add(file);
                $("#fileInput")[0].files = dataTransfer.files;
                
                $(modal).remove();
                cropper.destroy();
                cropper = null;
            }, 'image/png', 1.0);
        });

        $(modal).find(".btn-close, .btn-secondary").on("click", function() {
            $(modal).remove();
            if (cropper) {
                cropper.destroy();
                cropper = null;
            }
        });
    });
}

// ✅ عرض الرسائل
function appendMessage(m) {
    let filePreview = "";
    const name = m.fileName || "ملف مرفق";
    const type = (m.fileType || "").toLowerCase();
    const fileUrl = m.fileUrl;
    const fileSize = m.fileSize || 0;

    if (type.startsWith("image/")) {
        filePreview = `
            <div class="position-relative mt-2">
                <img src="${fileUrl}" alt="${name}"
                     class="chat-image"
                     style="max-width:200px; max-height:200px; border-radius:12px; object-fit:cover; cursor:pointer;" />
                <a href="${fileUrl}" download="${name}" class="btn btn-sm btn-light position-absolute bottom-0 end-0 m-2 shadow-sm">
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
                <a href="${fileUrl}" download="${name}" class="btn btn-sm btn-light position-absolute bottom-0 end-0 m-2 shadow-sm">
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
                    <div class="file-name">${name}</div>
                    <div class="file-details">
                        <span class="file-size">${formatFileSize(fileSize)}</span>
                        <span class="file-type">${type.split('/')[1] || 'ملف'}</span>
                    </div>
                </div>
            </div>
            <a href="${fileUrl}" download="${name}" class="btn btn-sm btn-outline-secondary mt-2">⬇️ تحميل الملف</a>
        </div>`;
    }

    const html = `
    <div class="msg ${m.isMine ? "me" : "other"}" data-id="${m.id}">
        <div class="msg-content position-relative">
            ${m.text ? `<div>${m.text}</div>` : ""}
            ${m.isEdited ? `<small class="text-muted fst-italic">(معدلة)</small>` : ""}
            ${filePreview}
            <div class="small mt-1 text-end opacity-75">
                ${new Date(m.createdAtUtc).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
            ${m.isMine ? `
                <div class="msg-actions">
                    <button class="btn btn-sm btn-light edit-msg">✏️</button>
                    <button class="btn btn-sm btn-danger delete-msg">🗑️</button>
                </div>
            ` : ""}
        </div>
    </div>`;

    $("#chatBody").append(html);
    $("#chatBody").scrollTop($("#chatBody")[0].scrollHeight);
}

// ✅ إدارة الرسائل (تعديل وحذف)
function setupMessageActions() {
    $(document).on("click", ".edit-msg", function () {
        const msgDiv = $(this).closest(".msg");
        const msgId = msgDiv.data("id");
        const oldText = msgDiv.find(".msg-content > div:first").text().trim();

        Swal.fire({
            title: "✏️ تعديل الرسالة",
            input: "textarea",
            inputValue: oldText,
            inputAttributes: { "aria-label": "نص الرسالة" },
            showCancelButton: true,
            confirmButtonText: "💾 حفظ التعديل",
            cancelButtonText: "إلغاء",
            confirmButtonColor: "#2563eb",
            cancelButtonColor: "#6c757d",
            background: "#fff",
            customClass: {
                popup: "rounded-4 shadow-lg p-4",
                title: "fw-bold fs-5 text-primary",
                confirmButton: "btn btn-primary px-4 fw-bold",
                cancelButton: "btn btn-secondary px-4 fw-bold"
            },
            preConfirm: (value) => {
                if (!value.trim()) {
                    Swal.showValidationMessage("الرجاء إدخال نص الرسالة.");
                }
                return value.trim();
            }
        }).then((result) => {
            if (result.isConfirmed) {
                const newText = result.value;
                $.post("/Chat/EditMessage", { messageId: msgId, newText }, () => {
                    msgDiv.find(".msg-content > div:first").text(newText);
                    if (msgDiv.find(".text-muted.fst-italic").length === 0)
                        msgDiv.find(".msg-content").append(`<small class="text-muted fst-italic">(معدلة)</small>`);

                    Swal.fire({
                        title: "✅ تم الحفظ",
                        text: "تم تعديل الرسالة بنجاح.",
                        icon: "success",
                        timer: 1200,
                        showConfirmButton: false
                    });
                });
            }
        });
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
}

// ✅ معاينة الوسائط
function setupMediaPreviews() {
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

    $(document).on("click", ".chat-file", function () {
        const fileUrl = $(this).data("file");
        const type = ($(this).data("type") || "").toLowerCase();
        const iframe = $("#previewFileFrame");
        const downloadBtn = $("#downloadFileBtn");

        downloadBtn.attr("href", fileUrl);

        if (type.includes("pdf")) {
            iframe.attr("src", fileUrl);
        }
        else if (type.includes("word") || type.includes("officedocument.word")) {
            iframe.attr("src", `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(fileUrl)}`);
        }
        else if (type.includes("excel") || type.includes("spreadsheetml")) {
            iframe.attr("src", `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(fileUrl)}`);
        }
        else {
            iframe.attr("src", "");
            alert("هذا النوع من الملفات لا يمكن معاينته، يمكنك تحميله مباشرة.");
            return;
        }

        $("#filePreviewModal").modal("show");
    });

    $('#videoPreviewModal').on('hidden.bs.modal', function () {
        const video = document.getElementById("previewVideo");
        if (video) {
            video.pause();
            video.currentTime = 0;
        }
    });
}

// ✅ إدارة المجموعات والبحث
function setupGroupsAndSearch() {
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
                    <div class="d-flex align-items-center justify-content-between p-2 border rounded mb-2">
                        <div class="d-flex align-items-center gap-2">
                            <img src="${u.photoUrl ?? '/images/default-avatar.png'}" width="35" height="35" class="rounded-circle" />
                            <div>
                                <strong>${u.displayName ?? "(مستخدم غير معروف)"}</strong><br/>
                                <small class="text-muted">${u.email ?? ""}</small>
                            </div>
                        </div>
                        <button class="btn btn-sm btn-primary btnStartChat" data-id="${u.id}">بدء محادثة</button>
                    </div>
                `);
            });
        });
    });

    $(document).on("click", ".btnStartChat", function () {
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
}

// ✅ أدوات مساعدة
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

// ✅ تهيئة كل شيء عند تحميل الصفحة
function initializeAll() {
    initializeChat();
    setupConversationEvents();
    setupMessageSending();
    setupFileHandling();
    setupImageEditing();
    setupMessageActions();
    setupMediaPreviews();
    setupGroupsAndSearch();
}

// جعل الدوال متاحة globally
window.initializeAll = initializeAll;
window.appendMessage = appendMessage;