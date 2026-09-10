import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata = {
  title: "Privacy Policy",
  description: "Privacy Policy and Data Protection Notice for Founder Distribution OS.",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-paper text-ink selection:bg-accent selection:text-white">
      <header className="border-b border-paper-line bg-paper-raise">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-2 text-xs text-ink-mute hover:text-ink">
            <ArrowLeft size={14} /> Back to Founder Distribution OS
          </Link>
          <span className="text-2xs font-mono text-ink-faint">Effective Date: September 10, 2026</span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12 prose prose-invert prose-headings:tracking-tight prose-a:text-accent">
        <h1 className="display text-3xl font-semibold mb-2">Privacy Policy</h1>
        <p className="text-xs text-ink-faint mb-8">Operated by Secure Sense Innovations</p>

        <section className="space-y-6 text-sm text-ink-soft leading-relaxed">
          <div>
            <h2 className="text-lg font-semibold text-ink mt-8 mb-2">1. Overview</h2>
            <p>
              Secure Sense Innovations (“Company”, “we”, “us”, or “our”) respects your privacy and is committed to protecting the personal data of users who interact with Founder Distribution OS (“the Service”). This Privacy Policy explains what information we collect, how we process and store it, and your legal rights under GDPR, CCPA, and applicable data privacy regulations.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-ink mt-8 mb-2">2. Information We Collect</h2>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li><strong>Account Information:</strong> Name, email address, password hash, workspace name, and billing contact details.</li>
              <li><strong>Product & Strategy Information:</strong> Product name, website URL, target customer profile (ICP), keywords, and user-submitted feedback.</li>
              <li><strong>Technical Data:</strong> IP address, browser type, device information, operating system, and secure session cookies required for authentication.</li>
              <li><strong>Public Web Signals:</strong> For lead discovery, our platform processes publicly accessible internet discussions (e.g. public discussions on Hacker News or Reddit) solely to identify contextual business fit for your product.</li>
            </ul>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-ink mt-8 mb-2">3. How We Use Your Data</h2>
            <p>We process your data for the following purposes:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>To provide, operate, and maintain your workspace and team accounts.</li>
              <li>To compute distribution analytics, opportunity scores, and tailored outreach recommendations.</li>
              <li>To deliver transactional emails such as account confirmations, password resets, and critical service notifications.</li>
              <li>To prevent fraudulent signups, enforce rate limits, and ensure bot protection via Cloudflare Turnstile and Arcjet.</li>
              <li>To comply with tax, legal, and accounting requirements through our payment processor, Paddle.</li>
            </ul>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-ink mt-8 mb-2">4. Third-Party Service Providers</h2>
            <p>We partner with trusted subprocessors that adhere to strict data security and privacy standards:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li><strong>Paddle.com:</strong> Payment processing and Merchant of Record. Payment credentials are handled directly by Paddle; we never store raw credit card numbers.</li>
              <li><strong>Neon (PostgreSQL):</strong> Serverless cloud database with encryption at rest and in transit.</li>
              <li><strong>Resend:</strong> Transactional email dispatch.</li>
              <li><strong>Cloudflare & Arcjet:</strong> Security, bot mitigation, and DDoS/abuse prevention.</li>
              <li><strong>Sentry:</strong> Real-time application error logging and performance diagnostics.</li>
              <li><strong>Vercel:</strong> Cloud application hosting and content delivery.</li>
            </ul>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-ink mt-8 mb-2">5. Data Retention & Deletion</h2>
            <p>
              We retain your information as long as your account remains active. You may request account deletion, data export, or the removal of your personal information at any time by contacting us at <span className="text-ink font-mono text-xs">privacy@founderdist-os.xyz</span>. Upon account termination, all active sessions and proprietary workspace data are removed from production systems in accordance with standard database retention cycles.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-ink mt-8 mb-2">6. Your Rights</h2>
            <p>Depending on your location, you may have rights under GDPR or local privacy laws to:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Access, correct, or delete your personal data.</li>
              <li>Object to or restrict the processing of your data.</li>
              <li>Receive a portable copy of your data.</li>
              <li>Withdraw consent at any time where processing was based on consent.</li>
            </ul>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-ink mt-8 mb-2">7. Contact Us</h2>
            <p>
              If you have any questions or concerns regarding this Privacy Policy, please contact our privacy team at <span className="text-ink font-mono text-xs">privacy@founderdist-os.xyz</span> or <span className="text-ink font-mono text-xs">support@founderdist-os.xyz</span>.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}

