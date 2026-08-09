# SOB Autofix Limited — Full Codex Architecture & Implementation Specification

> **Project type:** UK automotive diagnostics, repair, servicing, mobile mechanic and vehicle sales website  
> **Primary location:** Norton, Doncaster  
> **Primary objective:** Generate qualified repair bookings, diagnostic enquiries, vehicle-sales leads and local organic traffic  
> **Booking system:** Calendly  
> **Vehicle identification:** UK vehicle registration lookup  
> **SEO priority:** Very high  
> **MOT services:** Completely excluded from the website  
> **Primary brand direction:** Electric blue + deep navy + metallic white/silver

---

# 1. Project Objective

Build a premium, modern, mobile-first and heavily SEO-optimised automotive website for **SOB Autofix Limited**.

The website should position SOB Autofix primarily as a:

1. Professional vehicle diagnostics specialist
2. Automotive electrical fault-finding specialist
3. Mobile mechanic
4. Mechanical repair and servicing provider
5. Vehicle inspection provider
6. Vehicle recovery provider
7. Vehicle sales business

The finished website must feel substantially more polished, trustworthy, technically capable and conversion-focused than a generic independent-garage website.

The core brand proposition is:

> **Professional Diagnostics. Not Guesswork.**

Supporting line:

> **Automotive Diagnosis, Repair & Sales**

The central customer promise is:

> **Diagnose first. Repair second.**

The website should communicate that SOB Autofix uses systematic testing and professional diagnostic equipment to identify the underlying cause of faults before recommending parts replacement or repair work.

---

# 2. Business Information

Use a single configuration source for all business information.

```ts
export const siteConfig = {
  name: "SOB Autofix",
  legalName: "SOB Autofix Limited",

  tagline: "Professional Diagnostics. Not Guesswork.",
  supportingLine: "Automotive Diagnosis, Repair & Sales",

  companyNumber: "16182532",

  phone: "07469273483",
  whatsapp: "07468273483",

  email: "sobautofix@gmail.com",

  address: {
    building: "Cumbrae",
    street: "Station Road",
    town: "Norton",
    city: "Doncaster",
    postcode: "DN6 9HF",
    country: "United Kingdom",
    countryCode: "GB",
  },

  openingHours: {
    monday: "24 Hours",
    tuesday: "24 Hours",
    wednesday: "24 Hours",
    thursday: "24 Hours",
    friday: "24 Hours",
    saturday: "24 Hours",
    sunday: "24 Hours",
    bankHolidays: "24 Hours",
  },

  yearsInBusiness: 4,

  accreditations: [
    "NABTEB",
    "Automotive Service Management Certificate",
  ],

  calendlyUrl: process.env.NEXT_PUBLIC_CALENDLY_URL,
  googleMapsUrl: null,
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
}
```

Do not hardcode contact information, business name, address, hours or social links throughout components.

---

# 3. Information Requiring Client Confirmation

Do not invent these values.

## 3.1 Phone vs WhatsApp

The supplied numbers are:

```text
Phone:    07469 273483
WhatsApp: 07468 273483
```

They are different.

Keep them separate until the client confirms whether this is intentional.

## 3.2 Google Maps

The client supplied the business name but no actual Google Maps URL.

Keep:

```ts
googleMapsUrl: null
```

until confirmed.

## 3.3 Domain

No domain has been selected.

Use:

```env
NEXT_PUBLIC_SITE_URL=
```

until the production domain is confirmed.

## 3.4 Workshop Media

Workshop photographs will be supplied later.

Do not publish fake workshop photos.

## 3.5 Before/After Media

Before-and-after photography will be supplied later.

Build support for it but keep unavailable categories hidden.

## 3.6 Videos

Video content will be supplied later.

Build the gallery architecture to support video.

## 3.7 Team Photos

None are currently available.

Do not use fake technician portraits.

## 3.8 Pricing

The client wants pricing shown as ranges.

Do not invent prices.

## 3.9 Vehicle Sales Inventory

Inventory details, vehicle photos, warranty wording and finance-provider details still need to be supplied.

---

# 4. Critical Business Rule — No MOT

The website must contain **no MOT-related customer-facing functionality or SEO content**.

Do not build:

- MOT service pages
- MOT pre-check pages
- MOT pricing
- MOT booking options
- MOT navigation
- MOT reminder functionality
- MOT FAQs
- MOT keywords
- MOT structured data
- MOT articles
- MOT CTAs
- MOT metadata
- MOT fields in customer-facing vehicle lookup results
- wording such as “Service & MOT”

If a third-party vehicle API returns MOT information, discard it in the provider-normalisation layer.

Add automated regression protection so MOT content cannot accidentally enter the application later.

---

# 5. Tyre Services

The client indicated that tyre services are **not offered**.

Do not build or advertise:

```text
/services/tyres
/services/tyre-fitting
/services/mobile-tyre-fitting
/services/puncture-repair
/services/wheel-balancing
/services/winter-tyres
/services/run-flat-tyres
/services/alloy-wheel-repair
```

Do not include “Tyres” in primary navigation.

---

# 6. Primary Business Positioning

The website should visually and structurally prioritise four business pillars:

```text
1. Advanced Vehicle Diagnostics
2. Auto Electrical & Module Diagnostics
3. Mechanical Repairs & Servicing
4. Vehicle Sales
```

Supporting service pillars:

```text
Mobile Mechanic
Vehicle Inspections
Vehicle Recovery
Fleet Servicing
```

Diagnostics must receive the strongest SEO and visual emphasis.

---

# 7. Brand Proposition

Primary brand message:

> **Professional Diagnostics. Not Guesswork.**

Supporting message:

> Modern vehicles are complex. Replacing parts without identifying the underlying fault can become expensive quickly. SOB Autofix uses systematic testing and professional diagnostic equipment to identify the cause of a problem before recommending repairs.

Avoid unsupported claims such as:

```text
Best garage in Doncaster
Number one mechanic
Cheapest mechanic
Leading garage
Award-winning
Insurance approved
```

unless later substantiated.

---

# 8. Main Customer Journey

The primary conversion funnel should be:

```text
Google / Homepage
        ↓
Enter Registration
        ↓
Vehicle Identified
        ↓
Confirm Vehicle
        ↓
Tell Us What's Wrong
        ↓
Choose Service
        ↓
Book Appointment
        ↓
Calendly
        ↓
Appointment Confirmed
```

The website should understand the customer’s vehicle before requiring long forms.

---

# 9. Secondary Customer Journeys

## Diagnostics

```text
Google
↓
Car Diagnostics Doncaster
↓
Enter Registration
↓
Select warning/fault
↓
Book Diagnostic Appointment
```

## Mobile Mechanic

```text
Google
↓
Mobile Mechanic Doncaster
↓
Enter Registration
↓
Describe Problem
↓
Provide Location
↓
Request Assistance / Appointment
```

## Auto Electrical

```text
Google
↓
Auto Electrician Doncaster
↓
Select Electrical Problem
↓
Vehicle Lookup
↓
Book Diagnostic Appointment
```

## Vehicle Sales

```text
Google
↓
Cars for Sale
↓
Browse Vehicles
↓
Vehicle Detail Page
↓
Enquire / WhatsApp / Call
```

