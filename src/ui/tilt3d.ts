/**
 * Interactive 3D Parallax Tilt & Dynamic Spotlight Refraction
 * Enhances cards with smooth 3D perspective transforms and liquid glass light tracking.
 */

export function init3DCardTilt(): void {
  const cards = document.querySelectorAll<HTMLElement>('.card, .alert-card-hero, .race-timer-hero');

  cards.forEach((card) => {
    // Avoid double binding
    if (card.dataset.tilt3dInitialized) return;
    card.dataset.tilt3dInitialized = 'true';

    card.style.transformStyle = 'preserve-3d';
    card.style.transition = 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s cubic-bezier(0.16, 1, 0.3, 1)';

    const onMouseMove = (e: MouseEvent) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      // Calculate tilt angles (subtle & premium: max 6 degrees)
      const rotateX = ((y - centerY) / centerY) * -5.5;
      const rotateY = ((x - centerX) / centerX) * 5.5;

      card.style.transform = `perspective(1000px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) scale3d(1.012, 1.012, 1.012)`;

      // Dynamic liquid glass spotlight highlight
      card.style.setProperty('--mouse-x', `${x}px`);
      card.style.setProperty('--mouse-y', `${y}px`);
    };

    const onMouseLeave = () => {
      card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';
    };

    card.addEventListener('mousemove', onMouseMove);
    card.addEventListener('mouseleave', onMouseLeave);
  });
}
