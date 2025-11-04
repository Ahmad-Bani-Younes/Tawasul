// 🔹 تهيئة صفحة المصادقة
document.addEventListener('DOMContentLoaded', function () {
    initAuthPage();
    enhanceAuthForm();
    addPasswordToggle();
});

// 🔹 تهيئة الصفحة
function initAuthPage() {
    console.log('🔐 تهيئة صفحة المصادقة...');

    // 🔹 إضافة تأثيرات للعناصر
    const authCard = document.querySelector('.auth-card');
    if (authCard) {
        authCard.style.opacity = '0';
        authCard.style.transform = 'translateY(20px)';

        setTimeout(() => {
            authCard.style.transition = 'all 0.6s ease';
            authCard.style.opacity = '1';
            authCard.style.transform = 'translateY(0)';
        }, 100);
    }
}

// 🔹 تحسين نموذج المصادقة
function enhanceAuthForm() {
    const form = document.querySelector('.auth-form');
    const submitBtn = document.querySelector('.auth-submit-btn');

    if (!form || !submitBtn) return;

    // 🔹 التحقق من الصحة أثناء الكتابة
    const inputs = form.querySelectorAll('input[required]');
    inputs.forEach(input => {
        input.addEventListener('input', function () {
            validateField(this);
            updateSubmitButton();
        });

        input.addEventListener('blur', function () {
            validateField(this);
        });
    });

    // 🔹 منع الإرسال إذا كان النموذج غير صالح
    form.addEventListener('submit', function (e) {
        if (!form.checkValidity()) {
            e.preventDefault();
            showFormErrors();
            return;
        }

        // 🔹 إظهار حالة التحميل
        submitBtn.classList.add('loading');
        submitBtn.disabled = true;
        submitBtn.innerHTML = 'جاري تسجيل الدخول...';
    });

    // 🔹 إضافة تأثيرات للتركيز
    inputs.forEach(input => {
        input.addEventListener('focus', function () {
            this.parentElement.classList.add('focused');
        });

        input.addEventListener('blur', function () {
            if (!this.value) {
                this.parentElement.classList.remove('focused');
            }
        });
    });
}

// 🔹 التحقق من الحقل
function validateField(field) {
    const formGroup = field.closest('.form-group');
    const errorElement = formGroup.querySelector('.text-danger');

    // 🔹 إزالة التنسيق السابق
    formGroup.classList.remove('has-success', 'has-error');

    if (field.checkValidity()) {
        // 🔹 الحقل صالح
        formGroup.classList.add('has-success');
        if (errorElement) {
            errorElement.style.display = 'none';
        }
    } else {
        // 🔹 الحقل غير صالح
        formGroup.classList.add('has-error');
        if (errorElement) {
            errorElement.style.display = 'block';
        }
    }
}

// 🔹 تحديث حالة زر الإرسال
function updateSubmitButton() {
    const form = document.querySelector('.auth-form');
    const submitBtn = document.querySelector('.auth-submit-btn');

    if (form && submitBtn) {
        const isValid = form.checkValidity();
        submitBtn.disabled = !isValid;
    }
}

// 🔹 إظهار أخطاء النموذج
function showFormErrors() {
    const form = document.querySelector('.auth-form');
    const invalidFields = form.querySelectorAll('input:invalid');

    invalidFields.forEach(field => {
        validateField(field);

        // 🔹 تأثير اهتزاز للحقول غير الصالحة
        field.style.animation = 'shake 0.5s ease';
        setTimeout(() => {
            field.style.animation = '';
        }, 500);
    });

    // 🔹 إشعار للمستخدم
    showNotification('يرجى تصحيح الأخطاء في النموذج', 'error');
}