## Quote

```text
Service Page
↓
Vehicle Registration
↓
Vehicle Identified
↓
Describe Issue
↓
Optional Photos
↓
Customer Details
↓
Submit
```

---

# 10. Recommended Technology Stack

Use:

```text
Next.js 16.x
React
TypeScript
App Router
Tailwind CSS
shadcn/ui
Server Components by default
Zod
React Hook Form
PostgreSQL / Supabase
Calendly
Resend
Pluggable UK VRM / vehicle lookup provider
Vercel
GA4
Google Search Console
Sentry
Vitest
React Testing Library
Playwright
```

Avoid building the marketing website as a heavy SPA.

SEO-critical content must render in initial HTML.

---

# 11. Brand & Visual Direction

The supplied logo establishes a strong visual identity based on:

- electric automotive blue
- deep navy
- near-black
- cool metallic silver
- white
- pale blue highlights

The website should use a **dark automotive theme with electric-blue accents**.

The overall visual impression should be:

> Modern automotive diagnostics + advanced electronics + professional repair workshop.

Do not introduce unrelated dominant accent colours such as red, orange, green or purple.

Semantic colours may still be used for success, warnings and errors.

---

# 12. Brand Colour System

Use these initial design tokens.

```css
:root {
  /* Primary Brand */
  --brand-blue: #1974E2;
  --brand-blue-bright: #168BFF;
  --brand-blue-light: #67B9FF;
  --brand-blue-dark: #1446A5;

  /* Dark Backgrounds */
  --brand-navy: #071127;
  --brand-navy-light: #0C1D3D;
  --brand-black: #030712;

  /* Neutral */
  --white: #FFFFFF;
  --silver: #DCE6F2;
  --grey-100: #F4F7FA;
  --grey-200: #E4EAF0;
  --grey-400: #9AA7B6;
  --grey-600: #586575;
  --grey-800: #202A36;

  /* Semantic */
  --success: #16A34A;
  --warning: #F59E0B;
  --error: #DC2626;
}
```

Primary brand colour:

```text
#1974E2
```

Bright CTA blue:

```text
#168BFF
```

Dark navy:

```text
#071127
```

Main near-black:

```text
#030712
```

---

# 13. Tailwind Theme

Configure brand colours centrally.

```ts
const colors = {
  brand: {
    DEFAULT: "#1974E2",
    bright: "#168BFF",
    light: "#67B9FF",
    dark: "#1446A5",
    navy: "#071127",
    navyLight: "#0C1D3D",
    black: "#030712",
  },
}
```

Prefer semantic utilities/components rather than scattering raw hex values throughout the project.

---

# 14. Overall Website Theme

Recommended page rhythm:

```text
Dark/Naval Hero
↓
Light Service Section
↓
Dark Diagnostics Section
↓
White Content Section
↓
Dark Mobile Mechanic Section
↓
Light Vehicle Sales / Reviews
↓
Dark CTA
↓
Near-Black Footer
```

Do not make every section black.

Use alternating dark and light sections for hierarchy and readability.

---

# 15. Homepage Hero

Primary headline:

```text
Professional Diagnostics.
Not Guesswork.
```

Recommended treatment:

- “Professional Diagnostics.” in white
- “Not Guesswork.” in electric blue

Supporting copy:

```text
Automotive diagnostics, electrical fault finding, repairs,
servicing and vehicle sales in Doncaster and surrounding areas.
```

Primary interactive feature:

```text
ENTER YOUR REGISTRATION
```

Example:

```text
┌─────────────────────────────┐
│ GB │ AB12 CDE              │
└─────────────────────────────┘

[Find My Vehicle]
```

Secondary CTAs:

```text
Book Appointment
Call SOB Autofix
```

Optional tertiary action:

```text
WhatsApp Us
```

---

# 16. Hero Background

Use a dark navy-to-black background with a restrained blue glow.

```css
background:
  radial-gradient(
    circle at 70% 45%,
    rgba(25, 116, 226, 0.22),
    transparent 45%
  ),
  linear-gradient(
    135deg,
    #030712,
    #071127
  );
```

The visual language should suggest:

- vehicle electronics
- diagnostic scanning
- modern automotive technology
- precision

Avoid an excessive gaming/cyberpunk appearance.

---

# 17. Primary CTA Style

Primary conversion buttons should use:

```css
background: #1974E2;
color: #FFFFFF;
```

Hover:

```css
background: #168BFF;
```

Use primary blue for high-priority actions such as:

```text
Find My Vehicle
Book Appointment
Request Diagnostics
Request Mobile Assistance
```

---

# 18. Secondary CTA Style

On dark backgrounds:

```css
background: transparent;
border: 1px solid rgba(103, 185, 255, 0.45);
color: white;
```

Hover:

```css
background: rgba(25, 116, 226, 0.12);
border-color: #1974E2;
```

---

# 19. Logo Usage

The current logo includes:

- blue vehicle illustration
- diagnostic scanner
- gear
- waveform
- blue “sob”
- white/silver “autofix”
- blue/silver supporting text

The website must support this identity rather than compete with it.

Recommended header/footer backgrounds:

```text
#030712
#071127
```

Do not use the supplied phone screenshot as the final production logo.

Before launch, request:

```text
SVG logo
Transparent PNG
Horizontal logo
Square/icon version
Light/dark variant if available
```

For favicon/mobile app icon, use a simplified brand mark.

---

# 20. Diagnostic Visual Language

Use subtle blue diagnostic/status UI labels such as:

```text
VEHICLE IDENTIFIED
SYSTEM SCAN
FAULT DIAGNOSIS
MODULE ANALYSIS
VEHICLE HEALTH
READY FOR BOOKING
```

Use these sparingly for badges, states and small interface details.

Do not style normal paragraphs as diagnostic readouts.

---

# 21. Vehicle Lookup UI Theme

The registration-search UI should be one of the strongest branded interactions.

Container:

```css
background: rgba(7, 17, 39, 0.85);
border: 1px solid rgba(25, 116, 226, 0.35);
box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
```

Focus:

```css
border-color: #168BFF;
box-shadow: 0 0 0 3px rgba(22, 139, 255, 0.15);
```

Keep the actual registration plate visually recognisable:

```text
White plate
Black characters
Small blue GB strip
```

---

# 22. Main Navigation

Desktop:

```text
Logo

Services ▾
Diagnostics ▾
Mobile Mechanic
Vehicle Inspections
Fleet
Cars for Sale
Areas ▾
Advice
About
Contact

[Book Appointment]
```

Do not create an enormous 40-link mega menu.

---

# 23. Services Navigation

Under `Services`:

```text
Vehicle Servicing
Engine Repairs
Brake Repairs
Cambelt & Timing Chain
Suspension
Steering
Exhaust Repairs
Battery Replacement
Alternator Repairs
Starter Motor Repairs
Air Conditioning Diagnostics
Vehicle Recovery
```

---

# 24. Diagnostics Navigation

Give diagnostics a dedicated navigation group.

```text
Vehicle Diagnostics
Electrical Fault Finding
Engine Management Light
ECU Diagnostics
ABS Diagnostics
DPF Diagnostics
Battery & Charging Diagnostics
Car Module Diagnostics & Repairs
TPMS Diagnostics
```

