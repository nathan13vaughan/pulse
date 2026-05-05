import { useEffect, useRef, useState, type ReactNode } from "react";
import "./LargeTitlePage.css";

interface LargeTitlePageProps {
  title: string;
  /** Right-side content for the nav bar (e.g. + button). Always visible. */
  trailing?: ReactNode;
  /** Left-side content for the nav bar (e.g. back chevron). Always visible. */
  leading?: ReactNode;
  children: ReactNode;
}

/**
 * iOS large-title page wrapper. Pattern:
 *   - A sticky-top, glass-blur nav bar that initially shows only the
 *     trailing/leading actions; the small title fades in as you scroll past
 *     the big title below.
 *   - The big "hero" title lives at the top of the scroll content and scrolls
 *     away naturally with the rest of the page.
 *
 * Hand-off between the two titles is driven by IntersectionObserver — when the
 * hero title rolls out of view, the nav-bar title appears. Smooth, GPU-cheap.
 */
export function LargeTitlePage({ title, trailing, leading, children }: LargeTitlePageProps) {
  const [titleVisible, setTitleVisible] = useState(true);
  const heroRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const el = heroRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setTitleVisible(entry?.isIntersecting ?? true),
      { threshold: 0, rootMargin: "-20px 0px 0px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const navBarHidden = titleVisible;

  return (
    <>
      <header className={`nav-bar ${navBarHidden ? "" : "nav-bar--scrolled"}`}>
        <div className="nav-bar__leading">{leading}</div>
        <h2 className={`nav-bar__title ${navBarHidden ? "" : "nav-bar__title--visible"}`}>{title}</h2>
        <div className="nav-bar__trailing">{trailing}</div>
      </header>
      <div className="scroll-area large-title-page__scroll">
        <h1 ref={heroRef} className="large-title">{title}</h1>
        {children}
      </div>
    </>
  );
}
