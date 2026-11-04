# SOB Auto Exchange: staff guide

Sign in at `sobautofix.com/admin` as usual. Everything is under **Vehicle Buying & Selling** and **Autofix Diary** in the menu. On a phone, use the bar at the bottom: Today, Diary, **+ New**, Customers, More.

## First-time setup (owner)

Settings tab:
- Business name and contact details (default: SOB Auto Exchange, using the main SOB phone and email).
- **Notification recipients**: who gets new enquiry emails.
- Policy wording (sales terms, reservations, seller privacy, complaints). Until you add it, customers see "We are finalising this information".
- Handover checklist steps, reservation hold days, photos needed to publish (default 4).
- Staff roles are managed in **Staff & access** (see below).

## Staff & access (owners only)

Menu: **System → Staff & access** (`/admin/staff`). Only owners see it.

- **Invite**: enter the person's name, email and role, then **Send invite**. They get an email with a link to choose a password; the link works once and expires. If the email cannot be sent, the page shows the link instead: send it to them privately (text or WhatsApp), never anywhere public. **Resend invite** sends a fresh link if theirs expired.
- **Change a role or name**: **Edit** on their row. You cannot change your own role, and there must always be at least one owner.
- **Remove access**: signs them out straight away and stops them signing in. Their past work and history stay. **Restore access** brings them back with the same password and role.
- **Recent changes** lists every invite, role change, removal and restore, and who made it.
- Ask everyone to turn on two-step verification (Security in the menu). The list shows who has it on.

| Role | Can | Cannot |
| --- | --- | --- |
| Owner | Everything | |
| Manager | Everything else, including invoices, costs, prices, website content and pricing | Staff & access, website settings, Vehicle Buying & Selling settings |
| Sales | Enquiries, bookings, stock listings and photos, buying and selling conversations, offers to sellers, diary, customers | Invoices, costs and margins, prices, publishing, website content, settings, staff |
| Workshop | Enquiries, bookings, preparation, inspections, documents, diary | Customer contact details, stock edits, money, website content, settings, staff |

The full list is on the Staff & access page under **What each role can do**.

## Selling a car

1. **Vehicle Stock → Add vehicle**: enter the registration, check the details, save as a Draft.
2. Open the car. Fill in **Listing**, **Photos** (at least 4), and **Condition & disclosure**. Be specific: known faults, work done, write-off status. Leave anything unknown blank and the website shows "Not confirmed". Never guess.
3. Move it to **Preparation** while work is done; track jobs in **Preparation & Inspections**.
4. **Status & publishing → Available** publishes it. The checklist shows what's missing.
5. Viewing requests appear in **Viewings & Appointments** and the diary as *requested*. **Confirm** (the customer is emailed), **Propose another time**, or **Decline**.
6. Buyer questions appear in **Sales Enquiries**. Reply from the conversation; it is emailed and kept on the record.
7. Agreed a sale? **Reserve this vehicle** on the enquiry. The car shows as Reserved on the website.
8. **Sales & Handover**: record payments as they arrive (nothing is charged online), tick the handover checklist, then **Complete sale**. The car shows as Sold straight away.
9. Sale fallen through? **Cancel reservation** and the car goes back on sale.

## Buying a car

1. Seller and part-exchange enquiries arrive in **Buying Enquiries** with photos and condition answers.
2. Assign yourself and reply from the conversation.
3. **Record an offer** (provisional, revised or final) with conditions and an expiry. Every offer is kept in the history.
4. Book an inspection from the enquiry; record the findings afterwards.
5. **Mark purchased** (owner or manager), then **Create stock draft**. Only the vehicle facts are copied; the seller's details stay private.
6. Declined or not going ahead? **Decline** or **Close**. Photos and the registration are removed automatically after the retention period.

## Costs and reports

Owners and managers only. Add cost lines on each car (purchase, transport, repairs, parts, valeting, fees), marked **Estimated** or **Actual**. **Costs & Reporting** shows gross margin = sale price minus those costs. It excludes overheads, staff time and tax, so it is not profit.

## Autofix Diary

One diary for workshop bookings and exchange appointments. Dashed entries are requests that are not yet confirmed. Workshop bookings are rescheduled from the booking page as before. The diary warns about clashes; if you go ahead anyway, give a reason.

## If something goes wrong

- **"Email failed"** on the Overview: the enquiry is saved; press **Retry email**. The system also retries automatically up to 3 times.
- **"Changed by someone else"**: reload the page; your typed text stays until you leave.
- **"Database update needed"**: the new tables have not been installed yet. Tell the site administrator (see OPERATIONS.md).