---

# 25. Main URL Architecture

Core:

```text
/
 /about
 /contact
 /book
 /get-a-quote
 /gallery
 /reviews
 /faqs
 /fleet
 /mobile-mechanic
 /vehicle-check
 /vehicle-inspections
 /vehicle-recovery
```

Vehicle sales:

```text
/cars-for-sale
/cars-for-sale/[slug]
```

Services:

```text
/services
/services/vehicle-servicing
/services/engine-repair
/services/brake-repair
/services/cambelt-timing-chain
/services/suspension-repair
/services/steering-repair
/services/exhaust-repair
/services/battery-replacement
/services/alternator-repair
/services/starter-motor-repair
/services/air-conditioning-diagnostics
```

Diagnostics:

```text
/diagnostics
/diagnostics/car-diagnostics
/diagnostics/electrical-fault-finding
/diagnostics/engine-management-light
/diagnostics/ecu-diagnostics
/diagnostics/abs-diagnostics
/diagnostics/dpf-diagnostics
/diagnostics/battery-charging
/diagnostics/car-module-repair
/diagnostics/tpms
```

Locations:

```text
/areas
/areas/[location]
```

Advice:

```text
/advice
/advice/[slug]
```

Legal:

```text
/privacy
/cookies
/terms
```

---

# 26. Service Delivery Classification

Not every service is delivered identically.

Create:

```ts
type ServiceDeliveryType =
  | "in_house"
  | "mobile"
  | "outsourced_specialist"
```

Client specifically states clutch replacement is specialist outsourced work.

Example:

```ts
{
  slug: "clutch-replacement",
  name: "Clutch Replacement",
  deliveryType: "outsourced_specialist"
}
```

Use accurate wording such as:

> Clutch replacement can be arranged through our specialist repair network.

Do not present outsourced work as an in-house specialist repair.

---

# 27. Client Service Catalogue

## Diagnostics

```text
Professional Vehicle Diagnostics
Electrical Fault Finding
Engine Management Light Diagnosis
Check Engine Light Diagnosis
ECU Diagnostics
ABS Diagnostics
DPF Diagnostics
Battery & Charging Diagnostics
TPMS Diagnostics
Car Module Diagnostics
Car Module Repair
```

## Mechanical Repairs

```text
Engine Repairs
Brake Repairs
Suspension Repairs
Steering Repairs
Exhaust Repairs
Cambelt Replacement
Timing Chain Repairs
Oil Changes
```

## Starting & Charging

```text
Battery Replacement
Alternator Repair / Replacement
Starter Motor Repair / Replacement
```

## Air Conditioning

Client scope:

```text
Air-conditioning diagnostics
Air-conditioning electrical repairs
```

Do not advertise air-con regas/refrigerant recharge unless confirmed.

## Servicing

```text
Vehicle Servicing
Oil Services
Scheduled Maintenance
Vehicle Health Checks
Fleet Servicing
```

## Other

```text
Vehicle Inspections
Pre-Purchase Vehicle Inspection
Vehicle Recovery
Mobile Vehicle Repairs
Mobile Diagnostics
```

---

# 28. Special Offer

Client supplied:

> Full Services comes with All Car Module Computerized Diagnosis

Represent this as editable content.

```ts
{
  title: "Full Service + Comprehensive Module Diagnostic Scan",
  description:
    "Book a full service and receive a computerized diagnostic scan of vehicle modules.",
  active: true,
}
```

Do not call the diagnostic scan “free” unless the client explicitly confirms it.

---

# 29. Pricing Architecture

The client wants pricing displayed as ranges.

```ts
type ServicePrice = {
  minimum?: number
  maximum?: number
  label?: string
  notes?: string
}
```

Example presentation:

```text
Diagnostic Assessment
From £XX

Full Service
£XX–£XX depending on vehicle
```

Do not fabricate prices.

---

# 30. Fleet Pricing

There is currently no dedicated fleet pricing.

Display:

> Contact us to discuss fleet servicing requirements.

Do not invent fleet packages.

---

# 31. Vehicle Registration Lookup

Vehicle lookup is a core feature.

Make it available from:

```text
Homepage
Diagnostics pages
Service pages
Mobile Mechanic page
Quote page
Booking flow
Vehicle Inspection page
```

---

# 32. Vehicle Lookup UX

Step 1:

```text
Enter your registration
```

Example:

```text
AB12 CDE
```

Normalise:

```text
AB12CDE
```

Step 2:

```text
Finding your vehicle…
```

Step 3:

```text
VEHICLE IDENTIFIED

VAUXHALL ASTRA
2017
1.4 PETROL
AUTOMATIC

AB12 CDE
```

CTA:

```text
Yes, that's my vehicle
```

Secondary:

```text
Not your vehicle?
```

---

# 33. Vehicle Confirmation Journey

After confirmation:

```text
What can we help with?
```

Options:

```text
Warning light
Electrical problem
Car won't start
Engine problem
Brakes
Steering
Suspension
Servicing
Battery / charging
Air conditioning
Vehicle inspection
Mobile mechanic
Recovery
Something else
```

---

# 34. Symptom-Led Diagnostic UX

Because diagnostics is a major differentiator, customers should also be able to start from symptoms.

```text
What's happening with your vehicle?
```

Cards:

```text
Engine warning light is on
Car won't start
Battery keeps going flat
ABS light is on
Car has lost power
Car is shaking
Electrical equipment isn't working
Car is overheating
Car is making a strange noise
Fuel consumption has increased
Other
```

The app may recommend the most relevant service based on the selected symptom.

Do not claim an actual diagnosis before inspection/testing.

---

# 35. Vehicle Provider Abstraction

Never tightly couple the frontend to one provider.

```ts
export interface VehicleLookupProvider {
  lookup(registration: string): Promise<VehicleDetails>
}
```

Providers:

```text
DVLAProvider
CommercialVRMProvider
MockProvider
```

Configuration:

```env
VEHICLE_LOOKUP_PROVIDER=
```

---

# 36. Normalised Vehicle Model

```ts
export type VehicleDetails = {
  registration: string

  make?: string
  model?: string
  derivative?: string

  year?: number
  colour?: string

  fuelType?: string
  transmission?: string

  engineCapacityCc?: number
  bodyType?: string
}
```

Do not expose MOT fields.

---

# 37. Vehicle Lookup API

Use:

```http
POST /api/vehicle/lookup
```

Request:

```json
{
  "registration": "AB12CDE"
}
```

Response:

```json
{
  "success": true,
  "vehicle": {
    "registration": "AB12CDE",
    "make": "Vauxhall",
    "model": "Astra",
    "year": 2017,
    "fuelType": "Petrol"
  }
}
```

Never expose upstream provider API keys.

---

# 38. Registration Privacy & Security

Never include registration numbers in:

```text
URL paths
query strings
GA4 page URLs
Search Console URLs
Sentry breadcrumb text
ordinary logging
SEO pages
```

Do not create:

```text
/vehicle/AB12CDE
```

Use session state.

Other rules:

