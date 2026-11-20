from django.conf import settings
from django.test import Client, TestCase
from apps.accounts.models import User
from config.settings import PROPTECH_DESIGN_TOKENS


class AdminBrandIdentityTokenTests(TestCase):
    """
    Verification tests for PropTech brand identity tokens and styling:
    - Primary: #408A71
    - Light accent: #A5E0CB
    - Hover: #34745C
    - Deep green: #0B493A
    - Main background: #F9FAFB
    - Surface: #FFFFFF
    - Primary text: #111827
    - Secondary text: #64748B
    - Borders: #E8EEEB
    - Subtle green background: #EAF6F0
    """

    def setUp(self):
        self.client = Client(SERVER_NAME="localhost")
        self.superuser = User.objects.create_superuser(
            email="brand_admin@example.com",
            password="AdminPassword123!",
            first_name="Brand",
            last_name="Manager",
        )

    def test_design_tokens_exact_values(self):
        """Verify centralized design tokens match the established brand identity."""
        expected_tokens = {
            "primary": "#408A71",
            "light_accent": "#A5E0CB",
            "hover": "#34745C",
            "deep_green": "#0B493A",
            "main_bg": "#F9FAFB",
            "surface": "#FFFFFF",
            "primary_text": "#111827",
            "secondary_text": "#64748B",
            "borders": "#E8EEEB",
            "subtle_green_bg": "#EAF6F0",
        }
        for token, expected_hex in expected_tokens.items():
            self.assertEqual(
                PROPTECH_DESIGN_TOKENS.get(token),
                expected_hex,
                f"Token {token} mismatch: expected {expected_hex}, got {PROPTECH_DESIGN_TOKENS.get(token)}",
            )

    def test_unfold_colors_mapping(self):
        """Verify Unfold COLORS dictionary in settings maps to the correct tokens."""
        unfold_colors = settings.UNFOLD["COLORS"]

        # Primary scale
        self.assertEqual(unfold_colors["primary"]["50"], "#EAF6F0")  # Subtle green background
        self.assertEqual(unfold_colors["primary"]["200"], "#A5E0CB")  # Light accent
        self.assertEqual(unfold_colors["primary"]["500"], "#408A71")  # Primary
        self.assertEqual(unfold_colors["primary"]["600"], "#408A71")  # Primary
        self.assertEqual(unfold_colors["primary"]["700"], "#34745C")  # Hover
        self.assertEqual(unfold_colors["primary"]["900"], "#0B493A")  # Deep green

        # Base scale
        self.assertEqual(unfold_colors["base"]["50"], "#F9FAFB")  # Main background
        self.assertEqual(unfold_colors["base"]["200"], "#E8EEEB")  # Borders
        self.assertEqual(unfold_colors["base"]["500"], "#64748B")  # Secondary text
        self.assertEqual(unfold_colors["base"]["900"], "#111827")  # Primary text

    def test_rendered_admin_html_has_brand_tokens_and_stylesheet(self):
        """Verify admin pages render the brand token stylesheet and CSS variables."""
        self.client.force_login(self.superuser)
        res = self.client.get("/admin/")
        self.assertEqual(res.status_code, 200)
        content = res.content.decode("utf-8")

        # 1. Stylesheet inclusion
        self.assertIn("admin/css/proptech_tokens.css", content)

        # 2. Converted RGB values in <style id="unfold-theme-colors">
        # rgb(64, 138, 113) is #408A71
        self.assertIn("--color-primary-600: rgb(64, 138, 113)", content)
        # rgb(52, 116, 92) is #34745C
        self.assertIn("--color-primary-700: rgb(52, 116, 92)", content)
        # rgb(234, 246, 240) is #EAF6F0
        self.assertIn("--color-primary-50: rgb(234, 246, 240)", content)
        # rgb(249, 250, 251) is #F9FAFB
        self.assertIn("--color-base-50: rgb(249, 250, 251)", content)
        # rgb(232, 238, 235) is #E8EEEB
        self.assertIn("--color-base-200: rgb(232, 238, 235)", content)

        # 3. Old default bright emerald OKLCH must be absent
        self.assertNotIn("oklch(59.6% 0.145 163.225)", content)

    def test_tokens_stylesheet_served_200(self):
        """Verify the proptech_tokens.css file is found by staticfiles finder and contains brand tokens."""
        from django.contrib.staticfiles.finders import find

        css_path = find("admin/css/proptech_tokens.css")
        self.assertIsNotNone(css_path, "proptech_tokens.css not found in staticfiles search path")
        with open(css_path, "r", encoding="utf-8") as f:
            content = f.read()
        self.assertIn("--proptech-primary: #408A71;", content)
        self.assertIn("--proptech-light-accent: #A5E0CB;", content)
        self.assertIn("--proptech-hover: #34745C;", content)
        self.assertIn("--proptech-deep-green: #0B493A;", content)
        self.assertIn("--proptech-subtle-green-bg: #EAF6F0;", content)
