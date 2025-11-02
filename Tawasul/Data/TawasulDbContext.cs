using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Tawasul.Models; // تأكد أن الـ Models تحتوي ApplicationUser + باقي الكيانات

namespace Tawasul.Data
{
    public class TawasulDbContext : IdentityDbContext<ApplicationUser>
    {
        public TawasulDbContext(DbContextOptions<TawasulDbContext> options)
            : base(options)
        {
        }

        // ============================
        // DbSets (جداول قاعدة البيانات)
        // ============================
        public DbSet<Conversation> Conversations => Set<Conversation>();
        public DbSet<ConversationMember> ConversationMembers => Set<ConversationMember>();
        public DbSet<Message> Messages => Set<Message>();
        public DbSet<MessageAttachment> MessageAttachments => Set<MessageAttachment>();
        public DbSet<UserMessageStatus> UserMessageStatuses => Set<UserMessageStatus>();
        public DbSet<PriorityContact> PriorityContacts => Set<PriorityContact>();
        public DbSet<GroupJoinRequest> GroupJoinRequests { get; set; }




        // ============================
        // إعدادات النموذج (Model Config)
        // ============================
        protected override void OnModelCreating(ModelBuilder builder)
        {
            base.OnModelCreating(builder);

            // Conversation
            builder.Entity<Conversation>(e =>
            {
                e.Property(x => x.Title).HasMaxLength(180);
                e.HasOne(x => x.CreatedByUser)
                    .WithMany()
                    .HasForeignKey(x => x.CreatedByUserId)
                    .OnDelete(DeleteBehavior.Restrict);
            });

            builder.Entity<ConversationMember>(e =>
            {
                e.HasKey(x => new { x.ConversationId, x.UserId });

                e.HasOne(x => x.Conversation)
                    .WithMany(c => c.Members)
                    .HasForeignKey(x => x.ConversationId)
                    .OnDelete(DeleteBehavior.Cascade);

                e.HasOne(x => x.User)
                    .WithMany()
                    .HasForeignKey(x => x.UserId)
                    .OnDelete(DeleteBehavior.Cascade);

                // ✅ جديد: من الذي أضاف العضو
                e.HasOne(x => x.InvitedByUser)
                    .WithMany()
                    .HasForeignKey(x => x.InvitedByUserId)
                    .OnDelete(DeleteBehavior.SetNull);
            });



            // ✅ Message
            builder.Entity<Message>(e =>
            {
                e.HasOne(x => x.Conversation)
                    .WithMany(c => c.Messages)
                    .HasForeignKey(x => x.ConversationId)
                    .OnDelete(DeleteBehavior.Cascade);

                e.HasOne(x => x.Sender)
                    .WithMany()
                    .HasForeignKey(x => x.SenderId)
                    .OnDelete(DeleteBehavior.Restrict);
            });

            // ✅ MessageAttachment
            builder.Entity<MessageAttachment>(e =>
            {
                e.HasOne(x => x.Message)
                    .WithMany(m => m.Attachments)
                    .HasForeignKey(x => x.MessageId)
                    .OnDelete(DeleteBehavior.Cascade);
            });

            // ✅ UserMessageStatus (مفتاح مركب)
            builder.Entity<UserMessageStatus>(e =>
            {
                e.HasKey(x => new { x.MessageId, x.UserId });

                e.HasOne(x => x.Message)
                    .WithMany(m => m.Statuses)
                    .HasForeignKey(x => x.MessageId)
                    .OnDelete(DeleteBehavior.Cascade);

                e.HasOne(x => x.User)
                    .WithMany()
                    .HasForeignKey(x => x.UserId)
                    .OnDelete(DeleteBehavior.Restrict);

                e.HasCheckConstraint("CK_UserMessageStatus_Seen",
                    "(HasSeen = 0 AND SeenAtUtc IS NULL) OR (HasSeen = 1 AND SeenAtUtc IS NOT NULL)");
            });

            // ✅ PriorityContact (مفتاح مركب)
            builder.Entity<PriorityContact>(e =>
            {
                e.HasKey(x => new { x.UserId, x.PriorityUserId });

                e.HasOne(x => x.User)
                    .WithMany()
                    .HasForeignKey(x => x.UserId)
                    .OnDelete(DeleteBehavior.Cascade);

                e.HasOne(x => x.PriorityUser)
                    .WithMany()
                    .HasForeignKey(x => x.PriorityUserId)
                    .OnDelete(DeleteBehavior.Restrict);
            });

            builder.Entity<GroupJoinRequest>(e =>
            {
                e.HasOne(r => r.RequestedByUser)
                    .WithMany()
                    .HasForeignKey(r => r.RequestedByUserId)
                    .OnDelete(DeleteBehavior.Restrict); // 👈 غيرنا من Cascade إلى Restrict

                e.HasOne(r => r.TargetUser)
                    .WithMany()
                    .HasForeignKey(r => r.TargetUserId)
                    .OnDelete(DeleteBehavior.Restrict); // 👈 نفس الشي

                e.HasOne(r => r.InvitedByUser)
                    .WithMany()
                    .HasForeignKey(r => r.InvitedByUserId)
                    .OnDelete(DeleteBehavior.NoAction); // ✅ الحل
            });


        }
    }
}
