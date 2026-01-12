function handleDownload(e) {
    e.preventDefault();
    alert('ReaRead Extension\n\n✨ Installation Guide:\n\n1. Clone: https://github.com/damlalper/rearead-eyetracking\n2. Open Chrome → Extensions → Enable Developer Mode\n3. Click "Load unpacked" → Select extension folder\n4. Run: python companion/main.py\n5. Click extension icon → Calibrate\n\n📖 See README for detailed setup instructions.\n\n🎉 Available soon on Chrome Web Store!');
}

document.getElementById('download-btn').addEventListener('click', handleDownload);
document.getElementById('download-btn-2').addEventListener('click', handleDownload);

// Navbar scroll effect
const nav = document.querySelector('nav');
window.addEventListener('scroll', () => {
    if (window.scrollY > 100) {
        nav.classList.add('scrolled');
    } else {
        nav.classList.remove('scrolled');
    }
});

// Intersection Observer for scroll animations
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -100px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry, index) => {
        if (entry.isIntersecting) {
            setTimeout(() => {
                entry.target.classList.add('visible');
            }, index * 100);
        }
    });
}, observerOptions);

// Observe all animated elements
document.querySelectorAll('.feature-card, .step, .tech-item').forEach(el => {
    observer.observe(el);
});

// Smooth scroll
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        const href = this.getAttribute('href');
        if (href !== '#') {
            e.preventDefault();
            const target = document.querySelector(href);
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        }
    });
});

// Parallax effect for hero section (subtle)
let ticking = false;
window.addEventListener('scroll', () => {
    if (!ticking) {
        window.requestAnimationFrame(() => {
            const scrolled = window.scrollY;
            const hero = document.querySelector('.hero-content');
            if (hero && scrolled < 600) {
                hero.style.transform = `translateY(${scrolled * 0.15}px)`;
            }
            ticking = false;
        });
        ticking = true;
    }
});

// Active section highlighting in navbar
const sections = document.querySelectorAll('section[id]');
const navLinks = document.querySelectorAll('.nav-links a[href^="#"]');

function updateActiveNavLink() {
    const scrollY = window.scrollY;
    const offset = 150; // Offset for navbar height

    sections.forEach(section => {
        const sectionTop = section.offsetTop - offset;
        const sectionHeight = section.offsetHeight;
        const sectionId = section.getAttribute('id');

        if (scrollY >= sectionTop && scrollY < sectionTop + sectionHeight) {
            // Remove active class from all links
            navLinks.forEach(link => link.classList.remove('active'));

            // Add active class to current section's link
            const activeLink = document.querySelector(`.nav-links a[href="#${sectionId}"]`);
            if (activeLink) {
                activeLink.classList.add('active');
            }
        }
    });
}

// Update on scroll
window.addEventListener('scroll', updateActiveNavLink);

// Update on load
window.addEventListener('load', updateActiveNavLink);

// ==============================================================
// 🎨 2026 MODERN ANIMATIONS
// ==============================================================
// Custom cursor removed - keeping default cursor for better UX

// ==============================================================
// 🧲 MAGNETIC BUTTON EFFECTS
// ==============================================================

function initMagneticButtons() {
    const magneticElements = document.querySelectorAll('button, .btn, .cta-button, .download-btn, .nav-links a');

    magneticElements.forEach(el => {
        el.addEventListener('mouseenter', function() {
            this.style.transition = 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)';
        });

        el.addEventListener('mousemove', function(e) {
            const rect = this.getBoundingClientRect();
            const x = e.clientX - rect.left - rect.width / 2;
            const y = e.clientY - rect.top - rect.height / 2;

            // Stronger magnetic pull
            const moveX = x * 0.3;
            const moveY = y * 0.3;

            this.style.transform = `translate(${moveX}px, ${moveY}px) scale(1.05)`;
        });

        el.addEventListener('mouseleave', function() {
            this.style.transform = 'translate(0, 0) scale(1)';
        });
    });
}

// Initialize after DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMagneticButtons);
} else {
    initMagneticButtons();
}

// ==============================================================
// 📊 ANIMATED STAT COUNTERS
// ==============================================================

function animateCounter(element, target, duration = 2000, suffix = '') {
    const start = 0;
    const increment = target / (duration / 16);
    let current = start;

    const timer = setInterval(() => {
        current += increment;
        if (current >= target) {
            current = target;
            clearInterval(timer);
        }

        element.textContent = Math.floor(current) + suffix;
    }, 16);
}

// Observe hero stats for animation trigger
const statsObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const statItems = entry.target.querySelectorAll('.stat-item');

            statItems.forEach((item, index) => {
                setTimeout(() => {
                    const number = item.querySelector('div:first-child');
                    const text = number.textContent;

                    // Extract number and suffix
                    if (text.includes('FPS')) {
                        animateCounter(number, 30, 1500, ' FPS');
                    } else if (text.includes('%')) {
                        animateCounter(number, 95, 1500, '%+');
                    } else if (text.includes('Modes')) {
                        animateCounter(number, 5, 1500, ' Modes AI');
                    } else if (text.includes('Free')) {
                        number.textContent = '100% Free';
                        number.style.animation = 'pulse 2s ease-in-out infinite';
                    }
                }, index * 200);
            });

            statsObserver.unobserve(entry.target);
        }
    });
}, { threshold: 0.5 });

const heroStats = document.querySelector('.hero-stats');
if (heroStats) {
    statsObserver.observe(heroStats);
}

// ==============================================================
// 🎴 3D CARD TILT EFFECTS
// ==============================================================

document.querySelectorAll('.feature-card, .step').forEach(card => {
    card.addEventListener('mousemove', function(e) {
        const rect = this.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        const rotateX = (y - centerY) / 10;
        const rotateY = (centerX - x) / 10;

        this.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`;
        this.style.transition = 'none';
    });

    card.addEventListener('mouseleave', function() {
        this.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) scale3d(1, 1, 1)';
        this.style.transition = 'transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)';
    });
});

// ==============================================================
// ✨ SCROLL-DRIVEN TEXT REVEALS
// ==============================================================

// Add blur-to-sharp animation to section titles
const textRevealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.animation = 'blurToSharp 1s ease-out forwards';
            textRevealObserver.unobserve(entry.target);
        }
    });
}, { threshold: 0.3 });

document.querySelectorAll('h2, h1').forEach(heading => {
    heading.style.filter = 'blur(10px)';
    heading.style.opacity = '0';
    textRevealObserver.observe(heading);
});
