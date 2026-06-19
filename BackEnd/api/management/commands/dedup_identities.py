from django.core.management.base import BaseCommand
from api.views.dedup import run_identity_dedup


class Command(BaseCommand):
    help = "Cross-match face embeddings and merge duplicate TrackedPerson identities."

    def add_arguments(self, parser):
        parser.add_argument('--threshold', type=float, default=0.55)

    def handle(self, *args, **options):
        summary = run_identity_dedup(threshold=options['threshold'])
        self.stdout.write(self.style.SUCCESS(f"Dedup complete: {summary}"))
