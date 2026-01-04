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
