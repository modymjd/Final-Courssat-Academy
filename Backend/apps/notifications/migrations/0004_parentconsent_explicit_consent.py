from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("notifications", "0003_parentconsent_linking_code_and_more"),
    ]

    operations = [
        migrations.AlterField(
            model_name="parentconsent",
            name="consent_given",
            field=models.BooleanField(default=False),
        ),
        migrations.AlterField(
            model_name="parentconsent",
            name="consent_given_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
