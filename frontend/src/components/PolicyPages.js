import React from "react";
import { Link } from "react-router-dom";
import { Header, Footer } from "./Layout";
import SeoHead from "./SeoHead";

const SOCIAL_LINKS = [
  { label: "YouTube", href: "https://youtube.com/@gruvora-channel?si=6s_wuVXVRfYp9K-M" },
  { label: "Instagram", href: "https://www.instagram.com/gruvora.com_?igsh=MTl5aHVxMTFscTgwZA==" },
  { label: "Facebook", href: "https://www.facebook.com/share/1BMsgoo66V/" },
  { label: "Email", href: "mailto:gruvora@gmail.com" },
];

const StaticDocPage = ({ title, effectiveDate, sections }) => {
  // SEO meta tags
  const canonicalUrl = `https://www.gruvora.com/${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}`;
  const description = `${title} for Gruvora Living. Read the latest policies, terms, and legal information.`;
  return (
    <div className="min-h-screen bg-stone-50" data-testid="policy-page">
      <SeoHead
        title={`${title} | Gruvora Living`}
        description={description}
        canonical={canonicalUrl}
        keywords={[title, "Gruvora", "policy", "legal", "terms", "privacy"]}
        og={[{
          property: "og:title",
          content: `${title} | Gruvora Living`
        }, {
          property: "og:description",
          content: description
        }, {
          property: "og:url",
          content: canonicalUrl
        }, {
          property: "og:type",
          content: "article"
        }]}
        twitter={[{
          name: "twitter:card",
          content: "summary_large_image"
        }, {
          name: "twitter:title",
          content: `${title} | Gruvora Living`
        }, {
          name: "twitter:description",
          content: description
        }]}
      />
      <Header />
      <main className="container-main py-8 md:py-12">
        <div className="max-w-4xl mx-auto bg-white rounded-2xl border border-stone-200 shadow-sm p-6 md:p-10">
          <h1 className="font-heading text-2xl md:text-4xl font-bold text-stone-900">{title}</h1>
          {effectiveDate ? (
            <p className="text-sm text-stone-500 mt-2">Effective Date: {effectiveDate}</p>
          ) : null}

          <div className="mt-6 space-y-8">
            {sections.map((section) => (
              <section key={section.heading} className="space-y-3">
                <h2 className="font-heading text-lg md:text-xl font-semibold text-stone-900">{section.heading}</h2>
                {section.paragraphs?.map((paragraph, index) => (
                  <p key={`${section.heading}-p-${index}`} className="text-stone-700 leading-relaxed">
                    {paragraph}
                  </p>
                ))}
                {section.bullets?.length ? (
                  <ul className="list-disc pl-5 space-y-1 text-stone-700">
                    {section.bullets.map((bullet) => (
                      <li key={bullet}>{bullet}</li>
                    ))}
                  </ul>
                ) : null}
              </section>
            ))}
          </div>

          <div className="mt-10 pt-6 border-t border-stone-200 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <Link to="/" className="text-primary hover:underline font-medium">
              Back to Home
            </Link>
            <div className="flex flex-wrap gap-3 text-sm">
              {SOCIAL_LINKS.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  target={item.href.startsWith("mailto:") ? undefined : "_blank"}
                  rel={item.href.startsWith("mailto:") ? undefined : "noreferrer"}
                  className="text-stone-600 hover:text-stone-900"
                >
                  {item.label}
                </a>
              ))}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export const TermsConditionsPage = () => (
  <StaticDocPage
    title="Terms & Conditions"
    effectiveDate="April 2026"
    sections={[
      {
        heading: "Welcome to GRUVORA LIVING",
        paragraphs: [
          "Welcome to GRUVORA LIVING : Your Home Bridge. These Terms & Conditions govern your access to and use of our platform, including our website, mobile application, and related services.",
          "By accessing, browsing, registering, or using GRUVORA LIVING, you acknowledge that you have read, understood, and agreed to be legally bound by these Terms & Conditions, our Privacy Policy, and all applicable laws and regulations.",
          "If you do not agree with these terms, you must discontinue use of the platform immediately.",
        ],
      },
      {
        heading: "1. Platform Overview",
        paragraphs: [
          "GRUVORA LIVING is a digital real estate and services marketplace designed to connect property owners, buyers, tenants, service providers, and customers through a secure and scalable SaaS platform.",
          "The platform facilitates discovery, communication, booking, and lead generation for the following categories:",
        ],
        bullets: [
          "Residential Properties (Flats, Apartments, Villas, PG, Houses for Rent / Sale)",
          "Commercial Properties (Shops, Offices, Warehouses, Industrial Spaces)",
          "Hospitality & Stay Services (Hotels, Guest Houses, Rooms, Vacation Stays)",
          "Event Venues (Marriage Halls, Party Plots, Banquet Halls, Farmhouses)",
          "Local Home Services (Plumber, Electrician, Painter, Cleaner, Carpenter, Movers)",
          "Owner & Builder Listing Management",
          "Verified Lead and Inquiry Management",
        ],
      },
      {
        heading: "2. Nature of Service",
        paragraphs: [
          "GRUVORA LIVING acts solely as an intermediary technology platform and does not directly own, control, verify, buy, sell, rent, or manage properties or services listed by users unless explicitly stated.",
          "We are not a broker, agent, contractor, financial institution, or legal advisor. Users are solely responsible for independent verification before entering into any transaction.",
        ],
      },
      {
        heading: "3. User Registration & Account Responsibility",
        paragraphs: [
          "To access premium features, users must create an account by providing accurate, complete, and updated information.",
        ],
        bullets: [
          "Full Name",
          "Email Address",
          "Mobile Number",
          "Address / Business Details",
          "Property Ownership or Service Information (where applicable)",
          "Identity verification documents (if requested)",
        ],
        paragraphs2: [
          "Users are fully responsible for maintaining the confidentiality of login credentials and for all activities conducted under their account.",
          "GRUVORA reserves the right to suspend, restrict, or permanently terminate accounts containing false, misleading, or fraudulent information.",
        ],
      },
      {
        heading: "4. Property Listings & Service Listings",
        paragraphs: [
          "Owners, agents, builders, and service providers must ensure that all listings published on the platform comply with legal, ethical, and platform standards.",
        ],
        bullets: [
          "All information provided must be accurate, lawful, and genuine",
          "Images, pricing, descriptions, and amenities must not be misleading",
          "The listed property/service must be legally available for rent, sale, booking, or service delivery",
          "No duplicate, fake, spam, or unauthorized listings are allowed",
          "Users must have legal authority to publish the listing",
        ],
      },
      {
        heading: "5. Payments, Bookings & Transactions",
        paragraphs: [
          "Certain features such as premium listings, booking confirmations, event reservations, and subscription plans may involve online payments through integrated payment gateways.",
          "GRUVORA LIVING is not responsible for disputes arising between users related to direct transactions unless the transaction is explicitly processed under our protected payment system.",
        ],
        bullets: [
          "Payment disputes",
          "Refund disagreements",
          "Booking cancellations",
          "Offline cash transactions",
          "Fraudulent external payment requests",
        ],
      },
      {
        heading: "6. User Responsibilities & Prohibited Activities",
        bullets: [
          "Posting false, misleading, or fraudulent information",
          "Harassing, threatening, or abusing other users",
          "Using the platform for illegal, unethical, or prohibited activities",
          "Uploading copyrighted or unauthorized content",
          "Attempting to hack, reverse engineer, or disrupt platform security",
          "Circumventing platform fees or payment systems",
          "Creating fake accounts or impersonating another person/business",
        ],
        paragraphs: [
          "Violation of these rules may result in immediate suspension, permanent account termination, legal action, and reporting to relevant authorities where necessary.",
        ],
      },
      {
        heading: "7. Verification & Trust Disclaimer",
        paragraphs: [
          "While GRUVORA LIVING may provide verification badges, identity checks, and quality controls, we do not guarantee the authenticity, ownership, legal validity, or quality of every listing, property, service provider, or user.",
          "Users must perform their own due diligence before making payments, bookings, agreements, or legal commitments.",
        ],
      },
      {
        heading: "8. Intellectual Property",
        paragraphs: [
          "All platform content including branding, logo, UI/UX, software systems, databases, designs, source architecture, and business workflows remain the exclusive intellectual property of GRUVORA LIVING unless otherwise stated.",
          "Unauthorized copying, resale, scraping, reverse engineering, or commercial misuse is strictly prohibited.",
        ],
      },
      {
        heading: "9. Privacy & Data Protection",
        paragraphs: [
          "User information is collected, processed, and protected according to the GRUVORA LIVING Privacy Policy and applicable data protection laws.",
          "We do not sell personal user data to third parties. However, certain operational data may be shared with payment processors, verification partners, and legal authorities where required.",
        ],
      },
      {
        heading: "10. Limitation of Liability",
        paragraphs: [
          "GRUVORA LIVING shall not be liable for any direct, indirect, incidental, legal, financial, or consequential damages arising from:",
        ],
        bullets: [
          "Property disputes",
          "Rental conflicts",
          "Ownership verification issues",
          "Construction or service quality disputes",
          "Fraud by third-party users",
          "Business loss or missed opportunities",
          "Technical downtime or temporary service interruptions",
        ],
      },
      {
        heading: "11. Modification of Terms",
        paragraphs: [
          "GRUVORA LIVING reserves the right to modify, update, or replace these Terms & Conditions at any time based on business, legal, regulatory, or operational requirements.",
          "Updated versions will be published on the platform with revised effective dates. Continued use of the platform constitutes acceptance of the revised terms.",
        ],
      },
      {
        heading: "12. Governing Law & Jurisdiction",
        paragraphs: [
          "These Terms & Conditions shall be governed by and interpreted in accordance with the laws of India.",
          "Any disputes arising from platform usage shall be subject to the exclusive jurisdiction of the competent courts of Gujarat, India.",
        ],
      },
      {
        heading: "13. Contact Information",
        paragraphs: [
          "For legal queries, compliance concerns, or support regarding these Terms & Conditions, please contact:",
          "Email: gruvora@gmail.com",
          "Platform: GRUVORA LIVING : Your Home Bridge",
          "By continuing to use GRUVORA LIVING, you confirm your acceptance of these Terms & Conditions.",
        ],
      },
    ]}
  />
);


