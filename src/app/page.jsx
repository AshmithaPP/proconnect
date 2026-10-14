import React from 'react';
import ScrollReveal from '@/components/site/ScrollReveal';
import AttentionBar from '@/components/site/AttentionBar';
import Hero from '@/components/site/Hero';
import OutcomesTimeline from '@/components/site/OutcomesTimeline';
import WhyWorkWithMe from '@/components/site/WhyWorkWithMe';
import BeforeAfter from '@/components/site/BeforeAfter';
import CoachSection from '@/components/site/CoachSection';
import PortfolioStats from '@/components/site/PortfolioStats';
import Guarantee from '@/components/site/Guarantee';
import CoreServices from '@/components/site/CoreServices';
import Testimonials from '@/components/site/Testimonials';
import FAQAccordion from '@/components/site/FAQAccordion';
import FinalCTA from '@/components/site/FinalCTA';
import ConsultationBooking from '@/features/booking/components/ConsultationBooking';
import Footer from '@/components/site/Footer';

export default function HomePage() {
  return (
    <main>
      <ScrollReveal />
      <AttentionBar />
      <Hero />
      <OutcomesTimeline />
      <WhyWorkWithMe />
      <BeforeAfter />
      <CoachSection />
      <PortfolioStats />
      <Guarantee />
      <CoreServices />
      <Testimonials />
      <FAQAccordion />
      <FinalCTA />
      <ConsultationBooking />
      <Footer />
    </main>
  );
}
