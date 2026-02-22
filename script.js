document.addEventListener('DOMContentLoaded', () => {

    // Navbar scroll effect
    const navbar = document.querySelector('.navbar');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    });

    // Intersection Observer for Scroll Animations
    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.15
    };

    const animateOnScroll = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('is-visible');
                // Optional: Stop observing once it's visible so it doesn't animate out and back in
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    // Find all animated elements
    const elementsToAnimate = document.querySelectorAll('.scroll-fade-up, .scroll-slide-left, .scroll-slide-right');
    elementsToAnimate.forEach(el => {
        animateOnScroll.observe(el);
    });

    // --- Feature: FB Test Event Code Integration ---
    // Automatically pull 'test_event_code' from the URL (e.g. ?test_event_code=TEST64477)
    const urlParams = new URLSearchParams(window.location.search);
    const fbTestCodeFromUrl = urlParams.get('test_event_code');
    if (fbTestCodeFromUrl) {
        document.getElementById('fbTestCode').value = fbTestCodeFromUrl;
    }

    // Form Submission
    const contactForm = document.getElementById('contactForm');
    const formSuccess = document.getElementById('formSuccess');
    const submitBtn = document.getElementById('submitBtn');

    if (contactForm) {
        contactForm.addEventListener('submit', (e) => {
            e.preventDefault(); // Prevent page reload

            // Simple validation feedback state
            const originalBtnText = submitBtn.textContent;
            submitBtn.textContent = 'Sending...';
            submitBtn.disabled = true;

            // Send POST request to backend
            const formData = new FormData(contactForm);
            const data = Object.fromEntries(formData.entries());

            fetch('/api/waitlist', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            })
                .then(res => res.json())
                .then(resData => {
                    contactForm.reset();
                    submitBtn.textContent = originalBtnText;
                    submitBtn.disabled = false;

                    if (resData.success) {
                        // Show success message
                        formSuccess.classList.remove('hidden');

                        // Hide after 5 seconds
                        setTimeout(() => {
                            formSuccess.classList.add('hidden');
                        }, 5000);
                    } else {
                        alert('Error: ' + resData.error);
                    }
                })
                .catch(err => {
                    console.error("Fetch error:", err);
                    submitBtn.textContent = originalBtnText;
                    submitBtn.disabled = false;
                    alert('Something went wrong. Please try again.');
                });
        });
    }

    // --- A/B TESTING LOGIC for Hero Headline ---
    const heroHeadline = document.getElementById('ab-hero-headline');
    const hiddenHeadlineInput = document.getElementById('abHeadlineAssigned');

    // Define our 3 variations
    const headlineVariations = [
        "Peace of Mind While You're Away.", // Control (A)
        "Don't Let a $50 Leak Cost You $50,000.", // Financial focus (B)
        "Your Florida Home, Watched By Professionals." // Trust focus (C)
    ];

    if (heroHeadline && hiddenHeadlineInput) {
        // Check if user already has an assigned variation to keep it consistent on reload
        let assignedHeadline = localStorage.getItem('abTestHeadline');

        if (!assignedHeadline || !headlineVariations.includes(assignedHeadline)) {
            // Randomly select one of the 3 variations (0, 1, or 2)
            const randomIndex = Math.floor(Math.random() * headlineVariations.length);
            assignedHeadline = headlineVariations[randomIndex];

            // Store it so they see the same one if they refresh
            localStorage.setItem('abTestHeadline', assignedHeadline);
        }

        // Apply headline to the DOM
        heroHeadline.textContent = assignedHeadline;

        // Inject the assigned headline into the hidden form input
        hiddenHeadlineInput.value = assignedHeadline;
    }
});
