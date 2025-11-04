// ? SignalR Connection - ??? ????? ????

// ????? ????? SignalR
const connection = new signalR.HubConnectionBuilder()
    .withUrl("/hubs/tawasul")
    .build();

// ? ??????? ??????? ?? ???????
connection.on("ReceiveMessage", (msg) => {
    console.log("?? Received:", msg);

    if (msg.senderId === currentUserId) return;

    if (msg.conversationId === currentConvId) {
        appendMessage(msg);
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

// ? ?????? ???? ??????????
connection.on("UserStatusChanged", (userId, isOnline) => {
    console.log(`?? ???????? ${userId} ???? ${isOnline ? "????" : "??? ????"}`);
});

// ? ??? ????? ?????
connection.on("MessageEdited", (msg) => {
    const div = $(`.msg[data-id='${msg.id}']`);
    div.find(".msg-content > div:first").text(msg.text);
});

// ? ??? ??? ?????
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
            }, 300, function() {
                $(this).remove();
            });
        } else {
            msgDiv.html('<div class="text-muted fst-italic p-2 text-center">?? ?? ??? ??? ???????</div>');
        }
    }
});

// ? ??? ???????
connection.start()
    .then(() => console.log("? Connected to ChatHub!"))
    .catch(err => console.error("? Hub Error:", err));

// ? ??? ????? ??? ??????
$(document).on("click", ".conv-item", function () {
    const id = $(this).data("id");
    currentConvId = id;

    $(this).find(".badge-unread").remove();

    if (connection.state === signalR.HubConnectionState.Connected) {
        connection.invoke("JoinConversation", id.toString());
    }
});
