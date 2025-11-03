using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Tawasul.Data;
using System.Security.Claims;

namespace Tawasul.Hubs
{
    public class ChatHub : Hub
    {
        private readonly TawasulDbContext _db;

        public ChatHub(TawasulDbContext db)
        {
            _db = db;
        }

        public override async Task OnConnectedAsync()
        {
            var userId = Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (userId != null)
            {
                // انضمام المستخدم لكل المحادثات الخاصة فيه
                var conversationIds = await _db.ConversationMembers
                    .Where(m => m.UserId == userId)
                    .Select(m => m.ConversationId.ToString())
                    .ToListAsync();

                foreach (var convId in conversationIds)
                {
                    await Groups.AddToGroupAsync(Context.ConnectionId, convId);
                }

                var user = await _db.Users.FindAsync(userId);
                if (user != null)
                {
                    user.IsOnline = true;
                    await _db.SaveChangesAsync();
                    await Clients.All.SendAsync("UserStatusChanged", userId, true);
                }
            }

            await base.OnConnectedAsync();
        }


        public override async Task OnDisconnectedAsync(Exception? exception)
        {
            var userId = Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (userId != null)
            {
                var user = await _db.Users.FindAsync(userId);
                if (user != null)
                {
                    user.IsOnline = false;
                    user.LastSeenAt = DateTime.UtcNow;
                    await _db.SaveChangesAsync();

                    // بثّ الحالة الجديدة للجميع
                    await Clients.All.SendAsync("UserStatusChanged", userId, false);
                }
            }

            await base.OnDisconnectedAsync(exception);
        }

        public async Task JoinConversation(string conversationId)
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, conversationId);
        }
    }
}
