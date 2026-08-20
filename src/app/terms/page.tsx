import type { Metadata } from "next";
import Link from "next/link";
import { PolicyPage, PolicySection } from "@/app/_components/policy-page";

export const metadata: Metadata = {
  title: "Terms",
  description: "Terms for using the CherryK Korean learning service.",
};

export default function TermsPage() {
  return (
    <PolicyPage
      description="These terms describe the basic rules for using CherryK and the limits of its OCR, correction, and practice features."
      eyebrow="Using CherryK"
      title="Terms of Service"
    >
      <PolicySection title="Using the service">
        <p>
          CherryK provides Korean writing, handwriting OCR, correction, and
          reviewed practice tools. You may use the service only in compliance
          with applicable law and these terms. If you use CherryK for another
          person, you must have permission to submit their content.
        </p>
      </PolicySection>

      <PolicySection title="Your account">
        <p>
          You are responsible for access to your Google account and for activity
          performed through your CherryK session. Do not share or misuse another
          person&apos;s account. Contact us if you believe your account has been
          accessed without permission.
        </p>
      </PolicySection>

      <PolicySection title="Your content">
        <p>
          You keep any rights you have in text and images you submit. You give
          CherryK permission to process that content only as needed to provide,
          secure, and maintain the service as described in the{` `}
          <Link href={{ pathname: "/privacy" }}>Privacy Notice</Link>.
        </p>
        <p>
          Do not submit content you do not have the right to use, unlawful or
          harmful material, or highly sensitive information that is not needed
          for Korean learning.
        </p>
      </PolicySection>

      <PolicySection title="AI and OCR limitations">
        <p>
          OCR, corrections, explanations, and practice material can be
          incomplete or wrong. CherryK is a learning aid, not professional,
          legal, medical, or translation advice. Review important output before
          relying on it.
        </p>
      </PolicySection>

      <PolicySection title="Acceptable use">
        <p>You must not:</p>
        <ul>
          <li>
            interfere with or attempt to bypass service security or limits;
          </li>
          <li>use automated access that burdens or disrupts the service;</li>
          <li>
            probe for another user&apos;s account, session, or learning data;
          </li>
          <li>use CherryK to violate law or another person&apos;s rights.</li>
        </ul>
      </PolicySection>

      <PolicySection title="Availability and changes">
        <p>
          CherryK is an evolving service. Features may change, pause, or stop,
          and we do not guarantee uninterrupted availability. We may limit or
          suspend access when reasonably necessary to protect users, providers,
          or the service.
        </p>
      </PolicySection>

      <PolicySection title="Ending use">
        <p>
          You may stop using CherryK at any time and may request deletion of
          your account data. We may suspend or end access for a serious or
          repeated breach of these terms, subject to applicable law.
        </p>
      </PolicySection>

      <PolicySection title="Responsibility">
        <p>
          CherryK is provided on an as-available basis. To the extent permitted
          by law, CherryK is not responsible for indirect or unexpected loss
          caused by reliance on generated output, provider outages, or events
          outside reasonable control. Nothing in these terms limits rights that
          cannot legally be limited.
        </p>
      </PolicySection>

      <PolicySection title="Changes to these terms">
        <p>
          We may update these terms as the service changes. The effective date
          at the top of this page will be updated, and material changes will be
          communicated through the service when appropriate. Continuing to use
          CherryK after updated terms take effect means you accept them.
        </p>
      </PolicySection>

      <PolicySection title="Contact">
        <p>
          For questions about CherryK or these terms, email{` `}
          <a href="mailto:leekw1245@gmail.com">leekw1245@gmail.com</a>.
        </p>
      </PolicySection>
    </PolicyPage>
  );
}
