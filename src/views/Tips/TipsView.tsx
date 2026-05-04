import { Link } from "react-router-dom";
import "./tips.css";

interface Tip {
  title: string;
  body: string;
  why: string;
}

/**
 * General lifestyle factors associated with blood-pressure management,
 * drawn from public guidance by the Australian Heart Foundation and the
 * National Health and Medical Research Council (NHMRC). Not medical advice;
 * not personalised; sources linked at the bottom of the page.
 */
const TIPS: Tip[] = [
  {
    title: "Trim sodium",
    body: "Aim for under 5 g of salt a day — roughly 2 g (2,000 mg) of sodium. The big sources in an Australian diet are bread, processed meat, sauces, takeaway, and packaged snacks; checking the per-100 g sodium on the Nutrition Information Panel is the fastest filter at the supermarket.",
    why: "Excess sodium pulls water into the bloodstream, which raises blood-vessel pressure.",
  },
  {
    title: "Bring potassium up",
    body: "Eat more bananas, sweet potato, spinach, beans, lentils, avocado, and dairy. Potassium acts as the counterweight to sodium — both matter, not just one.",
    why: "Potassium helps the body excrete excess sodium and relaxes blood-vessel walls.",
  },
  {
    title: "Build a DASH-style plate",
    body: "Half the plate vegetables and fruit, a quarter wholegrain (oats, brown rice, wholemeal pasta), a quarter lean protein (fish, chicken, legumes, tofu). Limit red meat to a few times a week and use unsaturated fats — olive oil, avocado, nuts.",
    why: "The DASH eating pattern is the most-studied diet for blood pressure; meta-analyses show systolic drops in the 5–11 mmHg range when followed consistently.",
  },
  {
    title: "Move most days",
    body: "Aim for 150 minutes of moderate-intensity activity a week — a brisk 30-minute walk five times, or 10-minute bouts spread through the day. Add some resistance training twice a week if you can.",
    why: "Regular aerobic activity reduces resting blood pressure by about 5–8 mmHg systolic over weeks to months.",
  },
  {
    title: "Watch alcohol",
    body: "NHMRC's 2020 guideline: no more than 10 standard drinks a week and no more than 4 in a day. Less is better for BP. Try alcohol-free days and smaller pours.",
    why: "Alcohol raises BP both acutely (in the hours after drinking) and chronically with regular heavy use.",
  },
  {
    title: "Sleep and stress",
    body: "Aim for 7–9 hours of sleep on a regular schedule. For stress, what works varies — 10 minutes of slow breathing, time outdoors, exercise, or talking with someone you trust are all reasonable starting points.",
    why: "Poor sleep and chronic stress both push average daily BP upwards via cortisol and sympathetic-nervous-system activity.",
  },
  {
    title: "Caffeine, briefly",
    body: "Most evidence suggests habitual moderate intake (2–3 cups of coffee a day) doesn't meaningfully raise long-term BP, but a fresh cup can spike a single reading by 10 mmHg or so for an hour. If you're measuring, hold off on coffee for at least 30 minutes first.",
    why: "Caffeine acutely tightens blood vessels in many people; the effect attenuates with regular use.",
  },
  {
    title: "Quit smoking, fully",
    body: "Every cigarette spikes BP for around 30 minutes. Long-term smoking damages artery walls in ways that cardiovascular risk factors compound. Quitline (13 78 48) is free.",
    why: "Smoking is one of the largest modifiable cardiovascular-risk factors; benefits start within weeks of stopping.",
  },
  {
    title: "Take medication as prescribed",
    body: "If your GP has prescribed BP medication, take it consistently and at the same time each day. Don't stop or change the dose without speaking to them, even if your readings look good — the readings often look good *because* the medication is working.",
    why: "Stopping antihypertensives often produces a rebound spike within days.",
  },
  {
    title: "Measure properly",
    body: "Sit quietly for five minutes first, feet flat on the floor, arm supported at heart height, no caffeine or smoking for 30 minutes prior. Take two or three readings a minute apart and use the average.",
    why: "Single readings are noisy; technique matters more than people think — a poorly-taken reading can be 10–15 mmHg off.",
  },
];

export default function TipsView() {
  return (
    <>
      <header className="view-header">
        <Link to="/" className="icon-btn" aria-label="Back to today">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
        <h1>Lifestyle tips</h1>
        <span style={{ width: 32 }} />
      </header>
      <div className="scroll-area">
        <section className="card tips-banner">
          <strong>General information, not medical advice.</strong>
          <p style={{ margin: "var(--sp-xs) 0 0", fontSize: "var(--fs-caption)" }}>
            Drawn from public guidance by the Australian Heart Foundation and the NHMRC.
            What's right for you depends on your history, medications, and goals — discuss any
            changes with your GP.
          </p>
        </section>

        {TIPS.map((tip) => (
          <article key={tip.title} className="card tips-card">
            <h2 className="tips-card__title">{tip.title}</h2>
            <p className="tips-card__body">{tip.body}</p>
            <p className="muted tips-card__why">
              <span className="tips-card__why-label">Why:</span> {tip.why}
            </p>
          </article>
        ))}

        <section className="tips-sources">
          <div className="section-label">Sources</div>
          <ul className="tips-sources__list">
            <li>
              <a href="https://www.heartfoundation.org.au/your-heart/blood-pressure" target="_blank" rel="noopener noreferrer">
                Heart Foundation Australia — Blood pressure
              </a>
            </li>
            <li>
              <a href="https://www.heartfoundation.org.au/healthy-living/healthy-eating" target="_blank" rel="noopener noreferrer">
                Heart Foundation Australia — Healthy eating
              </a>
            </li>
            <li>
              <a href="https://www.nhmrc.gov.au/health-advice/alcohol" target="_blank" rel="noopener noreferrer">
                NHMRC — Australian Guidelines to Reduce Health Risks from Drinking Alcohol
              </a>
            </li>
            <li>
              <a href="https://www.health.gov.au/topics/physical-activity-and-exercise/physical-activity-and-exercise-guidelines-for-all-australians" target="_blank" rel="noopener noreferrer">
                Australian Department of Health — Physical Activity and Exercise Guidelines
              </a>
            </li>
          </ul>
        </section>
      </div>
    </>
  );
}
