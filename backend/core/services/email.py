"""
Email service for sending emails via SendGrid or SMTP.
"""

import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

import requests
from django.conf import settings
from core.models import Participant, Restaurant, EmailLog, EventStatus


class EmailService:
    """Service for sending emails via SendGrid API or SMTP."""

    def __init__(self):
        self.backend = getattr(settings, "EMAIL_BACKEND_TYPE", "sendgrid")
        self.api_key = settings.SENDGRID_API_KEY
        self.from_email = settings.EMAIL_SENDER_ADDRESS
        self.from_name = settings.EMAIL_SENDER_NAME
        # SMTP settings
        self.smtp_host = getattr(settings, "EMAIL_SMTP_HOST", "localhost")
        self.smtp_port = getattr(settings, "EMAIL_SMTP_PORT", 1025)

    def _build_template_data(self, participant, restaurant, captain, table_guests):
        """Build email template data.

        Raises:
            ValueError: If required event settings (event_date, arrival_time) or
                restaurant reservation_name are not configured.
        """
        # Get and validate event settings
        event_status = EventStatus.get_current()

        missing_fields = []
        if not event_status.event_date:
            missing_fields.append("event_date")
        if not event_status.arrival_time:
            missing_fields.append("arrival_time")
        if not restaurant.reservation_name:
            missing_fields.append(
                f"reservation_name for restaurant '{restaurant.name}'"
            )

        if missing_fields:
            raise ValueError(
                f"Cannot send email: missing required settings: {', '.join(missing_fields)}. "
                "Please configure these in the admin panel before sending emails."
            )

        # Format event date (e.g., "Sunday, November 9, 2025")
        event_date_formatted = event_status.event_date.strftime("%A, %B %-d, %Y")

        # Format arrival time (e.g., "19:00")
        arrival_time_formatted = event_status.arrival_time.strftime("%H:%M")

        taxi_time = (
            f"By Taxi: {restaurant.taxi_time} minutes" if restaurant.taxi_time else ""
        )
        pt_time = (
            f"By Public Transport: {restaurant.public_transport_time} minutes"
            if restaurant.public_transport_time
            else ""
        )
        pt_lines = restaurant.public_transport_lines or ""

        captain_name = captain.attendee_name if captain else "To be assigned"
        captain_email = captain.attendee_email if captain else ""
        captain_phone = (
            f" / {captain.captain_phone}" if captain and captain.captain_phone else ""
        )
        captain_contact = (
            f"Preferred contact methods: {captain.captain_preferred_contact}"
            if captain and captain.captain_preferred_contact
            else ""
        )

        guests_formatted = (
            "\n".join(
                [
                    f"- {g.given_name or g.attendee_name.split()[0]}"
                    for g in table_guests
                ]
            )
            if table_guests
            else "- No other guests assigned yet"
        )

        return {
            "participant_name": participant.attendee_name,
            "restaurant_name": restaurant.name,
            "restaurant_address": restaurant.address,
            "taxi_time": taxi_time,
            "pt_time": pt_time,
            "pt_lines": pt_lines,
            "captain_name": captain_name,
            "captain_email": captain_email,
            "captain_phone": captain_phone,
            "captain_contact": captain_contact,
            "table_guests": guests_formatted,
            "event_date": event_date_formatted,
            "arrival_time": arrival_time_formatted,
            "reservation_name": restaurant.reservation_name,
        }

    def _generate_email_content(self, data):
        """Generate email subject and body."""
        subject = "Pre-Social - Your Restaurant Assignment"

        body = f"""Dear participant,

We're excited that you join the Pre-Social on {data['event_date']}!

Your assigned restaurant: {data['restaurant_name']}
Address: {data['restaurant_address']}

How to get there:
{data['taxi_time']}
{data['pt_time']} {data['pt_lines']}

Your Table Captain: {data['captain_name']}
Contact: {data['captain_email']}{data['captain_phone']}
{data['captain_contact']}

Table Guests:
{data['table_guests']}

Please arrive by {data['arrival_time']} at the restaurant to ensure we can start on
time. If you have any questions, please feel free to contact your
Table Captain directly.

As noted before: this social is self-paid, hence it is advisable to carry cash.

The reservation for the table is under the name "{data['reservation_name']}".

We look forward to a wonderful evening with you!

Best regards,
Your Event Team"""

        return subject, body

    def _send_via_smtp(self, to_email, subject, body):
        """Send email via SMTP (for local development with Mailpit)."""
        msg = MIMEMultipart()
        msg["From"] = f"{self.from_name} <{self.from_email}>"
        msg["To"] = to_email
        msg["Subject"] = subject
        msg.attach(MIMEText(body, "plain"))

        with smtplib.SMTP(self.smtp_host, self.smtp_port) as server:
            server.send_message(msg)

    def _send_via_sendgrid(self, to_email, subject, body):
        """Send email via SendGrid API."""
        if not self.api_key:
            raise ValueError("SendGrid API key not configured")

        response = requests.post(
            "https://api.sendgrid.com/v3/mail/send",
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            },
            json={
                "personalizations": [{"to": [{"email": to_email}]}],
                "from": {"email": self.from_email, "name": self.from_name},
                "subject": subject,
                "content": [{"type": "text/plain", "value": body}],
            },
            timeout=30,
        )
        response.raise_for_status()

    def _send_email(self, to_email, subject, body):
        """Send email using the configured backend."""
        if self.backend == "smtp":
            self._send_via_smtp(to_email, subject, body)
        else:
            self._send_via_sendgrid(to_email, subject, body)

    def send_raw_email(self, to, subject, body):
        """Send a raw email (for testing)."""
        self._send_email(to, subject, body)

    def send_assignment_email(
        self, participant_id, restaurant_id, email_type, sent_by=None
    ):
        """Send assignment email to a participant."""
        participant = Participant.objects.get(id=participant_id)
        restaurant = Restaurant.objects.get(id=restaurant_id)

        captain = restaurant.assigned_captain
        table_guests = list(
            Participant.objects.filter(assignment__restaurant=restaurant).exclude(
                id=participant_id
            )
        )

        data = self._build_template_data(participant, restaurant, captain, table_guests)
        subject, body = self._generate_email_content(data)

        # Send email
        self._send_email(participant.attendee_email, subject, body)

        # Log email
        log = EmailLog.objects.create(
            participant=participant,
            restaurant=restaurant,
            email_type=email_type,
            recipient_email=participant.attendee_email,
            subject=subject,
            body_text=body,
            sent_by=sent_by,
            metadata={
                "restaurantName": restaurant.name,
                "captainName": captain.attendee_name if captain else None,
                "guestCount": len(table_guests),
            },
        )

        return log

    def send_bulk_emails(self, emails, sent_by=None):
        """Send emails to multiple participants.

        Returns a dict with 'sent' (list of EmailLog) and 'failed' (list of error details).
        """
        logs = []
        failures = []

        for email_data in emails:
            try:
                log = self.send_assignment_email(
                    participant_id=email_data["participant_id"],
                    restaurant_id=email_data["restaurant_id"],
                    email_type=email_data["email_type"],
                    sent_by=sent_by,
                )
                logs.append(log)
            except Exception as e:
                failures.append(
                    {
                        "participant_id": str(email_data["participant_id"]),
                        "restaurant_id": str(email_data["restaurant_id"]),
                        "error": str(e),
                    }
                )

        return {"sent": logs, "failed": failures}

    def send_captain_overview_email(self, restaurant_id, sent_by=None):
        """Send captain overview email with full guest list to the captain."""
        restaurant = Restaurant.objects.get(id=restaurant_id)
        captain = restaurant.assigned_captain

        if not captain:
            raise ValueError(f"Restaurant '{restaurant.name}' has no assigned captain")

        # Get all assigned participants (excluding captain)
        table_guests = list(
            Participant.objects.filter(
                assignment__restaurant=restaurant,
                status__in=["registered", "late_joiner"],
            )
            .exclude(id=captain.id)
            .order_by("attendee_name")
        )

        # Build guest list with full names and emails
        guests_formatted = (
            "\n".join(
                [f"- {g.attendee_name} | {g.attendee_email}" for g in table_guests]
            )
            if table_guests
            else "No guests assigned yet"
        )

        subject = "Final Guest List for the Blind Peering event!"

        body = f"""Hi,

Thank you again for taking on the role as Table Captain for the Blind Peering event!

After a few adjustments, the participant list is now final and I wanted to share the complete overview of your table with you.

{restaurant.name}
{restaurant.address}

Captain: {captain.attendee_name} ({captain.attendee_email})

{guests_formatted}

All guests received their table assignmen, so everyone should be aware of the arrangements.

Enjoy the evening!

Best regards,
Your Event Team"""

        # Send email
        self._send_email(captain.attendee_email, subject, body)

        # Log email
        log = EmailLog.objects.create(
            participant=captain,
            restaurant=restaurant,
            email_type="captain_overview",
            recipient_email=captain.attendee_email,
            subject=subject,
            body_text=body,
            sent_by=sent_by,
            metadata={
                "restaurantName": restaurant.name,
                "guestCount": len(table_guests),
            },
        )

        return log

    def send_all_captain_overviews(self, sent_by=None):
        """Send captain overview emails to all captains with assigned restaurants.

        Returns a dict with 'sent' (list of EmailLog) and 'failed' (list of error details).
        """
        logs = []
        failures = []

        restaurants_with_captains = Restaurant.objects.filter(
            assigned_captain__isnull=False
        ).select_related("assigned_captain")

        for restaurant in restaurants_with_captains:
            try:
                log = self.send_captain_overview_email(
                    restaurant_id=restaurant.id,
                    sent_by=sent_by,
                )
                logs.append(log)
            except Exception as e:
                failures.append(
                    {
                        "restaurant_id": str(restaurant.id),
                        "restaurant_name": restaurant.name,
                        "error": str(e),
                    }
                )

        return {"sent": logs, "failed": failures}
