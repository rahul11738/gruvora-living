import React from "react";
import { Link } from "react-router-dom";
import { Header, Footer } from "./Layout";
import gruvoraLogo from "../assets/gruvoraLogo.jpeg";
import OptimizedImage from "./OptimizedImage";

const SOCIAL_LINKS = [
  { label: "YouTube", href: "https://youtube.com/@gruvora-channel?si=6s_wuVXVRfYp9K-M" },
  { label: "Instagram", href: "https://www.instagram.com/gruvora.com_?igsh=MTl5aHVxMTFscTgwZA==" },
  { label: "Facebook", href: "https://www.facebook.com/share/1BMsgoo66V/" },
  { label: "Email", href: "mailto:gruvora@gmail.com" },
];

const StaticDocPage = ({ title, effectiveDate, sections }) => {
  return (
    <div className="min-h-screen bg-stone-50" data-testid="policy-page">
      <Header />
      <main className="container-main py-8 md:py-12">
        <div className="max-w-4xl mx-auto bg-white rounded-2xl border border-stone-200 shadow-sm p-6 md:p-10">
          <OptimizedImage publicId={gruvoraLogo} alt="Gruvora" className="h-8 w-auto max-w-[180px] object-contain" width={180} sizes="180px" />
          <h1 className="font-heading text-2xl md:text-4xl font-bold text-stone-900 mt-2">{title}</h1>
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
        heading: "Welcome",
        paragraphs: [
          "Welcome to GRUVORA LIVING - Your Home Bridge. By accessing or using the GharSetu website and services, you agree to comply with these Terms and Conditions.",
        ],
      },
      {
        heading: "1. Platform Overview",
        paragraphs: ["GRUVORA LIVING is an online platform that allows users to list, search, and connect for:"],
        bullets: [
          "Residential Properties (Flats, PG, Houses - Rent / Sell)",
          "Commercial Properties (Shops, Offices, Warehouses)",
          "Stay Services (Hotels, Rooms, Guest Houses)",
          "Event Spaces (Party Plots, Marriage Halls)",
          "Local Services (Plumber, Electrician, Cleaning, Painter)",
          "GRUVORA LIVING acts only as a digital marketplace and does not directly own or sell properties.",
        ],
      },
      {
        heading: "2. User Registration",
        paragraphs: ["To use certain features of the platform, users must register and provide accurate information including:"],
        bullets: ["Name", "Email Address", "Phone Number", "Address", "Users are responsible for maintaining the confidentiality of their login credentials."],
      },
      {
        heading: "3. Property Listings",
        paragraphs: ["Owners and service providers must ensure the following while listing:"],
        bullets: [
          "All information provided is accurate and genuine",
          "Images and descriptions are not misleading",
          "The property or service is legally available",
          "GRUVORA reserves the right to remove any listing that violates these rules.",
        ],
      },
      {
        heading: "4. User Responsibilities",
        bullets: [
          "Do not post false or misleading information",
          "Do not use the platform for illegal activities",
          "Do not harass or misuse other users",
          "Any violation may result in account suspension or removal.",
        ],
      },
      {
        heading: "5. Platform Limitation",
        paragraphs: ["GRUVORA LIVING only provides a connection between users, property owners, and service providers. GRUVORA LIVING is not responsible for:"],
        bullets: ["Property disputes", "Payment disagreements", "Service quality issues", "Users must verify details before making any decision."],
      },
      {
        heading: "6. Privacy",
        paragraphs: ["User information is collected and used according to the GRUVORA LIVING Privacy Policy. We do not sell personal user data to third parties."],
      },
      {
        heading: "7. Changes to Terms",
        paragraphs: ["GRUVORA LIVING reserves the right to modify these Terms & Conditions at any time. Updated terms will be posted on the website."],
      },
      {
        heading: "8. Contact Information",
        paragraphs: [
          "For any queries regarding these Terms & Conditions, please contact: gruvora@gmail.com",
          "By using the GRUVORA LIVING platform, you acknowledge that you have read and agreed to these Terms & Conditions.",
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
        heading: "Welcome to GRUVORA LIVING - Your Home Bridge",
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
