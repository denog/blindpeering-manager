"""
Default content for the editable email templates stored on EventStatus.

These are the fallback values used when the EventStatus row is first created;
after that, the DB-stored fields are the source of truth and can be edited via
the API/admin. Bodies are rendered with `str.format(**data)`, so any `{name}`
token here must correspond to a key produced by EmailService.
"""

DEFAULT_ASSIGNMENT_EMAIL_SUBJECT = "Pre-Social - Your Restaurant Assignment"

DEFAULT_ASSIGNMENT_EMAIL_BODY = """Dear participant,

We're excited that you join the {event_name} on {event_date}!

Your assigned restaurant: {restaurant_name}
Address: {restaurant_address}

How to get there:
{taxi_time}
{pt_time} {pt_lines}

Your Table Captain: {captain_name}
Contact: {captain_email}{captain_phone}
{captain_contact}

Table Guests:
{table_guests}

Want to carpool or share a ride with your table? Coordinate here:
{carpool_link}

Please arrive by {arrival_time} at the restaurant to ensure we can start on
time. If you have any questions, please feel free to contact your
Table Captain directly.

As noted before: this social is self-paid, hence it is advisable to carry cash.

The reservation for the table is under the name "{reservation_name}".

We look forward to a wonderful evening with you!

Best regards,
Your {event_name} Team"""

DEFAULT_CAPTAIN_OVERVIEW_EMAIL_SUBJECT = "Final Guest List for the {event_name}!"

DEFAULT_CAPTAIN_OVERVIEW_EMAIL_BODY = """Hi,

Thank you again for taking on the role as Table Captain for {event_name}!

After a few adjustments, the participant list is now final and I wanted to share the complete overview of your table with you.

{restaurant_name}
{restaurant_address}

Captain: {captain_name} ({captain_email})

{guest_list}

All guests received their table assignment, so everyone should be aware of the arrangements.

Enjoy the evening!

Best regards,
Your {event_name} Team"""