export const PrivacyPolicyPage = () => (
  <StaticDocPage
    title="Privacy Policy"
    effectiveDate="April 2026"
    sections={[
      {
        heading: "Commitment",
        paragraphs: ["GRUVORA LIVING respects the privacy of its users and is committed to protecting personal information."],
      },
      {
        heading: "Information We Collect",
        paragraphs: ["When you use GRUVORA LIVING, we may collect:"],
        bullets: ["Name", "Email Address", "Phone Number", "Address", "Property or service details uploaded by users"],
      },
      {
        heading: "How We Use Information",
        bullets: [
          "Create and manage user accounts",
          "Display property and service listings",
          "Improve platform functionality",
          "Contact users regarding their listings",
        ],
      },
      {
        heading: "Data Protection",
        paragraphs: ["We take appropriate security measures to protect user information from unauthorized access or misuse."],
      },
      {
        heading: "Third Party Services",
        paragraphs: ["GRUVORA LIVING may use third-party services such as cloud hosting, analytics tools, and payment gateways. These services may have their own privacy policies."],
      },
      {
        heading: "Cookies",
        paragraphs: ["Our website may use cookies to enhance user experience and improve website performance."],
      },
      {
        heading: "Policy Updates",
        paragraphs: ["GRUVORA LIVING may update this Privacy Policy from time to time."],
      },
      {
        heading: "Contact",
        paragraphs: ["Email: gruvora@gmail.com"],
      },
    ]}
  />
);