- uppercase input
- remove whitespace before lookup
- validate expected registration length and characters
- call provider server-side
- rate-limit the endpoint
- implement timeout handling
- do not log raw upstream payloads
- cache only if permitted by provider terms
- do not permanently store registrations from anonymous lookup alone

---

# 39. Vehicle Session Context

```ts
type VehicleSession = {
  vehicle: VehicleDetails | null
  selectedProblem?: string
  selectedService?: string
}
```

Prefer session storage for active journeys rather than permanent local storage.

---

# 40. Persistent “Your Vehicle” UI

After lookup, show:

```text
YOUR VEHICLE

VAUXHALL ASTRA
AB12 CDE

[Change Vehicle]
```

Display this during:

```text
Service selection
Quote flow
Booking
Mobile mechanic enquiry
Inspection enquiry
```

---

# 41. Calendly Booking

Create:

```text
/book
```

Embed Calendly within the SOB Autofix website.

Do not automatically redirect customers to an external booking page unless necessary.

---

# 42. Booking Page Layout

```text
Book Your Appointment

YOUR VEHICLE
Vauxhall Astra
AB12 CDE

SERVICE
Vehicle Diagnostics

PROBLEM
Engine management light

-------------------------

Choose Your Appointment

[CALENDLY EMBED]
```

---

# 43. Calendly Prefill

Where supported, prefill:

```text
Customer name
Email
Vehicle registration
Vehicle make/model
Selected service
Problem description
```

Avoid asking customers to enter the same information repeatedly.

---

# 44. Calendly Performance

Do not load Calendly JavaScript on every marketing page.

Load it:

```text
on /book
or
when booking modal/section is explicitly opened
```

The booking system must not unnecessarily damage Core Web Vitals.

---

# 45. Mobile Mechanic Page

URL:

```text
/mobile-mechanic
```

Primary H1:

```text
Mobile Mechanic in Doncaster
```

Sections:

```text
Hero
Vehicle Registration
Mobile Services Available
Problems We Can Diagnose
How Mobile Appointments Work
Areas Covered
Diagnostic Equipment
Common Questions
Customer Reviews
Book Mobile Mechanic
```

---

# 46. Mobile Mechanic Request Form

Fields:

```text
Vehicle registration
Vehicle
Current location / postcode
Problem
Is vehicle driveable?
Name
Phone
Email
Preferred contact method
```

CTA:

```text
Request Mobile Assistance
```

Do not claim emergency response capability unless the client explicitly confirms it.

---

# 47. Diagnostics Hub

URL:

```text
/diagnostics
```

H1:

```text
Professional Vehicle Diagnostics in Doncaster
```

Sections:

```text
Professional Diagnostics. Not Guesswork.
Registration Lookup
Dealer-Level Diagnostic Capability
Computer Diagnostics vs Proper Fault Finding
Electrical Testing
Module Diagnostics
Warning Lights
Common Problems
Diagnostic Process
Recent Diagnostic Cases
FAQ
Book Diagnostics
```

This should be one of the strongest pages on the entire website.

---

# 48. Diagnostic Process

Recommended process:

```text
1. Understand the symptoms
2. Scan relevant vehicle systems
3. Analyse fault codes
4. Carry out targeted electrical/mechanical tests
5. Identify the underlying fault
6. Explain recommended repair
7. Repair after approval
```

Key educational message:

> A fault code is a starting point — not automatically a diagnosis.

---

# 49. Car Module Diagnostics & Repair

Create:

```text
/diagnostics/car-module-repair
```

Possible content categories:

```text
ECU
ABS modules
Body control modules
Airbag systems
Instrument clusters
Charging modules
Communication faults
CAN-bus related diagnosis
```

Only publish systems the client genuinely works on.

Do not claim programming/coding capability unless confirmed.

---

# 50. Auto Electrician Page

URL:

```text
/diagnostics/electrical-fault-finding
```

SEO H1:

```text
Auto Electrician & Electrical Fault Diagnosis in Doncaster
```

Topics:

```text
Battery drain
Charging problems
Starting problems
Warning lights
Sensor faults
Wiring problems
Intermittent faults
Module communication problems
Electrical component failure
```

---

# 51. Vehicle Inspection

URL:

```text
/vehicle-inspections
```

Primary target:

```text
Pre-Purchase Vehicle Inspection Doncaster
```

Potential service scope:

```text
Pre-purchase inspection
Vehicle health check
Diagnostic scan
Visual mechanical inspection
```

Do not mention MOT.

---

# 52. Vehicle Recovery

URL:

```text
/vehicle-recovery
```

Include only verified capabilities:

```text
Vehicle recovery availability
Areas covered
How to request recovery
Phone
WhatsApp
```

Do not promise fixed response times unless confirmed.

---

# 53. Vehicle Sales

Vehicle sales must be treated as a real business pillar.

Create:

```text
/cars-for-sale
/cars-for-sale/[vehicle-slug]
```

---

# 54. Cars for Sale Listing

Support filters:

```text
Make
Model
Price
Fuel
Transmission
Year
```

Card example:

```text
[Image]

2020 Ford Focus
1.5 EcoBlue

£X,XXX

Mileage
Transmission
Fuel

[View Vehicle]
```

---

# 55. Vehicle Sales Detail Page

Include:

```text
Image gallery
Price
Make
Model
Year
Mileage
Fuel
Transmission
Engine
Colour
Vehicle description
Key features
Condition
Warranty information
Finance availability
Contact
WhatsApp
Call
Arrange Viewing
```

---

# 56. Vehicle Sales Finance

Client states finance is available for car sales.

Use careful wording until regulatory/provider details are confirmed:

> Finance options may be available on selected vehicles. Contact us for details.

Do not imply SOB Autofix itself is the lender unless confirmed.

---

# 57. Vehicle Warranty

Some cars may include warranty.

Use per-vehicle configuration:

```ts
warranty?: {
  available: boolean
  description?: string
}
```

Do not claim every vehicle includes a warranty.

---

# 58. Vehicle Inventory Model

```ts
type SaleVehicle = {
  id: string
  slug: string

  make: string
  model: string
  derivative?: string

  year: number
  mileage: number

  price: number

  fuelType: string
  transmission: string

  engineSize?: string
  colour?: string

  description: string

  features: string[]

  images: VehicleImage[]

  warranty?: {
    available: boolean
    description?: string
  }

  financeAvailable?: boolean

  status:
    | "available"
    | "reserved"
    | "sold"

  createdAt: Date
}
```

---

# 59. Sold Vehicle Handling

When a vehicle is sold:

```text
Mark as SOLD
```

Do not immediately delete valuable indexed pages.

Where useful:

1. Keep the page temporarily with sold status
2. Remove it from live inventory
3. Later redirect to the main inventory or relevant make listing

Avoid creating large volumes of dead URLs.

---

# 60. Fleet Servicing

Create:

```text
/fleet
```

Content:

```text
Fleet servicing
Diagnostics
Electrical repairs
Preventative maintenance
Vehicle health checks
Repair coordination
```

No fixed fleet pricing currently exists.

CTA:

```text
Discuss Your Fleet
```

---

# 61. Quote Request

Create:

```text
/get-a-quote
```

Fields:

