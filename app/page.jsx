import React from 'react';
import ScrollReveal from '@/components/home/ScrollReveal';
import AttentionBar from '@/components/home/AttentionBar';
import Hero from '@/components/home/Hero';
import OutcomesTimeline from '@/components/home/OutcomesTimeline';
import WhyWorkWithMe from '@/components/home/WhyWorkWithMe';
import BeforeAfter from '@/components/home/BeforeAfter';
import CoachSection from '@/components/home/CoachSection';
import PortfolioStats from '@/components/home/PortfolioStats';
import Guarantee from '@/components/home/Guarantee';
import CoreServices from '@/components/home/CoreServices';
import Testimonials from '@/components/home/Testimonials';
import FAQAccordion from '@/components/home/FAQAccordion';
import FinalCTA from '@/components/home/FinalCTA';
import ConsultationBooking from '@/components/home/booking/ConsultationBooking';
import Footer from '@/components/home/Footer';

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
