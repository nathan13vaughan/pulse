import { useEffect, useRef, useState, type ReactNode } from "react";
import "./LargeTitlePage.css";

interface LargeTitlePageProps {
  title: string;
  /** Trailing action (e.g. + button). Renders next to the big title at rest. */
  trailing?: ReactNode;
  /** Optional leading content for the nav bar (e.g. back chevron). */
  leading?: ReactNode;
  children: ReactNode;
}

/**
 * iOS large-title page wrapper.
 *   - Sticky glass nav bar that stays mostly empty while you're at the top of
 *     the page; a small title fades in as you scroll past the hero title.
 *   - The big "hero" title sits at the top of the scroll content. If a
 *     trailing action is provided, it sits next to the title (iOS Calendar /
 *     Reminders pattern) — which keeps the nav bar from looking lonely.
 *
 * The hand-off between the hero title and the nav-bar title is driven by
 * IntersectionObserver — when the hero title rolls out of view, the nav-bar
 * title appears.
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
        <div className="nav-bar__trailing" aria-hidden />
      </header>
      <div className="scroll-area large-title-page__scroll">
        <div className="large-title-row">
          <h1 ref={heroRef} className="large-title">{title}</h1>
          {trailing ? <div className="large-title-row__trailing">{trailing}</div> : null}
        </div>
        {children}
      </div>
    </>
  );
}
