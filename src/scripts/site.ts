const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let cleanups: Array<() => void> = [];
let lastSetupUrl = '';

function addCleanup(fn: () => void) {
  cleanups.push(fn);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function updateScrollUi() {
  const header = document.querySelector<HTMLElement>('[data-header]');
  header?.classList.toggle('is-scrolled', window.scrollY > 8);

  const progress = document.querySelector<HTMLElement>('[data-reading-progress]');
  const article = document.querySelector<HTMLElement>('[data-article-body]');
  if (progress && article) {
    const articleTop = article.getBoundingClientRect().top + window.scrollY;
    const start = articleTop - window.innerHeight * 0.28;
    const end = articleTop + article.offsetHeight - window.innerHeight * 0.7;
    const amount = clamp((window.scrollY - start) / Math.max(end - start, 1), 0, 1);
    progress.style.transform = `scaleX(${amount})`;
  }
}

let ticking = false;
function requestScrollUpdate() {
  if (ticking) return;
  ticking = true;
  window.requestAnimationFrame(() => {
    updateScrollUi();
    ticking = false;
  });
}

window.addEventListener('scroll', requestScrollUpdate, { passive: true });
window.addEventListener('resize', requestScrollUpdate);

function setupReveal() {
  const elements = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'));
  if (!elements.length) return;

  if (reduceMotion || !('IntersectionObserver' in window)) {
    elements.forEach((element) => element.classList.add('is-visible'));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    },
    { rootMargin: '0px 0px -7% 0px', threshold: 0.05 },
  );

  elements.forEach((element) => {
    const rect = element.getBoundingClientRect();
    if (rect.top < window.innerHeight * 0.96) {
      requestAnimationFrame(() => element.classList.add('is-visible'));
    } else {
      observer.observe(element);
    }
  });

  addCleanup(() => observer.disconnect());
}

async function copyText(text: string) {
  if (!navigator.clipboard?.writeText) {
    throw new Error('Clipboard API unavailable');
  }

  await navigator.clipboard.writeText(text);
}

function setupCopyButtons() {
  const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-copy-link]'));

  buttons.forEach((button) => {
    let timer: number | undefined;

    const handler = async () => {
      const label = button.querySelector<HTMLElement>('[data-copy-label]');
      try {
        await copyText(button.dataset.copyLink || window.location.href);
        button.classList.add('is-copied');
        if (label) label.textContent = 'Copied';
      } catch {
        button.classList.add('is-copied');
        if (label) label.textContent = 'Copy failed';
      }

      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        button.classList.remove('is-copied');
        if (label) label.textContent = 'Copy link';
      }, 2200);
    };

    button.addEventListener('click', handler);
    addCleanup(() => {
      button.removeEventListener('click', handler);
      window.clearTimeout(timer);
    });
  });
}

function setupToc() {
  const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('[data-toc] a'));
  if (!links.length) return;

  const headings = links
    .map((link) => {
      const id = decodeURIComponent(link.hash.replace('#', ''));
      return document.getElementById(id);
    })
    .filter((heading): heading is HTMLElement => Boolean(heading));

  if (!headings.length) return;

  const setActive = (id: string) => {
    links.forEach((link) => {
      link.classList.toggle('is-active', link.hash === `#${id}`);
    });
  };

  const update = () => {
    const threshold = window.innerHeight * 0.34;
    let activeId = '';

    headings.forEach((heading) => {
      if (heading.getBoundingClientRect().top <= threshold) {
        activeId = heading.id;
      }
    });

    setActive(activeId);
  };

  let tocTicking = false;
  const requestTocUpdate = () => {
    if (tocTicking) return;
    tocTicking = true;
    window.requestAnimationFrame(() => {
      update();
      tocTicking = false;
    });
  };

  links.forEach((link) => {
    const handler = () => {
      setActive(decodeURIComponent(link.hash.replace('#', '')));
    };
    link.addEventListener('click', handler);
    addCleanup(() => link.removeEventListener('click', handler));
  });

  update();
  window.addEventListener('scroll', requestTocUpdate, { passive: true });
  window.addEventListener('resize', requestTocUpdate);
  addCleanup(() => {
    window.removeEventListener('scroll', requestTocUpdate);
    window.removeEventListener('resize', requestTocUpdate);
  });
}

function setupPage() {
  if (lastSetupUrl === window.location.href) return;
  lastSetupUrl = window.location.href;

  cleanups.forEach((cleanup) => cleanup());
  cleanups = [];

  setupReveal();
  setupCopyButtons();
  setupToc();
  updateScrollUi();
}

document.addEventListener('astro:page-load', setupPage);

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setupPage, { once: true });
} else {
  setupPage();
}
