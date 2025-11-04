// 🔹 تهيئة الموقع
document.addEventListener('DOMContentLoaded', function () {
    // 🔹 تحسين تجربة المستخدم
    enhanceUserExperience();

    // 🔹 إضافة تأثيرات تفاعلية
    addInteractiveEffects();
});

// 🔹 تحسين تجربة المستخدم
function enhanceUserExperience() {
    // 🔹 إضافة تأثيرات للروابط
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.addEventListener('mouseenter', function () {
            this.style.transform = 'translateY(-2px)';
        });

        link.addEventListener('mouseleave', function () {
            this.style.transform = 'translateY(0)';
        });
    });

    // 🔹 إضافة تأثيرات للأزرار
    const buttons = document.querySelectorAll('.btn');
    buttons.forEach(button => {
        button.addEventListener('mouseenter', function () {
            this.style.transform = 'translateY(-2px)';
        });

        button.addEventListener('mouseleave', function () {
            this.style.transform = 'translateY(0)';
        });

        button.addEventListener('mousedown', function () {
            this.style.transform = 'translateY(0)';
        });

        button.addEventListener('mouseup', function () {
            this.style.transform = 'translateY(-2px)';
        });
    });
}

// 🔹 إضافة تأثيرات تفاعلية
function addInteractiveEffects() {
    // 🔹 تأثيرات للشعار
    const logo = document.querySelector('.navbar-brand');
    if (logo) {
        logo.addEventListener('mouseenter', function () {
            this.style.transform = 'scale(1.05) rotate(-2deg)';
        });

        logo.addEventListener('mouseleave', function () {
            this.style.transform = 'scale(1) rotate(0)';
        });
    }

    // 🔹 تحسين التنقل على الموبايل
    const navbarToggler = document.querySelector('.navbar-toggler');
    const navbarCollapse = document.querySelector('.navbar-collapse');

    if (navbarToggler && navbarCollapse) {
        navbarToggler.addEventListener('click', function () {
            navbarCollapse.classList.toggle('show');
        });
    }
}

// 🔹 وظائف مساعدة
const TawasulUtils = {
    // 🔹 إظهار إشعار
    showNotification: function (message, type = 'info') {
        // يمكن إضافة مكتبة إشعارات هنا
        console.log(`[${type.toUpperCase()}] ${message}`);
    },

    // 🔹 تحميل سلس
    smoothScroll: function (element) {
        if (element) {
            element.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    },

    // 🔹 تنسيق التاريخ
    formatDate: function (date) {
        return new Date(date).toLocaleDateString('ar-EG', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }
};

// 🔹 جعل الوظائف متاحة عالمياً
window.TawasulUtils = TawasulUtils;