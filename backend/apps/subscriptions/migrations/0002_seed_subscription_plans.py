from decimal import Decimal
from django.db import migrations

INITIAL_PLANS = [
    {
        "name": "Starter",
        "code": "starter",
        "min_properties": 1,
        "max_properties": 5,
        "monthly_price": Decimal("399.00"),
        "currency": "INR",
        "trial_duration_months": 3,
        "is_active": True,
    },
    {
        "name": "Growth",
        "code": "growth",
        "min_properties": 6,
        "max_properties": 12,
        "monthly_price": Decimal("799.00"),
        "currency": "INR",
        "trial_duration_months": 3,
        "is_active": True,
    },
    {
        "name": "Pro",
        "code": "pro",
        "min_properties": 13,
        "max_properties": 25,
        "monthly_price": Decimal("1199.00"),
        "currency": "INR",
        "trial_duration_months": 3,
        "is_active": True,
    },
    {
        "name": "Enterprise",
        "code": "enterprise",
        "min_properties": 26,
        "max_properties": None,
        "monthly_price": None,
        "currency": "INR",
        "trial_duration_months": 3,
        "is_active": True,
    },
]


def seed_subscription_plans(apps, schema_editor):
    SubscriptionPlan = apps.get_model("subscriptions", "SubscriptionPlan")
    for plan_data in INITIAL_PLANS:
        code = plan_data["code"]
        plan, created = SubscriptionPlan.objects.get_or_create(
            code=code,
            defaults=plan_data,
        )
        # If plan already existed, do not overwrite custom updates, but ensure it's marked active if needed
        if not created and not plan.is_active:
            plan.is_active = True
            plan.save(update_fields=["is_active"])


def reverse_seed_subscription_plans(apps, schema_editor):
    SubscriptionPlan = apps.get_model("subscriptions", "SubscriptionPlan")
    SubscriptionPlan.objects.filter(
        code__in=[p["code"] for p in INITIAL_PLANS]
    ).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("subscriptions", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(
            seed_subscription_plans,
            reverse_code=reverse_seed_subscription_plans,
        ),
    ]

