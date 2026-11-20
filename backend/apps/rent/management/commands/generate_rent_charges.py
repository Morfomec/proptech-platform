from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.rent.services import (
    backfill_missing_initial_charges,
    generate_due_rent_charges_batch,
)


class Command(BaseCommand):
    help = "Generates monthly rent charges for active tenancies for the current or specified billing cycle."

    def add_arguments(self, parser):
        parser.add_argument(
            "--date",
            type=str,
            help="Target date in YYYY-MM-DD format (defaults to current date).",
        )
        parser.add_argument(
            "--backfill-initial",
            action="store_true",
            help="Also backfill missing initial rent and security deposit charges for active tenancies.",
        )

    def handle(self, *args, **options):
        if options.get("backfill_initial"):
            self.stdout.write("Backfilling missing initial charges for active tenancies...")
            initial_charges = backfill_missing_initial_charges()
            self.stdout.write(
                self.style.SUCCESS(
                    f"Backfilled/verified {len(initial_charges)} initial charge(s)."
                )
            )

        date_str = options.get("date")
        if date_str:
            target_date = timezone.datetime.strptime(date_str, "%Y-%m-%d").date()
        else:
            target_date = timezone.localdate()

        self.stdout.write(f"Generating rent charges for cycle {target_date.strftime('%B %Y')}...")
        charges = generate_due_rent_charges_batch(target_date=target_date)
        self.stdout.write(
            self.style.SUCCESS(f"Successfully processed batch. {len(charges)} rent charge(s) generated/verified.")
        )