```text
Registration
Vehicle details
Requested service
Problem description
Name
Email
Phone
Preferred contact method
Photo upload
Current postcode if mobile service requested
```

Use wording such as:

```text
Request a Quote
Request an Estimate
Get a Repair Estimate
```

Do not claim a guaranteed instant price.

---

# 62. WhatsApp

WhatsApp is a requested feature.

Create reusable:

```text
WhatsAppButton
```

Use on:

```text
Header/mobile navigation
Contact page
Mobile mechanic
Vehicle sales
Vehicle recovery
Sticky mobile CTA
```

---

# 63. Live Chat

Client requested live chat.

Use provider abstraction.

```ts
interface LiveChatProvider {
  initialise(): void
}
```

Lazy-load after initial rendering or interaction.

Do not allow live chat to damage Core Web Vitals.

---

# 64. Contact Capture

Standard model:

```ts
type CustomerContact = {
  name: string
  email?: string
  phone: string
  preferredContact:
    | "phone"
    | "whatsapp"
    | "email"
}
```

Only collect information necessary for the requested service.

---

# 65. Email Confirmations

Use transactional email for:

```text
Quote submitted
Contact enquiry
Fleet enquiry
Mobile mechanic request
Inspection enquiry
Vehicle sales enquiry
```

Calendly can manage booking confirmations.

Avoid duplicate booking emails unless deliberately required.

---

# 66. Reviews & Testimonials

Google Reviews are available.

Create:

```text
/reviews
```

and show reviews on key landing pages.

Use genuine reviews only.

Do not fabricate testimonials.

If client-supplied testimonials become available later, clearly distinguish them from Google Reviews.

---

# 67. Trust Information

Verified details available:

```text
4 years in business
NABTEB
Automotive Service Management Certificate
24-hour opening
Mobile service availability
Vehicle sales
Google reviews
```

Do not invent:

```text
Awards
Insurance-approved status
RAC/AA approval
Motor Ombudsman status
IMI status
Review counts
Customer counts
```

unless later supplied and verified.

---

# 68. 24-Hour Availability

Client supplied 24-hour opening for:

```text
Monday-Friday
Saturday
Sunday
Bank holidays
```

The website may display:

```text
Open 24 Hours
```

However:

- 24-hour business opening is not automatically the same as emergency roadside attendance
- Calendly availability is independent of business opening hours
- do not promise instant response times

---

# 69. Homepage Architecture

Recommended order:

```text
1. Hero + Registration Lookup
2. Diagnostics Value Proposition
3. Trust Indicators
4. Main Services
5. "What Problem Are You Having?"
6. Mobile Mechanic
7. Auto Electrical & Module Diagnostics
8. Full Service Offer
9. How It Works
10. Vehicle Sales
11. Recent Repairs / Workshop Work
12. Customer Reviews
13. Areas Covered
14. Automotive Advice
15. 24-Hour Availability
16. Final Booking CTA
```

---

# 70. SEO Strategy

SEO must be built into the architecture.

Primary SEO layers:

```text
1. Service intent
2. Problem/symptom intent
3. Location intent
4. Expertise/information intent
```

Avoid thin programmatic SEO.

---

# 71. Primary SEO Keywords

Client supplied:

```text
Mobile Mechanic Doncaster
Car Diagnostics Doncaster
Vehicle Diagnostics Doncaster
Auto Electrician Doncaster
Mobile Car Diagnostics
Engine Management Light Diagnosis
Check Engine Light Diagnosis
Automotive Electrical Diagnostics
Car Repairs Doncaster
Mobile Vehicle Repairs
```

Use these to guide page architecture and content.

Do not mechanically repeat them across every page.

---

# 72. Secondary SEO Keywords

Client supplied:

```text
Electrical Fault Finding
ECU Diagnostics
ABS Diagnostics
DPF Diagnostics
Battery & Charging System Diagnostics
Pre-Purchase Vehicle Inspection
Used Cars for Sale Doncaster
Vehicle Health Check
Engine Fault Diagnosis
Mobile Garage Doncaster
```

Create dedicated pages only where genuine search intent and unique content exist.

---

# 73. Priority SEO Landing Pages

Launch priority:

```text
/mobile-mechanic

/diagnostics/car-diagnostics

/diagnostics/electrical-fault-finding

/diagnostics/engine-management-light

/diagnostics/ecu-diagnostics

/diagnostics/abs-diagnostics

/diagnostics/dpf-diagnostics

/diagnostics/battery-charging

/vehicle-inspections

/services/engine-repair

/services/vehicle-servicing

/services/brake-repair

/cars-for-sale
```

---

# 74. Areas Covered

Client supplied:

```text
Doncaster
Bentley
Mexborough
Conisbrough
Rotherham
Barnsley
Goole
Scunthorpe
Pontefract
Wakefield
South Yorkshire
surrounding areas
```

Create:

```text
/areas/doncaster
/areas/bentley
/areas/mexborough
/areas/conisbrough
/areas/rotherham
/areas/barnsley
/areas/goole
/areas/scunthorpe
/areas/pontefract
/areas/wakefield
```

Use `/areas` as the regional hub.

Do not create hundreds of city/service permutations.

---

# 75. Location Page Template

Every area page must have genuinely differentiated content.

Structure:

```text
H1
Local service summary
Diagnostics availability
Mobile mechanic coverage
Popular services
Workshop/mobile relationship
Local context
Reviews from area where available
FAQ
Booking CTA
```

Do not generate duplicate pages by merely changing town names.

---

# 76. SEO Content Clusters

## Diagnostics

```text
Vehicle Diagnostics
│
├── Engine Management Light
├── Check Engine Light
├── ECU Diagnostics
├── ABS Diagnostics
├── DPF Diagnostics
├── Electrical Fault Finding
├── Battery & Charging
├── Module Diagnostics
└── Engine Fault Diagnosis
```

## Mobile Mechanic

```text
Mobile Mechanic
│
├── Mobile Diagnostics
├── Mobile Vehicle Repairs
├── Battery / Starting Problems
├── Electrical Fault Diagnosis
└── Areas Covered
```

## Repairs

```text
Car Repairs
│
├── Engine
├── Brakes
├── Steering
├── Suspension
├── Exhaust
├── Cambelt
├── Timing Chain
├── Alternator
├── Starter Motor
└── Battery
```

## Inspections

```text
Vehicle Inspections
│
├── Pre-Purchase Inspection
└── Vehicle Health Check
```

## Sales

```text
Cars for Sale
│
├── Available Vehicles
├── Finance Information
└── Buying Advice
```

---

# 77. Advice Centre

Create:

```text
/advice
/advice/[slug]
```

Categories:

```text
Diagnostics
Warning Lights
Electrical Problems
Car Maintenance
Engine
Brakes
Buying a Used Car
Vehicle Inspections
```

---

# 78. Initial Article Strategy

Launch with genuinely useful articles such as:

```text
What Does an Engine Management Light Mean?
Why Is My Car Battery Going Flat?
Why Won't My Car Start?
What Is ECU Diagnostics?
What Does an ABS Warning Light Mean?
Common Causes of DPF Warning Lights
Alternator Warning Signs
How to Know if Your Starter Motor Is Failing
What Should a Pre-Purchase Vehicle Inspection Check?
What Does a Vehicle Diagnostic Test Actually Tell You?
Why Fault Codes Don't Always Tell You Which Part Is Broken
When Should You Replace a Timing Belt?
Signs of a Timing Chain Problem
```

