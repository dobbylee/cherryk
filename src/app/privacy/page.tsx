import type { Metadata } from "next";
import { PolicyPage, PolicySection } from "@/app/_components/policy-page";

export const metadata: Metadata = {
  title: "Privacy",
  description: "How CherryK handles account and learning data.",
};

export default function PrivacyPage() {
  return (
    <PolicyPage
      description="This notice explains what CherryK processes when you sign in, use handwriting OCR, request a correction, or practice a quiz."
      eyebrow="Your data"
      title="Privacy Notice"
    >
      <PolicySection title="Who is responsible">
        <p>
          CherryK is responsible for the personal data described in this notice.
          For privacy questions or requests to access, correct, or delete your
          data, contact CherryK privacy support at{` `}
          <a href="mailto:leekw1245@gmail.com">leekw1245@gmail.com</a>.
        </p>
      </PolicySection>

      <PolicySection title="What we collect">
        <ul>
          <li>
            <strong>Account data:</strong> your Google account identifier,
            display name, email address, email verification status, profile
            image, and the information needed to maintain your signed-in
            session.
          </li>
          <li>
            <strong>Learning content:</strong> Korean text you type or confirm
            after OCR, correction results and explanations, identified learning
            tags, and quiz answers and progress.
          </li>
          <li>
            <strong>Service usage:</strong> daily correction and OCR usage
            counts, plus anonymous website analytics such as the page, referrer,
            country, device type, operating system, and browser.
          </li>
        </ul>
      </PolicySection>

      <PolicySection title="Why we process it">
        <p>
          We process this information to authenticate your account, provide the
          OCR or correction you request, show reviewed practice, remember
          learning progress, enforce usage limits, secure the service, and
          understand aggregate website reliability and use. We do not sell your
          personal data.
        </p>
      </PolicySection>

      <PolicySection title="Google sign-in and domestic processing">
        <p>
          Google handles the sign-in flow and, with your approval, returns the
          account information listed above to CherryK. Google processes the
          sign-in interaction under its own{` `}
          <a href="https://policies.google.com/privacy">Privacy Policy</a>.
        </p>
        <dl className="policy-details">
          <div>
            <dt>Oracle Corporation · Chuncheon, South Korea</dt>
            <dd>
              <strong>Purpose and data:</strong> Oracle Cloud Infrastructure
              hosts CherryK&apos;s Nginx, Spring backend, and PostgreSQL
              database. Each authentication or API request can include account
              claims, session cookies, IP and request metadata, OCR images,
              correction text, or quiz requests. PostgreSQL stores account,
              identity, session, correction, quiz, learning-progress, and usage
              records.
            </dd>
            <dd>
              <strong>Timing and method:</strong> each authentication and API
              request, forwarded by Vercel over HTTPS to OCI Chuncheon.
            </dd>
            <dd>
              <strong>Retention:</strong> request content is processed in memory
              and is not included in ordinary logs. Nginx and OCI security
              access metadata such as IP, path, time, status, and user agent is
              retained for no more than 30 days. Root-only PostgreSQL logical
              backups are retained on OCI for no more than 7 days and are not
              used for ordinary processing.
            </dd>
            <dd>
              <strong>Contact:</strong> Oracle Korea privacy representative,
              {` `}
              <a href="mailto:privacy_kr_grp@oracle.com">
                privacy_kr_grp@oracle.com
              </a>
              , 02-2194-8000
            </dd>
          </div>

          <div>
            <dt>NAVER Cloud CLOVA OCR · South Korea</dt>
            <dd>
              <strong>Purpose and data:</strong> handwriting image recognition
              using the normalized image you choose to upload.
            </dd>
            <dd>
              <strong>Timing and method:</strong> each OCR request, over HTTPS
              to the CLOVA OCR Korea region.
            </dd>
            <dd>
              <strong>Retention:</strong> CherryK does not persist the original
              image. CLOVA states that it does not store or use the image or
              recognition result after processing and retains only minimal
              access records for billing. The extracted draft remains editable,
              and only text you confirm and submit for correction is stored with
              the result.
            </dd>
          </div>
        </dl>
      </PolicySection>

      <PolicySection title="Overseas processing and storage">
        <p>
          The following transfers are necessary to provide the requested service
          or operate CherryK. Data is sent through encrypted connections when
          you use the relevant feature.
        </p>
        <dl className="policy-details">
          <div>
            <dt>OpenAI OpCo, LLC · United States</dt>
            <dd>
              <strong>Purpose and data:</strong> Korean text, learner level, and
              generated correction output for a correction you request.
            </dd>
            <dd>
              <strong>Timing and method:</strong> each correction request, over
              HTTPS to the OpenAI Responses API.
            </dd>
            <dd>
              <strong>Retention:</strong> CherryK sends{` `}
              <code>store: false</code>, so no Responses application state is
              kept. OpenAI may retain content in abuse-monitoring logs for up to
              30 days, or longer when legally required. API data is not used to
              train models by default.
            </dd>
            <dd>
              <strong>Contact:</strong>
              {` `}
              <a href="mailto:privacy@openai.com">privacy@openai.com</a>
            </dd>
          </div>

          <div>
            <dt>Vercel Inc. · United States and global edge locations</dt>
            <dd>
              <strong>Purpose and data:</strong> frontend delivery and
              same-origin routing to the CherryK backend. Vercel transiently
              handles request IP, headers, path, session cookie, and request
              content such as correction text or an OCR image. Anonymous
              analytics use page, referrer, country, device, OS, browser, and
              event time and are not linked to your CherryK account or IP
              address.
            </dd>
            <dd>
              <strong>Timing and method:</strong> on page requests and
              navigation, over HTTPS.
            </dd>
            <dd>
              <strong>Retention:</strong> request bodies are processed in
              transit and CherryK does not intentionally log them on Vercel.
              Vercel runtime request metadata is retained for no more than 30
              days, depending on the active plan. The analytics visitor
              identifier is discarded after 24 hours; anonymous aggregate
              metrics remain for the plan&apos;s reporting window.
            </dd>
            <dd>
              <strong>Contact:</strong>
              {` `}
              <a href="mailto:privacy@vercel.com">privacy@vercel.com</a>
            </dd>
          </div>
        </dl>
      </PolicySection>

      <PolicySection title="How long we keep data">
        <ul>
          <li>
            <strong>Sessions:</strong> 90 days after the last activity, unless
            you sign out earlier.
          </li>
          <li>
            <strong>Account and learning records:</strong> until a verified
            account-deletion request is completed.
          </li>
          <li>
            <strong>OCR originals:</strong> processed in memory for the request
            and not retained by CherryK or CLOVA after the response.
          </li>
          <li>
            <strong>Provider and backup data:</strong> for the periods stated in
            this notice.
          </li>
        </ul>
        <p>
          If law requires a record to be retained longer, we keep only the
          required data for that statutory period and do not use it for another
          purpose.
        </p>
      </PolicySection>

      <PolicySection title="Deletion and destruction">
        <p>
          Send a request to the privacy contact above. After verifying control
          of the account, CherryK completes a valid request within 30 days by
          permanently deleting the account and linked learning records from the
          active database. Provider-side records expire within the periods
          stated above. OCI backup data is isolated from ordinary use, expires
          within 7 days, and is not restored except for disaster recovery or a
          legal requirement.
        </p>
      </PolicySection>

      <PolicySection title="Your choices and rights">
        <p>
          You may request access to, correction of, deletion of, or restriction
          on your personal data, and may raise a question about how it is
          handled. Some requests require account verification.
        </p>
        <ul>
          <li>
            You can avoid CLOVA processing by entering text instead of uploading
            an image.
          </li>
          <li>
            You can avoid OpenAI processing by not submitting text for
            correction; CherryK cannot provide an AI correction without it.
          </li>
          <li>
            Browser controls may block Vercel Analytics without affecting core
            learning features.
          </li>
          <li>
            OCI PostgreSQL storage is required for signed-in accounts and saved
            learning records; refusing it means CherryK cannot provide those
            features.
          </li>
        </ul>
      </PolicySection>

      <PolicySection title="Security">
        <p>
          We use access controls, secure session cookies, encrypted network
          connections, and restricted provider credentials. No online service
          can guarantee absolute security, but we limit access to what is needed
          to operate CherryK.
        </p>
      </PolicySection>

      <PolicySection title="Changes to this notice">
        <p>
          We may update this notice when CherryK changes. The effective date at
          the top of this page will be updated, and material changes will be
          communicated through the service when appropriate.
        </p>
      </PolicySection>
    </PolicyPage>
  );
}
