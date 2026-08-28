from django.db import migrations, models

import core.models


class Migration(migrations.Migration):
    """Step 3/3: every row is now populated, so NOT NULL is safe to apply."""

    dependencies = [
        ('core', '0005_backfill_carpool_tokens'),
    ]

    operations = [
        migrations.AlterField(
            model_name='participant',
            name='carpool_token',
            field=models.CharField(
                default=core.models.generate_carpool_token,
                editable=False,
                help_text='Unguessable bearer token for the participant carpool magic link',
                max_length=43,
                unique=True,
            ),
        ),
    ]
