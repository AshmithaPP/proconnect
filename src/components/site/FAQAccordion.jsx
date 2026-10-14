'use client';

import React, { useState } from 'react';
import { ChevronDownIcon } from '@/components/ui/Icons';

const faqs = [
  {
    question: 'What types of businesses do you work with?',
    answer:
      'I work with businesses seeking to improve their sales strategy, processes, or execution. The right approach depends on your business needs.',
  },
  {
    question: 'What sales services do you provide?',
    answer:
      'Services may include sales strategy development, sales process improvement, lead conversion, and sales execution support, depending on the agreed scope.',
  },
  {
    question: 'Do you work with existing sales teams?',
    answer:
      "Yes, where relevant, sales support can be tailored to your team's current structure and requirements.",
  },
  {
    question: 'How do we get started?',
    answer:
      'Book a business sales consultation to discuss your goals, challenges, and potential next steps.',
  },
  {
    question: 'Are your services customized?',
    answer:
      'Yes. The scope of work and recommendations are based on your business situation and requirements.',
  },
];

export default function FAQAccordion() {
  const [openIndex, setOpenIndex] = useState(0); // First item open by default like original

  const toggleFAQ = (index) => {
    setOpenIndex(openIndex === index ? -1 : index);
  };

  return (
    <section className="sec-pad" id="faq" style={{ background: 'var(--color-surface-alt)' }}>
      <div className="container">
        <div className="section-head reveal">
          <span className="eyebrow">FAQ</span>
          <h2>
            Frequently Asked <span className="orange">Questions</span>
          </h2>
        </div>

        <div className="faq-wrap">
          <div className="faq-list reveal d1">
            {faqs.map((faq, idx) => {
              const isOpen = openIndex === idx;
              return (
                <div className="accordion-item" key={idx}>
                  <h2>
                    <button
                      type="button"
                      className={`accordion-button ${isOpen ? 'active' : ''}`}
                      onClick={() => toggleFAQ(idx)}
                      aria-expanded={isOpen}
                      aria-controls={`faq-answer-${idx}`}
                    >
                      <span>{faq.question}</span>
                      <ChevronDownIcon className="accordion-icon" />
                    </button>
                  </h2>
                  {isOpen && (
                    <div id={`faq-answer-${idx}`} className="accordion-body">
                      {faq.answer}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
