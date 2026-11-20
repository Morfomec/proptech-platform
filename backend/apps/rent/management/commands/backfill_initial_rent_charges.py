from django.core.management.base import BaseCommand

from apps.rent.services import backfill_missing_initial_charges


class Command(BaseCommand):
    help = "Backfills missing initial rent and security deposit charges for active tenancies idempotently."

    def add_arguments(self, parser):
        parser.add_argument(
            "--tenancy",
            type=str,
            help="Optional tenancy UUID to backfill for a single tenancy.",
        )

    def handle(self, *args, **options):
        tenancy_id = options.get("tenancy")
        self.stdout.write("Checking for active tenancies missing initial charges...")
        charges = backfill_missing_initial_charges(tenancy_id=tenancy_id)
        if charges:
            self.stdout.write(
                self.style.SUCCESS(
                    f"Successfully generated/verified {len(charges)} initial charge(s) across active tenancies."
                )
            )
            for c in charges:
                self.stdout.write(
                    f" - Tenancy {c.tenancy_id} ({c.tenancy.property.title}): {c.charge_type} of ₹{c.amount} (due {c.due_date})"
                )
        else:
            self.stdout.write(
                self.style.SUCCESS(
                    "All active tenancies already have their initial charges. No changes needed."
                )
            )