Diagnostics should dominate the early content strategy.

---

# 79. Internal Linking

Use contextual internal links.

Example:

```text
Why Is My Battery Going Flat?
→ Battery & Charging Diagnostics
→ Auto Electrical
→ Alternator Repair
→ Mobile Mechanic
```

Another:

```text
ABS Warning Light
→ ABS Diagnostics
→ Electrical Fault Finding
→ Brake Repair
```

Do not use giant keyword-link blocks.

---

# 80. Service Page Template

Every major service page should include:

```text
Breadcrumb
H1
Short direct introduction
Vehicle registration lookup
Signs you may need this service
Common causes
How SOB Autofix diagnoses the issue
What the service includes
Repair process
Pricing/range where available
Recent relevant work
Why choose SOB Autofix
Areas covered
Frequently asked questions
Related services
Booking CTA
```

---

# 81. Diagnostic Page Template

Diagnostics pages should additionally explain:

```text
Symptoms
Possible causes
What a scan may reveal
Why testing is still required
Diagnostic process
Potential next steps
```

Never imply that a fault code alone proves which component is defective.

---

# 82. Metadata

Every indexable page must have:

```text
Unique title
Unique meta description
Canonical URL
OpenGraph metadata
Twitter metadata
Breadcrumbs
Structured data
```

Example:

```text
Car Diagnostics Doncaster | SOB Autofix
```

Description example:

```text
Professional vehicle diagnostics and electrical fault finding in Doncaster. Engine warning lights, ECU, ABS, charging and module diagnostics. Book SOB Autofix online.
```

---

# 83. Structured Data

Implement reusable JSON-LD.

## Business

Use appropriate:

```text
AutoRepair
LocalBusiness
Organization
```

Include verified:

```text
Business name
Legal name
Address
Phone
Opening hours
Website
Logo
Area served
```

## Services

Use:

```text
Service
BreadcrumbList
```

## Advice

Use:

```text
Article
BreadcrumbList
```

## Vehicle Sales

Use appropriate product/vehicle schema only where valid.

Never fabricate rating or review markup.

---

# 84. Sitemap

Create:

```text
/sitemap.xml
```

Include:

```text
Core pages
Services
Diagnostics
Area pages
Advice articles
Available vehicle listings
```

Exclude:

```text
/api/*
booking callbacks
internal search
admin
preview routes
temporary forms
non-indexable sold/removed inventory
```

---

# 85. Robots

Create:

```text
robots.ts
```

Allow public marketing content.

Block private/internal/API routes where appropriate.

---

# 86. Canonical URLs

Tracking URLs must canonicalise to clean pages.

Example:

```text
/services/engine-repair?utm_source=google
```

canonical:

```text
/services/engine-repair
```

---

# 87. Google Business Profile Alignment

Website NAP must exactly match the business’s confirmed Google Business Profile.

Current supplied address:

```text
SOB Autofix Limited
Cumbrae
Station Road
Norton
Doncaster
DN6 9HF
```

Once the phone number and Maps listing are confirmed, keep them consistent everywhere.

---

# 88. Gallery

Create:

```text
/gallery
```

Categories:

```text
Diagnostics
Engine Repairs
Electrical Repairs
Servicing
Before & After
Workshop
Cars for Sale
Videos
```

Hide empty categories until real media exists.

---

# 89. Case Studies

Diagnostic case studies should follow:

```text
Vehicle
Customer complaint
Initial symptoms
Diagnostic process
Fault identified
Repair performed
Outcome
```

Never fabricate cases.

---

# 90. FAQs

Create:

```text
/faqs
```

Potential FAQs:

```text
How much does vehicle diagnostics cost?
Do you provide mobile diagnostics?
Can you diagnose electrical faults?
Can you come to my location?
Do you repair ECU/module faults?
Do you work on all vehicle makes?
Do I need an appointment?
Are you open 24 hours?
Can you inspect a car before I buy it?
Do you sell used cars?
```

Also display contextual FAQs on service pages.

---

# 91. Contact Page

Create:

```text
/contact
```

Include:

```text
Phone
WhatsApp
Email
Address
Opening Hours
Map
Directions
Contact Form
Book Appointment
```

Mobile actions:

```text
Call
WhatsApp
Directions
Book
```

---

# 92. Header Design

Use a dark header.

Example:

```css
background: rgba(3, 7, 18, 0.92);
backdrop-filter: blur(16px);
border-bottom: 1px solid rgba(25, 116, 226, 0.15);
```

Active navigation may use electric blue.

Do not make every navigation item blue.

---

# 93. Mobile Navigation

Use a dark navy mobile drawer.

Primary mobile actions:

```text
Call
WhatsApp
Book Appointment
```

Use electric blue for the primary booking action.

---

# 94. Sticky Mobile CTA

Recommended:

```text
┌────────────────────────────────────┐
│ Call │ WhatsApp │ Vehicle │ BOOK │
└────────────────────────────────────┘
```

`BOOK` should use the primary blue background.

On vehicle sales pages:

```text
Call
WhatsApp
Enquire
```

---

# 95. Service Card Design

Light cards:

```css
background: #FFFFFF;
border: 1px solid #E4EAF0;
```

Hover:

```css
border-color: rgba(25, 116, 226, 0.4);
box-shadow: 0 16px 40px rgba(3, 7, 18, 0.08);
```

Icons use electric blue.

---

# 96. Diagnostic Card Design

Dark diagnostic cards:

```css
background: #071127;
border: 1px solid rgba(25, 116, 226, 0.28);
```

Headings:

```text
White
```

Descriptions:

```text
#B7C5D7
```

Icons:

```text
#168BFF
```

Hover:

```css
border-color: #1974E2;
transform: translateY(-3px);
```

Keep animation restrained.

---

# 97. Section Eyebrows

Use small uppercase blue labels.

Example:

```text
VEHICLE DIAGNOSTICS
```

Style:

```css
font-size: 0.75rem;
font-weight: 700;
letter-spacing: 0.12em;
color: #1974E2;
```

---

# 98. Photography Treatment

Use real workshop photography.

Do not apply heavy blue filters to every image.

Where text overlays photography:

```css
background:
  linear-gradient(
    90deg,
    rgba(3, 7, 18, 0.92),
    rgba(3, 7, 18, 0.25)
  ),
  url(...);
```

Use subtle cool grading only.

---

# 99. Decorative Motifs

Subtle visual motifs may use:

```text
Diagnostic waveform
Electronic scanner
Automotive silhouette
Thin circuit lines
Blue radial glow
Subtle grids
```

Avoid excessive:

```text
Neon lightning
Constant scanning animations
Moving circuit boards
Gaming-style HUD effects
```

---

# 100. Typography Colours

Dark sections:

```text
Headings: #FFFFFF
Body:     #C6D2DF
Muted:    #8F9EAF
Links:    #67B9FF
```

Light sections:

```text
Headings: #071127
Body:     #364152
Muted:    #667586
Links:    #1974E2
```