// 🔹 إضافة زر إظهار/إخفاء كلمة المرور
function addPasswordToggle() {
    const passwordInput = document.querySelector('input[type="password"]');
    if (!passwordInput) return;

    const formGroup = passwordInput.closest('.form-group');
    const toggleBtn = document.createElement('button');

    toggleBtn.type = 'button';
    toggleBtn.className = 'password-toggle';
    toggleBtn.innerHTML = '👁️';
    toggleBtn.setAttribute('aria-label', 'إظهار كلمة المرور');

    formGroup.style.position = 'relative';
    formGroup.appendChild(toggleBtn);

    toggleBtn.addEventListener('click', function () {
        const isPassword = passwordInput.type === 'password';
        passwordInput.type = isPassword ? 'text' : 'password';
        this.innerHTML = isPassword ? '🙈' : '👁️';
        this.setAttribute('aria-label', isPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور');
    });
}

// 🔹 إظهار الإشعارات
function showNotification(message, type = 'info') {
    // 🔹 يمكن استبدال هذا بمكتبة إشعارات مثل SweetAlert2
    console.log(`[${type.toUpperCase()}] ${message}`);

    // 🔹 إشعار بسيط
    const notification = document.createElement('div');
    notification.className = `alert alert-${type} mt-3`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 1000;
        animation: slideInRight 0.3s ease;
    `;

    document.body.appendChild(notification);

    // 🔹 إزالة الإشعار تلقائياً
    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 4000);
}

// 🔹 تأثيرات الحركة
const authAnimations = `
@keyframes shake {
    0%, 100% { transform: translateX(0); }
    25% { transform: translateX(-5px); }
    75% { transform: translateX(5px); }
}

@keyframes slideInRight {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
}

@keyframes slideOutRight {
    from { transform: translateX(0); opacity: 1; }
    to { transform: translateX(100%); opacity: 0; }
}

.has-success .form-control {
    border-color: var(--success) !important;
}

.has-error .form-control {
    border-color: var(--error) !important;
}

.form-group.focused .form-label {
    color: var(--primary);
}
`;

// 🔹 إضافة أنيميشنز للصفحة
const style = document.createElement('style');
style.textContent = authAnimations;
document.head.appendChild(style);

// 🔹 جعل الوظائف متاحة عالمياً
window.AuthUtils = {
    validateField,
    showNotification,
    enhanceAuthForm
};



// 🔹 تحسينات خاصة بصفحة التسجيل
function enhanceRegisterForm() {
    const form = document.querySelector('.auth-form');
    if (!form) return;

    // 🔹 التحقق من قوة كلمة المرور
    const passwordInput = form.querySelector('input[type="password"]');
    if (passwordInput) {
        passwordInput.addEventListener('input', function () {
            checkPasswordStrength(this.value);
        });
    }

    // 🔹 التحقق من تطابق كلمة المرور
    const confirmPasswordInput = form.querySelector('input[name="ConfirmPassword"]');
    if (confirmPasswordInput && passwordInput) {
        confirmPasswordInput.addEventListener('input', function () {
            checkPasswordMatch(passwordInput.value, this.value);
        });
    }

    // 🔹 التحقق من شروط الخدمة
    const termsCheckbox = form.querySelector('input[name="AcceptTerms"]');
    if (termsCheckbox) {
        termsCheckbox.addEventListener('change', function () {
            updateSubmitButton();
        });
    }

    // 🔹 التحقق من البريد الإلكتروني الفريد (محاكاة)
    const emailInput = form.querySelector('input[type="email"]');
    if (emailInput) {
        let emailTimeout;
        emailInput.addEventListener('input', function () {
            clearTimeout(emailTimeout);
            emailTimeout = setTimeout(() => {
                checkEmailAvailability(this.value);
            }, 800);
        });
    }
}

// 🔹 التحقق من قوة كلمة المرور
function checkPasswordStrength(password) {
    const strengthBar = document.querySelector('.strength-fill');
    const strengthText = document.querySelector('.strength-text');

    if (!strengthBar || !strengthText) return;

    let strength = 0;
    let text = 'ضعيفة';
    let className = 'strength-weak';

    // 🔹 معايير قوة كلمة المرور
    if (password.length >= 8) strength++;
    if (password.match(/[a-z]/) && password.match(/[A-Z]/)) strength++;
    if (password.match(/\d/)) strength++;
    if (password.match(/[^a-zA-Z\d]/)) strength++;

    switch (strength) {
        case 1:
            text = 'ضعيفة';
            className = 'strength-weak';
            break;
        case 2:
            text = 'متوسطة';
            className = 'strength-fair';
            break;
        case 3:
            text = 'جيدة';
            className = 'strength-good';
            break;
        case 4:
            text = 'قوية';
            className = 'strength-strong';
            break;
    }

    strengthBar.className = `strength-fill ${className}`;
    strengthText.textContent = `قوة كلمة المرور: ${text}`;
    strengthText.style.color = getComputedStyle(strengthBar).backgroundColor;
}

// 🔹 التحقق من تطابق كلمة المرور
function checkPasswordMatch(password, confirmPassword) {
    const confirmInput = document.querySelector('input[name="ConfirmPassword"]');
    const errorElement = confirmInput?.closest('.form-group')?.querySelector('.text-danger');

    if (!confirmInput || !errorElement) return;

    if (confirmPassword && password !== confirmPassword) {
        errorElement.textContent = 'كلمة المرور غير متطابقة';
        errorElement.style.display = 'block';
        confirmInput.setCustomValidity('كلمة المرور غير متطابقة');
    } else {
        errorElement.style.display = 'none';
        confirmInput.setCustomValidity('');
    }
}

// 🔹 التحقق من توفر البريد الإلكتروني (محاكاة)
function checkEmailAvailability(email) {
    const emailInput = document.querySelector('input[type="email"]');
    const errorElement = emailInput?.closest('.form-group')?.querySelector('.text-danger');

    if (!emailInput || !errorElement || !email) return;

    // 🔹 محاكاة التحقق من الخادم
    const fakeTakenEmails = ['test@example.com', 'user@domain.com', 'admin@site.com'];

    if (fakeTakenEmails.includes(email)) {
        errorElement.textContent = 'هذا البريد الإلكتروني مستخدم بالفعل';
        errorElement.style.display = 'block';
        emailInput.setCustomValidity('البريد الإلكتروني مستخدم');
    } else {
        errorElement.style.display = 'none';
        emailInput.setCustomValidity('');
    }
}

// 🔹 تحديث زر الإرسال مع مراعاة شروط الخدمة
function updateRegisterSubmitButton() {
    const form = document.querySelector('.auth-form');
    const submitBtn = document.querySelector('.auth-submit-btn');
    const termsCheckbox = form?.querySelector('input[name="AcceptTerms"]');

    if (form && submitBtn) {
        const isValid = form.checkValidity() && (!termsCheckbox || termsCheckbox.checked);
        submitBtn.disabled = !isValid;
    }
}

// 🔹 تهيئة صفحة التسجيل
function initRegisterPage() {
    console.log('📝 تهيئة صفحة التسجيل...');

    enhanceRegisterForm();

    // 🔹 تحديث زر الإرسال بشكل دوري
    setInterval(updateRegisterSubmitButton, 500);

    // 🔹 إضافة تأثيرات إضافية
    const authCard = document.querySelector('.auth-card');
    if (authCard) {
        authCard.style.opacity = '0';
        authCard.style.transform = 'translateY(20px)';

        setTimeout(() => {
            authCard.style.transition = 'all 0.6s ease';
            authCard.style.opacity = '1';
            authCard.style.transform = 'translateY(0)';
        }, 100);
    }
}

// 🔹 التحقق من نوع الصفحة وتنفيذ التهيئة المناسبة
if (window.location.pathname.includes('Register')) {
    document.addEventListener('DOMContentLoaded', initRegisterPage);
}

// 🔹 إضافة الأنيميشنز الإضافية
const registerAnimations = `
@keyframes pulseSuccess {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.05); }
}

.strength-strong {
    animation: pulseSuccess 2s infinite;
}

.terms-checkbox input:checked + .terms-text {
    color: var(--primary);
    font-weight: 500;
}
`;

// 🔹 إضافة الأنيميشنز للصفحة
const registerStyle = document.createElement('style');
registerStyle.textContent = registerAnimations;
document.head.appendChild(registerStyle);

// 🔹 تحديث الكائن العالمي
window.AuthUtils = {
    ...window.AuthUtils,
    checkPasswordStrength,
    checkPasswordMatch,
    checkEmailAvailability,
    enhanceRegisterForm,
    initRegisterPage
};