"""
django-import-export resources backing the CSV download/upload buttons on
the Django admin changelists (see admin.py).

Rows are matched on their primary key (``id``), so a downloaded CSV can be
edited and uploaded again to update rows in place; rows with an empty ``id``
are inserted as new. Foreign keys are written as the related row's id, with
read-only ``*_name`` columns next to them for humans -- those are ignored on
upload.
"""

import uuid

from import_export import fields, resources, widgets

from .models import Assignment, CarpoolMessage, Participant, Restaurant


class _UUIDResource(resources.ModelResource):
    """Upsert by UUID primary key; blank ``id`` means "create a new row"."""

    def before_import_row(self, row, **kwargs):
        if not (row.get('id') or '').strip():
            row['id'] = str(uuid.uuid4())

    class Meta:
        abstract = True
        import_id_fields = ['id']
        skip_unchanged = True
        report_skipped = True


class ParticipantResource(_UUIDResource):
    class Meta(_UUIDResource.Meta):
        model = Participant
        # carpool_token is the bearer secret for the participant magic link:
        # never put it in a downloadable file. New rows get a fresh one.
        exclude = ['carpool_token']


class RestaurantResource(_UUIDResource):
    assigned_captain = fields.Field(
        attribute='assigned_captain',
        column_name='assigned_captain',
        widget=widgets.ForeignKeyWidget(Participant, 'id'),
    )
    assigned_captain_name = fields.Field(
        attribute='assigned_captain__attendee_name',
        column_name='assigned_captain_name',
        readonly=True,
    )

    class Meta(_UUIDResource.Meta):
        model = Restaurant


class AssignmentResource(_UUIDResource):
    participant = fields.Field(
        attribute='participant',
        column_name='participant',
        widget=widgets.ForeignKeyWidget(Participant, 'id'),
    )
    participant_name = fields.Field(
        attribute='participant__attendee_name',
        column_name='participant_name',
        readonly=True,
    )
    restaurant = fields.Field(
        attribute='restaurant',
        column_name='restaurant',
        widget=widgets.ForeignKeyWidget(Restaurant, 'id'),
    )
    restaurant_name = fields.Field(
        attribute='restaurant__name',
        column_name='restaurant_name',
        readonly=True,
    )

    class Meta(_UUIDResource.Meta):
        model = Assignment
        # A participant has at most one assignment, so match on it: uploading
        # "participant,restaurant" pairs moves people without knowing row ids.
        # The row id is left out entirely; new assignments get a fresh one.
        import_id_fields = ['participant']
        exclude = ['id']

    def before_import_row(self, row, **kwargs):
        pass


class CarpoolMessageResource(_UUIDResource):
    restaurant = fields.Field(
        attribute='restaurant',
        column_name='restaurant',
        widget=widgets.ForeignKeyWidget(Restaurant, 'id'),
    )
    restaurant_name = fields.Field(
        attribute='restaurant__name',
        column_name='restaurant_name',
        readonly=True,
    )
    sender = fields.Field(
        attribute='sender',
        column_name='sender',
        widget=widgets.ForeignKeyWidget(Participant, 'id'),
    )
    sender_name = fields.Field(
        attribute='sender__attendee_name',
        column_name='sender_name',
        readonly=True,
    )

    class Meta(_UUIDResource.Meta):
        model = CarpoolMessage