---

# 101. Footer

Use:

```text
#030712
```

Top border:

```css
border-top: 1px solid rgba(25, 116, 226, 0.2);
```

Columns:

```text
Services
Diagnostics
Areas
Cars for Sale
Company
```

Business details:

```text
SOB Autofix Limited

Cumbrae
Station Road
Norton
Doncaster
DN6 9HF

07469 273483

sobautofix@gmail.com

Company No. 16182532
```

Do not display a VAT number because none was supplied.

Links:

```text
Privacy
Cookies
Terms
```

---

# 102. Brand Colour Hierarchy

Use approximately:

```text
60% — white / deep navy / black foundations
25% — neutral greys and silver
15% — electric blue
```

Blue should attract attention rather than cover every surface.

---

# 103. Brand Design Principle

The site should communicate:

> **Advanced automotive diagnostics**

rather than:

> **Generic local garage**

The relationship between:

```text
vehicle
+
electronics
+
diagnostics
+
repair expertise
```

should be immediately obvious.

---

# 104. Recommended Database

If persistence is required, use PostgreSQL/Supabase.

Tables:

```text
customers
vehicles
enquiries
enquiry_attachments
sale_vehicles
sale_vehicle_images
```

Future:

```text
service_history
customer_reminders
fleet_accounts
```

---

# 105. Enquiry Model

```ts
type Enquiry = {
  id: string

  type:
    | "repair"
    | "diagnostic"
    | "mobile"
    | "inspection"
    | "fleet"
    | "recovery"
    | "vehicle_sales"
    | "general"

  customerId: string
  vehicleId?: string
  serviceSlug?: string
  description?: string
  locationPostcode?: string

  status:
    | "new"
    | "contacted"
    | "booked"
    | "closed"

  createdAt: Date
}
```

---

# 106. Recommended Source Tree

```text
src/
├── app/
│
│   ├── (marketing)/
│   │   ├── page.tsx
│   │   ├── about/
│   │   ├── contact/
│   │   ├── reviews/
│   │   ├── gallery/
│   │   ├── faqs/
│   │   ├── fleet/
│   │   ├── mobile-mechanic/
│   │   ├── vehicle-inspections/
│   │   ├── vehicle-recovery/
│   │   │
│   │   ├── services/
│   │   │   ├── page.tsx
│   │   │   └── [slug]/
│   │   │
│   │   ├── diagnostics/
│   │   │   ├── page.tsx
│   │   │   └── [slug]/
│   │   │
│   │   ├── areas/
│   │   │   ├── page.tsx
│   │   │   └── [slug]/
│   │   │
│   │   ├── advice/
│   │   │   ├── page.tsx
│   │   │   └── [slug]/
│   │   │
│   │   └── cars-for-sale/
│   │       ├── page.tsx
│   │       └── [slug]/
│   │
│   ├── vehicle-check/
│   ├── book/
│   ├── get-a-quote/
│   │
│   ├── api/
│   │   ├── vehicle/
│   │   │   └── lookup/
│   │   ├── enquiry/
│   │   ├── vehicles-for-sale/
│   │   └── health/
│   │
│   ├── privacy/
│   ├── cookies/
│   ├── terms/
│   ├── robots.ts
│   └── sitemap.ts
│
├── components/
│   ├── booking/
│   ├── diagnostics/
│   ├── forms/
│   ├── gallery/
│   ├── layout/
│   ├── navigation/
│   ├── reviews/
│   ├── sales/
│   ├── seo/
│   ├── services/
│   ├── vehicle/
│   └── ui/
│
├── config/
│   ├── site.ts
│   ├── services.ts
│   ├── diagnostics.ts
│   ├── locations.ts
│   └── navigation.ts
│
├── content/
│   ├── services/
│   ├── diagnostics/
│   ├── areas/
│   └── advice/
│
├── lib/
│   ├── analytics/
│   ├── calendly/
│   ├── db/
│   ├── email/
│   ├── seo/
│   ├── vehicle/
│   ├── validation/
│   └── rate-limit/
│
└── types/
```

---

# 107. Reusable Components

Build:

```text
Header
DesktopNavigation
MobileNavigation
Footer

Hero
TrustBar

VehicleRegistrationInput
VehicleLookupResult
VehicleConfirmation
VehicleSummary

ProblemSelector
ServiceSelector

DiagnosticServiceCard
RepairServiceCard

MobileMechanicCTA

CalendlyEmbed
BookingSummary

QuoteForm
MobileMechanicForm
FleetForm
ContactForm
VehicleSalesEnquiry

ReviewCard

GalleryGrid
BeforeAfterViewer

CarListingCard
CarListingGrid
CarGallery

FAQAccordion

AreasGrid

Breadcrumbs
JsonLd
PageCTA

WhatsAppButton
StickyMobileCTA
```

---

# 108. Analytics Events

Implement:

```text
vehicle_lookup_started
vehicle_lookup_success
vehicle_lookup_failed

diagnostic_service_viewed

problem_selected
service_selected

booking_opened
booking_completed

quote_started
quote_submitted

mobile_mechanic_started
mobile_mechanic_submitted

inspection_enquiry_submitted
recovery_enquiry_submitted

phone_clicked
whatsapp_clicked
directions_clicked

vehicle_listing_viewed
vehicle_sales_enquiry

fleet_enquiry_submitted
```

Never send registration numbers to analytics.

---

# 109. Performance Targets

Target:

```text
LCP < 2.5 seconds
CLS < 0.1
INP < 200 ms
```

Lighthouse goals:

```text
Performance: 90+
Accessibility: 95+
Best Practices: 95+
SEO: 100
```

---

# 110. Performance Rules

Use:

```text
Server Components
next/image
AVIF/WebP
Responsive images
next/font
Code splitting
Lazy-loaded gallery
Deferred Calendly
Deferred live chat
Minimal third-party JavaScript
```

Avoid autoplay hero video.

---

# 111. Accessibility

Requirements:

```text
Keyboard navigation
Visible focus states
Semantic HTML
Correct heading hierarchy
Proper form labels
Accessible validation errors
Good contrast
Reduced-motion support
Meaningful alt text
Accessible mobile navigation
```

Focus example:

```css
outline: 3px solid rgba(22, 139, 255, 0.45);
outline-offset: 3px;
```

---

# 112. Forms Security

Validate with Zod.

Implement:

```text
Rate limiting
Spam protection
Server-side validation
File type validation
File size restrictions
Content sanitisation
```

Never trust client-side validation alone.

---

# 113. Vehicle API Rate Limiting

Protect:

```text
/api/vehicle/lookup
```

Suggested configurable baseline:

```text
10 lookups per minute per IP
```

Implement cooldown for suspicious traffic.

---

# 114. SEO Guardrails

Do not use:

```text
Keyword stuffing
Hidden keywords
Hundreds of thin location pages
Automatically generated service + city combinations
Fake reviews
Fake business statistics
Copied competitor content
Duplicate metadata
Low-value AI filler
```

---

# 115. Programmatic SEO Rule

Do not automatically generate pages such as:

```text
Brake Repair Doncaster
Brake Repair Bentley
Brake Repair Mexborough
Brake Repair Rotherham
Brake Repair Barnsley
```