export const RefundCancellationPage = () => (
  <StaticDocPage
    title="Refund & Cancellation Policy"
    effectiveDate="April 2026"
    sections={[
      {
        heading: "Listing Payments",
        paragraphs: ["If GRUVORA LIVING introduces paid listing or promotional services, the following policy will apply."],
      },
      {
        heading: "Cancellation",
        paragraphs: ["Users may cancel their listing or service promotion anytime from their dashboard."],
      },
      {
        heading: "Refund Policy",
        paragraphs: ["Payments made for featured listings and promotional advertisements are generally non-refundable once activated."],
        bullets: [
          "Refunds may be considered only if payment was deducted but service was not activated",
          "Refunds may be considered if technical errors occurred during payment",
        ],
      },
      {
        heading: "Processing Time",
        paragraphs: ["Approved refunds will be processed within 7-10 business days."],
      },
      {
        heading: "Contact",
        paragraphs: ["For refund related queries contact: gruvora@gmail.com"],
      },
    ]}
  />
);

export const DisclaimerPage = () => (
  <StaticDocPage
    title="Disclaimer"
    effectiveDate="April 2026"
    sections={[
      {
        heading: "Important Notice",
        paragraphs: [
          "GRUVORA LIVING is a digital platform that connects property owners, service providers, and users.",
          "We do not verify every listing and are not responsible for disputes between users.",
        ],
      },
    ]}
  />
);

