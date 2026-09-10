import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata = {
  title: "Terms of Service",
  description: "Terms of Service and Customer Agreement for Founder Distribution OS.",
};

export default function TermsPage() {
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
        <h1 className="display text-3xl font-semibold mb-2">Terms of Service</h1>
        <p className="text-xs text-ink-faint mb-8">Operated by Secure Sense Innovations</p>

        <section className="space-y-6 text-sm text-ink-soft leading-relaxed">
          <div>
            <h2 className="text-lg font-semibold text-ink mt-8 mb-2">1. Agreement to Terms</h2>
            <p>
              By accessing or using Founder Distribution OS (“the Service”), provided by Secure Sense Innovations (“Company”, “we”, “us”, or “our”), you agree to be bound by these Terms of Service (“Terms”). If you do not agree, do not access or use the Service.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-ink mt-8 mb-2">2. Description of the Service</h2>
            <p>
              Founder Distribution OS provides software founders and teams with automated distribution intelligence, market signal monitoring, customer opportunity scoring, outreach drafts, and multichannel analytics. We offer free and paid subscription plans, as well as private beta trial periods.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-ink mt-8 mb-2">3. Accounts and Workspace Security</h2>
            <p>
              You must provide accurate, complete information when creating an account. You are responsible for maintaining the confidentiality of your login credentials and for all activities that occur under your account. You agree to notify us immediately at <span className="text-ink font-mono text-xs">support@founderdist-os.xyz</span> of any unauthorized use.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-ink mt-8 mb-2">4. Acceptable Use Policy</h2>
            <p>You agree not to use the Service to:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Engage in illegal spam, deceptive marketing, or unsolicited mass messaging that violates CAN-SPAM, GDPR, or platform policies (e.g. Reddit, Hacker News).</li>
              <li>Scrape, reverse engineer, or decompile any part of the Service without express written consent.</li>
              <li>Attempt to compromise system integrity, circumvent rate limits, bypass seat restrictions, or gain unauthorized access.</li>
              <li>Generate defamatory, abusive, or infringing content.</li>
            </ul>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-ink mt-8 mb-2">5. Subscriptions, Payments & Billing</h2>
            <p>
              Our order process and payment transactions are conducted through our Merchant of Record, <strong>Paddle.com</strong>. Paddle handles billing, invoicing, VAT/sales tax compliance, and payment processing. Paid plans (Maker, Growth, Pro) recur monthly unless canceled before the renewal date.
            </p>
            <p className="mt-2">
              Seat limits, opportunity quotas, and AI credit limits are determined by your chosen plan. Upgrading, downgrading, or canceling your subscription can be managed at any time in the <strong>Billing</strong> section of the app.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-ink mt-8 mb-2">6. Intellectual Property & Customer Data</h2>
            <p>
              You retain all ownership rights to your product details, workspace data, and customer records. Secure Sense Innovations retains all rights, title, and interest in the Service, software algorithms, scoring engine, user interface, and branding.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-ink mt-8 mb-2">7. Disclaimer of Warranties</h2>
            <p>
              The Service and AI-generated suggestions are provided on an “AS IS” and “AS AVAILABLE” basis. We do not warrant that opportunities surfaced will result in customer acquisition or revenue, nor do we guarantee uninterrupted or error-free operation.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-ink mt-8 mb-2">8. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by applicable law, in no event shall Secure Sense Innovations or its suppliers be liable for any indirect, punitive, incidental, or consequential damages arising out of your use or inability to use the Service.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-ink mt-8 mb-2">9. Governing Law & Contact</h2>
            <p>
              These Terms shall be governed by and construed in accordance with applicable commercial laws. For any legal inquiries or support, please contact us at <span className="text-ink font-mono text-xs">support@founderdist-os.xyz</span>.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}

