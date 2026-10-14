import React from 'react';
import { XIcon, CheckIcon } from '@/components/ui/Icons';

export default function BeforeAfter() {
  return (
    <section className="sec-pad" style={{ background: 'var(--color-surface-alt)' }}>
      <div className="container">
        <div className="section-head reveal">
          <span className="eyebrow">The Shift</span>
          <h2>
            How Business Looks <span className="orange">Before and After</span>
          </h2>
        </div>

        <div className="ba-wrap reveal d1">
          <div className="ba-col ba-before">
            <span className="ba-lbl">Before</span>
            <ul>
              <li>
                <span className="ic">
                  <XIcon />
                </span>{' '}
                Leads come in but don&apos;t convert
              </li>
              <li>
                <span className="ic">
                  <XIcon />
                </span>{' '}
                Sales conversations feel unstructured
              </li>
              <li>
                <span className="ic">
                  <XIcon />
                </span>{' '}
                Follow-ups depend on memory
              </li>
              <li>
                <span className="ic">
                  <XIcon />
                </span>{' '}
                Closing feels like guesswork
              </li>
              <li>
                <span className="ic">
                  <XIcon />
                </span>{' '}
                No clear picture of what&apos;s failing
              </li>
            </ul>
          </div>

          <div className="ba-col ba-after">
            <span className="ba-lbl">After</span>
            <ul>
              <li>
                <span className="ic">
                  <CheckIcon />
                </span>{' '}
                Higher lead-to-customer conversion
              </li>
              <li>
                <span className="ic">
                  <CheckIcon />
                </span>{' '}
                Structured sales conversations
              </li>
              <li>
                <span className="ic">
                  <CheckIcon />
                </span>{' '}
                Repeatable follow-up process
              </li>
              <li>
                <span className="ic">
                  <CheckIcon />
                </span>{' '}
                Confident closing approach
              </li>
              <li>
                <span className="ic">
                  <CheckIcon />
                </span>{' '}
                Clear visibility into sales gaps
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
