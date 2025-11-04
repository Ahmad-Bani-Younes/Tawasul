// 🔹 تهيئة صفحة الرئيسية
document.addEventListener('DOMContentLoaded', function () {
    initHomePage();
    setupAnimations();
    setupCounters();
});

// 🔹 تهيئة الصفحة
function initHomePage() {
    console.log('🏠 تهيئة صفحة الرئيسية...');

    // 🔹 إضافة تأثيرات تفاعلية
    addInteractiveEffects();

    // 🔹 إعداد متابعة التمرير
    setupScrollEffects();
}

// 🔹 إعداد الأنيميشنز
function setupAnimations() {
    // 🔹 تأثيرات للبطاقات عند الظهور
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver(function (entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, observerOptions);

    // 🔹 مراقبة العناصر للأنيميشن
    const animatedElements = document.querySelectorAll('.feature-card, .stat-item, .cta-card');
    animatedElements.forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(30px)';
        el.style.transition = 'all 0.6s ease';
        observer.observe(el);
    });
}

// 🔹 إعداد العدادات
function setupCounters() {
    const counters = document.querySelectorAll('.stat-number');

    counters.forEach(counter => {
        const target = parseInt(counter.getAttribute('data-target') || counter.textContent);
        const duration = 2000; // 2 seconds
        const step = target / (duration / 16); // 60fps
        let current = 0;

        const updateCounter = () => {
            current += step;
            if (current < target) {
                counter.textContent = Math.floor(current).toLocaleString();
                requestAnimationFrame(updateCounter);
            } else {
                counter.textContent = target.toLocaleString();
            }
        };

        // 🔹 بدء العد عند الظهور
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    updateCounter();
                    observer.unobserve(entry.target);
                }
            });
        });

        observer.observe(counter);
    });
}

// 🔹 إضافة تأثيرات تفاعلية
function addInteractiveEffects() {
    // 🔹 تأثيرات لأزرار النداء للعمل
    const ctaButtons = document.querySelectorAll('.hero-btn, .cta-card .btn');
    ctaButtons.forEach(button => {
        button.addEventListener('mouseenter', function () {
            this.style.transform = 'translateY(-3px)';
        });

        button.addEventListener('mouseleave', function () {
            this.style.transform = 'translateY(0)';
        });

        button.addEventListener('mousedown', function () {
            this.style.transform = 'translateY(-1px)';
        });

        button.addEventListener('mouseup', function () {
            this.style.transform = 'translateY(-3px)';
        });
    });

    // 🔹 تأثيرات لبطاقات الميزات
    const featureCards = document.querySelectorAll('.feature-card');
    featureCards.forEach(card => {
        card.addEventListener('mouseenter', function () {
            const icon = this.querySelector('.feature-icon');
            if (icon) {
                icon.style.transform = 'scale(1.1) rotate(5deg)';
            }
        });

        card.addEventListener('mouseleave', function () {
            const icon = this.querySelector('.feature-icon');
            if (icon) {
                icon.style.transform = 'scale(1) rotate(0)';
            }
        });
    });
}

// 🔹 إعداد تأثيرات التمرير
function setupScrollEffects() {
    let lastScrollTop = 0;

    window.addEventListener('scroll', function () {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

        // 🔹 تأثير الشفافية للهيدر
        const navbar = document.querySelector('.navbar');
        if (navbar) {
            if (scrollTop > 100) {
                navbar.style.background = 'rgba(255, 255, 255, 0.95)';
                navbar.style.backdropFilter = 'blur(10px)';
            } else {
                navbar.style.background = 'var(--surface)';
                navbar.style.backdropFilter = 'none';
            }
        }

        lastScrollTop = scrollTop;
    });
}

// 🔹 وظائف مساعدة للصفحة الرئيسية
const HomeUtils = {
    // 🔹 التمرير السلس للأقسام
    scrollToSection: function (sectionId) {
        const element = document.getElementById(sectionId);
        if (element) {
            element.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    },

    // 🔹 نسخ رابط الدعوة
    copyInviteLink: function () {
        const inviteLink = window.location.origin;
        navigator.clipboard.writeText(inviteLink).then(function () {
            // 🔹 يمكن إضافة إشعار نجاح هنا
            console.log('✅ تم نسخ رابط الدعوة: ' + inviteLink);
        });
    },

    // 🔹 فتح الدردشة
    openChatDemo: function () {
        // 🔹 محاكاة فتح نموذج الدردشة
        console.log('💬 فتح نموذج الدردشة التجريبي');
    }
};

// 🔹 جعل الوظائف متاحة عالمياً
window.HomeUtils = HomeUtils;

// 🔹 تهيئة إضافية عند التمرير
window.addEventListener('load', function () {
    // 🔹 إضافة تأثيرات بعد تحميل الصفحة
    setTimeout(() => {
        document.body.classList.add('page-loaded');
    }, 100);
});