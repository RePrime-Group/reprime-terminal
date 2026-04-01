The Investor Portal includes an appointment booking module that allows authenticated investors to schedule one-on-one meetings with the admin directly within the platform. Instead of coordinating over email or using external tools, investors can view the admin's real-time availability and book a suitable time slot in a few clicks. The booking is confirmed instantly, and both the investor and the admin receive a calendar invite and email confirmation automatically. This streamlines communication between investors and the admin, making the scheduling process faster and more professional.

---

**What Gets Embedded**

That exact UI in your screenshot gets rendered inside your investor portal via an iframe. No backend, no API, no service account needed.

---

**Implementation Plan**

**Step 1: Get the Embeddable URL**

The short URL `https://calendar.app.google/yvUaTqGJwa6Qdae48` will not work in an iframe due to redirect behavior. The admin needs to:

1. Open Google Calendar on desktop
2. Click the appointment schedule block
3. Click "Open booking page" > Share
4. Under "Website embed" > copy the iframe `src` URL

It will be in this format:

```
https://calendar.google.com/calendar/appointments/schedules/<SCHEDULE_ID>
```

---

**Step 2: Build the Component**

```jsx
// components/BookingCalendar.jsx

const BOOKING_URL =
  "https://calendar.google.com/calendar/appointments/schedules/YOUR_SCHEDULE_ID";

export default function BookingCalendar() {
  return (
    <div className="w-full rounded-xl overflow-hidden border border-gray-200 shadow-sm">
      <iframe
        src={`${BOOKING_URL}?_height=700`}
        style={{ border: 0 }}
        width="100%"
        height="700"
        allowFullScreen
        title="Book an Appointment"
      />
    </div>
  );
}
```

---

**Step 3: Add to Investor Dashboard Route**

```jsx
// app/investor/book-appointment/page.jsx

import BookingCalendar from "@/components/BookingCalendar";

export default function BookAppointmentPage() {
  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold mb-4">Book an Appointment</h1>
      <BookingCalendar />
    </div>
  );
}
```

Add the route to your investor sidebar nav pointing to `/investor/book-appointment`.

---

**Step 4: Protect the Route**

Since all investors are authenticated, wrap the route in your existing auth middleware/guard. No additional logic needed.

```jsx
// middleware.js (Next.js)
// Ensure /investor/* routes are protected — already handled by your auth layer
```

---

**What Works Out of the Box**

| Feature                                        | Status                                  |
| ---------------------------------------------- | --------------------------------------- |
| Live availability from admin's Google Calendar | Works                                   |
| Slot selection UI (as in screenshot)           | Works                                   |
| Booking confirmation email to investor         | Works (Google handles it)               |
| Calendar invite to both parties                | Works (Google handles it)               |
| Admin notification email                       | Works (Google handles it)               |
| 60 min slot duration                           | Already configured in the schedule      |
| Timezone display                               | Works (shows PST/investor's local time) |

---

**Known Limitations to Communicate to Client**

| Limitation                                             | Impact                                |
| ------------------------------------------------------ | ------------------------------------- |
| Google branding visible ("Powered by Google Calendar") | Cannot be removed                     |
| Investor name/email not pre-filled                     | They must type it manually on booking |
| Booking data not stored in your DB                     | No booking history inside the portal  |
| Cancel/reschedule done via Google email link           | Not possible from within the portal   |
| Zero styling control                                   | Always looks like Google's UI         |

---
