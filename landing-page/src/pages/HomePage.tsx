import { Hero } from '../components/Hero';
import { Statement, Features, Agents, Testimonials, FinalCta } from '../components/Sections';

export function HomePage({ onLogin }: { onLogin: () => void }) {
  return (
    <>
      <Hero onLogin={onLogin} />
      <Statement />
      <Features />
      <Agents />
      <Testimonials />
      <FinalCta />
    </>
  );
}
