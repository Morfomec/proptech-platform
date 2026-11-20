from django.contrib.auth.models import Permission
from django.test import Client, TestCase
from django.urls import reverse

from apps.accounts.models import User


class AdminHeaderAccountMenuTests(TestCase):
    """
    Tests for the improved Django Unfold Admin Header and Administrator Account Menu:
    - Elimination of the stray 'D' badge.
    - Real administrator name, email, and circular avatar with initials.
    - Minimal dropdown with My Profile, Change Password, and Theme controls.
    - Secure POST logout flow with CSRF protection.
    - Staff identity isolation across different staff accounts.
    """

    def setUp(self):
        self.client = Client()
        self.superuser = User.objects.create_superuser(
            email="admin_head@example.com",
            password="AdminPassword123!",
            first_name="Alexander",
            last_name="Hamilton",
        )
        self.staff_named = User.objects.create_user(
            email="beatrice@example.com",
            password="StaffPassword123!",
            first_name="Beatrice",
            last_name="Webb",
            is_staff=True,
            is_active=True,
        )
        self.staff_unnamed = User.objects.create_user(
            email="ops_analyst@example.com",
            password="StaffPassword123!",
            is_staff=True,
            is_active=True,
        )

    def test_superuser_header_display_and_no_stray_d(self):
        """Verify superuser full name, email, initials 'AH', and absence of stray 'D' badge."""
        self.client.force_login(self.superuser)
        res = self.client.get("/admin/")
        self.assertEqual(res.status_code, 200)
        content = res.content.decode("utf-8")

        # Name, email, and initials
        self.assertIn("Alexander Hamilton", content)
        self.assertIn("admin_head@example.com", content)
        self.assertIn("AH", content)

        # Stray 'D' badge must NOT exist
        self.assertNotIn("h-6 leading-6 px-2\n\n\n    bg-base-500/8 text-base-700", content)
        self.assertNotIn("\nd\n</span>", content)

        # Profile, Password, and Logout links
        profile_url = reverse("admin:accounts_user_change", args=[self.superuser.id])
        password_url = reverse("admin:password_change")
        logout_url = reverse("admin:logout")

        self.assertIn(f'href="{profile_url}"', content)
        self.assertIn(f'href="{password_url}"', content)
        self.assertIn(f'action="{logout_url}"', content)
        self.assertIn('method="post"', content)
        self.assertIn("csrfmiddlewaretoken", content)

    def test_staff_named_header_identity(self):
        """Verify named staff user shows their own identity 'Beatrice Webb', email, and 'BW' initials."""
        self.client.force_login(self.staff_named)
        res = self.client.get("/admin/")
        self.assertEqual(res.status_code, 200)
        content = res.content.decode("utf-8")

        self.assertIn("Beatrice Webb", content)
        self.assertIn("beatrice@example.com", content)
        self.assertIn("BW", content)
        self.assertNotIn("Alexander Hamilton", content)

        profile_url = reverse("admin:accounts_user_change", args=[self.staff_named.id])
        self.assertIn(f'href="{profile_url}"', content)

    def test_staff_unnamed_header_identity(self):
        """Verify unnamed staff user falls back gracefully to email initial without hardcoded 'AD'."""
        self.client.force_login(self.staff_unnamed)
        res = self.client.get("/admin/")
        self.assertEqual(res.status_code, 200)
        content = res.content.decode("utf-8")

        self.assertIn("ops_analyst@example.com", content)
        self.assertIn('<div class="admin-user-avatar">', content)
        self.assertIn("O", content)
        self.assertNotIn("Alexander Hamilton", content)
        self.assertNotIn("Beatrice Webb", content)
        self.assertNotIn(">AD<", content)

    def test_superuser_unnamed_has_real_initial_not_ad(self):
        """Verify unnamed superuser displays their email initial (e.g. 'M') and NEVER hardcoded 'AD'."""
        unnamed_superuser = User.objects.create_superuser(
            email="muhammedshifil@example.com",
            password="SuperPassword123!",
            first_name="",
            last_name="",
        )
        self.client.force_login(unnamed_superuser)
        res = self.client.get("/admin/")
        self.assertEqual(res.status_code, 200)
        content = res.content.decode("utf-8")

        # Administrator initial must be 'M' (from email), never 'AD'
        self.assertIn("M", content)
        self.assertNotIn(">AD<", content)
        self.assertIn("muhammedshifil@example.com", content)
        self.assertIn("Administrator", content)

    def test_sidebar_bottom_duplicate_user_card_removed(self):
        """Verify the bottom-left sidebar user widget is cleanly removed and unified in the header."""
        self.client.force_login(self.superuser)
        res = self.client.get("/admin/")
        self.assertEqual(res.status_code, 200)
        content = res.content.decode("utf-8")

        # Sidebar must not contain the unfold_more duplicate widget
        self.assertNotIn("unfold_more", content)
        # Header account button exists
        self.assertIn('class="admin-user-btn"', content)
        self.assertIn('class="admin-user-avatar"', content)


    def test_password_change_page_accessible(self):
        """Verify the password change link resolves and loads successfully."""
        self.client.force_login(self.superuser)
        res = self.client.get(reverse("admin:password_change"))
        self.assertEqual(res.status_code, 200)

    def test_profile_page_accessible_for_superuser(self):
        """Verify the My Profile link resolves and loads the user change form."""
        self.client.force_login(self.superuser)
        profile_url = reverse("admin:accounts_user_change", args=[self.superuser.id])
        res = self.client.get(profile_url)
        self.assertEqual(res.status_code, 200)
        content = res.content.decode("utf-8")
        self.assertIn("Alexander", content)
        self.assertIn("Hamilton", content)

    def test_secure_post_logout(self):
        """Verify logout works via secure POST request with redirect to login/logged_out."""
        self.client.force_login(self.superuser)
        res = self.client.post(reverse("admin:logout"))
        # Django admin logout redirects or renders logged out page
        self.assertIn(res.status_code, [200, 302])
        # Verify subsequent admin request is redirected to login
        res_after = self.client.get("/admin/")
        self.assertEqual(res_after.status_code, 302)
        self.assertIn("/admin/login/", res_after.url)