unless each page provides genuinely unique value.

Prioritise authoritative service pages plus strong area pages.

---

# 116. Content Tone

The content should sound:

```text
Technical
Professional
Direct
Trustworthy
Easy to understand
Diagnostic-led
```

Avoid:

```text
Overhyped
Cheap-sounding
Keyword stuffed
Generic corporate jargon
```

---

# 117. Core Copy Principle

The strongest recurring message should be:

> **Don't replace parts based on guesswork. Identify the fault first.**

This should differentiate SOB Autofix throughout the website.

---

# 118. Future Customer Portal

Client is interested in:

```text
Customer portal
Service history
Maintenance reminders
Loyalty programme
Online payments
Fleet dashboard
```

Do not build these into Phase 1.

Design data structures so they can be added later.

---

# 119. Future Reminder System

Future maintenance reminders may include:

```text
Service reminders
Oil change reminders
Cambelt reminders
Battery check reminders
Vehicle inspection reminders
```

Do not include MOT reminders.

---

# 120. Future Online Payments

Potential later uses:

```text
Diagnostic deposit
Booking deposit
Repair invoice
Vehicle reservation deposit
```

Do not implement until payment requirements are confirmed.

---

# 121. Phase 1 Implementation

Build:

```text
Design system
Blue/dark brand theme
Global layout
Homepage
About
Contact
Diagnostics hub
Core diagnostic pages
Core repair pages
Mobile mechanic
Vehicle lookup
Vehicle session context
Calendly booking
Quote request
Vehicle inspections
Vehicle recovery
Fleet page
Cars for sale
Vehicle detail pages
Reviews
Gallery framework
FAQs
Area pages
Advice architecture
Structured data
Sitemap
Robots
Analytics
Email notifications
WhatsApp integration
Security
Testing
SEO testing
MOT regression testing
```

---

# 122. Phase 2

Add:

```text
More diagnostic content
Additional advice articles
Diagnostic case studies
Before/after gallery
Video content
Expanded local SEO
More vehicle-sales tooling
Finance integration
Review automation
More service pricing
```

---

# 123. Phase 3

Potential:

```text
Customer accounts
Saved vehicles
Service history
Maintenance reminders
Online payments
Repair tracking
Digital inspection reports
Fleet dashboard
Loyalty programme
Invoice/payment portal
```

---

# 124. Suggested SEO Launch Priority

Prioritise:

```text
Homepage

Mobile Mechanic Doncaster

Car Diagnostics Doncaster

Vehicle Diagnostics Doncaster

Auto Electrician Doncaster

Electrical Fault Finding

Engine Management Light Diagnosis

ECU Diagnostics

ABS Diagnostics

DPF Diagnostics

Battery & Charging Diagnostics

Pre-Purchase Vehicle Inspection

Engine Repair

Vehicle Servicing

Brake Repair

Cars for Sale

Contact

About
```

Then area pages:

```text
Doncaster
Bentley
Mexborough
Conisbrough
Rotherham
Barnsley
Goole
Scunthorpe
Pontefract
Wakefield
```

---

# 125. Search Console Strategy

After launch:

```text
Submit sitemap
Inspect major pages
Monitor indexing
Monitor Core Web Vitals
Track diagnostic queries
Track mobile-mechanic queries
Track location queries
Track vehicle-sales queries
Identify low-CTR pages
Improve titles/descriptions
Identify positions 8–20 opportunities
Expand pages based on genuine search data
```

---

# 126. Automated SEO Testing

CI should detect:

```text
Missing title
Missing description
Missing H1
Missing canonical
Broken internal links
Invalid sitemap entries
Accidental noindex
Images without alt text
Orphan service pages
Duplicate metadata
```

---

# 127. MOT Regression Protection

Add automated tests scanning:

```text
Navigation
Service definitions
Page routes
Metadata
Generated sitemap
Visible marketing copy
FAQs
Booking options
Reminder definitions
Structured data
```

No customer-facing MOT feature may enter production.

Upstream provider adapters may internally detect MOT-related fields only for the purpose of discarding them.

---

# 128. Client Content Status

## Ready

```text
Business name
Tagline
Supporting line
Business description
Company number
Phone
WhatsApp
Email
Address
Opening hours
Core services
SEO locations
SEO keywords
Years in business
Accreditation information
Vehicle sales requirement
Finance availability statement
Partial warranty information
```

## Still Required

```text
Original SVG/transparent logo
Confirmed WhatsApp number
Actual Google Maps URL
Final service pricing/ranges
Diagnostic pricing
Final Calendly link
Workshop photos
Before/after photos
Videos
Google review integration/source
Vehicle sales inventory
Vehicle photos
Finance provider information
Warranty wording
Privacy/cookie final details
Production domain
```

---

# 129. Definition of Done

The Phase 1 website is ready when all of the following are true.

## Brand

- SOB Autofix branding is consistent
- electric blue/dark navy palette is implemented
- tagline is correctly displayed
- current logo is used only as development reference until clean asset is supplied
- contact data comes from one configuration source
- business address is consistent
- company number is displayed correctly

## Vehicle Journey

- registration lookup works
- vehicle can be confirmed
- selected vehicle persists through the active journey
- problem/service selection works
- vehicle information reaches booking and quote workflows
- registrations are not exposed in URLs

## Diagnostics

- diagnostics is the primary service pillar
- electrical fault finding has dedicated architecture
- symptom-led navigation works
- module diagnostics has dedicated content
- fault-code messaging does not overpromise actual diagnosis

## Booking

- Calendly works
- Calendly only loads when needed
- customer details can be prefilled where supported
- booking UX preserves vehicle/service context

## Mobile Mechanic

- dedicated SEO landing page exists
- current location/postcode can be collected
- vehicle and problem can be submitted
- WhatsApp/call actions work
- no unsupported emergency-response promises are made

## Repairs

- verified repair services are represented
- clutch service is correctly marked as outsourced specialist work
- tyre services are excluded
- air-conditioning scope is not exaggerated

## Vehicle Sales

- inventory page works
- individual vehicle pages work
- enquiry flow works
- finance wording is configurable
- warranty is vehicle-specific
- sold vehicle handling is implemented

## SEO

- critical content is server rendered
- metadata is unique
- canonicals are correct
- sitemap works
- robots rules are correct
- structured data is valid
- breadcrumbs work
- internal linking is intentional
- location pages are unique
- no keyword stuffing
- no thin city/service page explosion
- primary client keywords map to intentional landing pages

## Trust

- only genuine Google Reviews are used
- no fake testimonials
- no fake awards
- no fake insurance approval
- no unsupported accreditation claims
- no fabricated statistics

## Performance

- images are optimised
- Calendly is deferred
- live chat is deferred
- Core Web Vitals targets are pursued
- mobile-first UX is strong

## Security

- vehicle-provider API keys remain server-side
- registration lookup is rate-limited
- forms are validated server-side
- uploads are restricted
- registrations are excluded from analytics URLs and ordinary logs

## Critical Business Rule

**There must be no MOT service, MOT pre-check, MOT reminder, MOT page, MOT SEO target, MOT pricing, MOT structured data or MOT booking option anywhere in the finished website.**