export const AboutUsPage = () => (
  <StaticDocPage
    title="About Us"
    effectiveDate="April 2026"
    sections={[
      {
        heading: "Welcome to GRUVORA LIVING : Your Home Bridge",
        paragraphs: [
          "GRUVORA LIVING is a smart digital platform designed to connect people with the right homes, businesses, stays, event spaces, and local services in one place.",
          "Our goal is to make property search and local service discovery simple, fast, and reliable.",
        ],
      },
      {
        heading: "Our Vision",
        paragraphs: ["Our vision is to create a platform where anyone can easily find:"],
        bullets: [
          "Homes for rent or sale",
          "Business spaces like shops and offices",
          "Stay options such as hotels and guest houses",
          "Event venues like party plots and marriage halls",
          "Trusted local services like plumbers, electricians, cleaners, and painters",
          "All in one single platform.",
        ],
      },
      {
        heading: "What Makes GRUVORA LIVING Different",
        paragraphs: ["GRUVORA LIVING is built to simplify the process of finding properties and services by offering:"],
        bullets: [
          "Easy property listing for owners",
          "Smart search for users",
          "Multiple categories in one platform",
          "Direct connection between owners and users",
          "Our platform helps save time and provides more options in one place.",
        ],
      },
      {
        heading: "Our Mission",
        paragraphs: ["Our mission is to build a trusted and easy-to-use real estate and service marketplace that helps people find what they need quickly and efficiently."],
      },
      {
        heading: "Founder",
        paragraphs: ["GRUVORA LIVING was founded by Rahul Rathod with the vision of creating a modern digital platform that connects people with homes, businesses, and services."],
      },
      {
        heading: "Contact Us",
        paragraphs: ["For any queries or support, feel free to contact us: gruvora@gmail.com"],
      },
    ]}
  />
);

export const UserVerificationPolicyPage = () => (
  <StaticDocPage
    title="User Verification Policy"
    effectiveDate="April 2026"
    sections={[
      {
        heading: "Purpose",
        paragraphs: ["GRUVORA LIVING aims to create a safe and reliable platform for users, property owners, and service providers."],
      },
      {
        heading: "Account Verification",
        paragraphs: ["Users may be required to verify their account using:"],
        bullets: ["Email verification", "Mobile number verification (OTP)", "This helps ensure that only genuine users access the platform."],
      },
      {
        heading: "Listing Verification",
        paragraphs: ["Property owners and service providers must provide accurate information when listing:"],
        bullets: ["Property details", "Service details", "Contact information", "Images of property or service"],
      },
      {
        heading: "Fraud Prevention",
        paragraphs: ["To maintain platform safety, GRUVORA LIVING may:"],
        bullets: ["Suspend suspicious accounts", "Remove fake listings", "Restrict users who violate platform policies"],
      },
      {
        heading: "User Responsibility",
        paragraphs: [
          "Users should always verify property or service details before making any payment or agreement.",
          "GRUVORA LIVING acts as a digital platform connecting users and does not guarantee any transaction.",
        ],
      },
      {
        heading: "Contact",
        paragraphs: ["Email: gruvora@gmail.com"],
      },
    ]}
  />
);

export const CommunityGuidelinesPage = () => (
  <StaticDocPage
    title="Community Guidelines"
    effectiveDate="April 2026"
    sections={[
      {
        heading: "Commitment",
        paragraphs: ["GRUVORA LIVING is committed to maintaining a respectful and safe community for all users."],
      },
      {
        heading: "Respectful Communication",
        paragraphs: ["Users must interact respectfully with other users on the platform. Harassment, abusive language, or threats are strictly prohibited."],
      },
      {
        heading: "Accurate Listings",
        paragraphs: ["Users posting properties or services must provide:"],
        bullets: ["Genuine details", "Accurate images", "Correct pricing information", "Fake or misleading listings are not allowed."],
      },
      {
        heading: "Illegal Activities",
        paragraphs: ["Users are strictly prohibited from using GRUVORA LIVING for:"],
        bullets: ["Fraudulent activities", "Illegal property transactions", "Any activity that violates local laws"],
      },
      {
        heading: "Platform Safety",
        paragraphs: ["Users should avoid sharing sensitive personal information with unknown parties. Always verify property or service details before making any decision."],
      },
      {
        heading: "Policy Enforcement",
        paragraphs: ["GRUVORA LIVING reserves the right to:"],
        bullets: ["Remove listings", "Suspend accounts", "Block users violating community guidelines"],
      },
      {
        heading: "Contact",
        paragraphs: ["Email: gruvora@gmail.com"],
      },
    ]}
  />
);
