from django.db import migrations, models


class Migration(migrations.Migration):
    """Step 1/3 of adding Participant.carpool_token.

    Nullable, no default: safe to add to the existing populated table since
    Postgres allows multiple NULLs under a UNIQUE constraint. A callable
    default here would be evaluated once and applied as a single literal to
    every existing row, violating uniqueness (confirmed via
    `manage.py makemigrations`, which refuses to autogenerate this and points
    at this exact multi-step pattern).
    """

    dependencies = [
        ('core', '0003_eventstatus_assignment_email_body_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='participant',
            name='carpool_token',
            field=models.CharField(max_length=43, null=True, unique=True, editable=False),
        ),
    ]
