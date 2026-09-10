import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata = {
  title: "Refund Policy",
  description: "Cancellation and Refund Policy for Founder Distribution OS subscriptions and credits.",
};

export default function RefundPolicyPage() {
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
        <h1 className="display text-3xl font-semibold mb-2">Cancellation & Refund Policy</h1>
        <p className="text-xs text-ink-faint mb-8">Operated by Secure Sense Innovations · Processed by Paddle.com</p>

        <section className="space-y-6 text-sm text-ink-soft leading-relaxed">
          <div>
            <h2 className="text-lg font-semibold text-ink mt-8 mb-2">1. 14-Day Money-Back Guarantee</h2>
            <p>
              We want you to be completely satisfied with Founder Distribution OS. If you purchase any paid subscription plan (Maker, Growth, or Pro) and decide within <strong>14 days of your initial purchase</strong> that the platform does not meet your business needs, you are eligible for a full, no-questions-asked refund.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-ink mt-8 mb-2">2. Subscription Cancellations</h2>
            <p>
              You can cancel your subscription at any time directly through the <strong>Billing</strong> section inside your workspace dashboard, or through your Paddle customer portal link provided on your receipt.
            </p>
            <p className="mt-2">
              Upon cancellation, your subscription will remain active until the end of your current paid billing period. You will not be charged again. After the period concludes, your workspace will automatically transition to the Free plan, preserving your historical data and existing setup.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-ink mt-8 mb-2">3. How to Request a Refund</h2>
            <p>To request a refund within the 14-day window:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Send an email to <span className="text-ink font-mono text-xs">support@founderdist-os.xyz</span> with the subject line <strong>“Refund Request”</strong>.</li>
              <li>Include your account email address and your Paddle order/transaction ID (found on your payment receipt email).</li>
              <li>Our support team will process your request within 1–2 business days. Refunds will be issued back to your original payment method via Paddle.</li>
            </ul>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-ink mt-8 mb-2">4. AI Credits & Usage Packs</h2>
            <p>
              One-off usage credit packs ($1 per 20 credits) that have already been consumed by AI analysis, deep scraping, or strategist queries are generally non-refundable once utilized. Unused credit packs may be refunded upon request within 14 days of purchase.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-ink mt-8 mb-2">5. Merchant of Record Contact</h2>
            <p>
              Because Paddle.com is the Merchant of Record for all our orders, you may also reach Paddle’s buyer support directly at <a href="https://paddle.net" target="_blank" rel="noopener noreferrer" className="text-accent underline">paddle.net</a> for invoice retrieval, payment receipts, and billing queries.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}

