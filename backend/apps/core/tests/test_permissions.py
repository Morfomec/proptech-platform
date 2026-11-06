import uuid
from unittest.mock import Mock

from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser
from django.test import RequestFactory, TestCase

from apps.core.permissions import (
    IsAdmin,
    IsObjectOwner,
    IsOwner,
    IsOwnerOrReadOnly,
    IsTenant,
    _check_object_ownership,
    _matches_user,
)

User = get_user_model()


class CorePermissionsUnitTests(TestCase):
    def setUp(self):
        self.factory = RequestFactory()

        self.tenant_user = User.objects.create_user(
            email="tenant_unit@example.com",
            password="password123",
            is_tenant=True,
            is_owner=False,
        )
        self.owner_user = User.objects.create_user(
            email="owner_unit@example.com",
            password="password123",
            is_tenant=False,
            is_owner=True,
        )
        self.other_owner = User.objects.create_user(
            email="other_owner_unit@example.com",
            password="password123",
            is_tenant=False,
            is_owner=True,
        )
        self.dual_user = User.objects.create_user(
            email="dual_unit@example.com",
            password="password123",
            is_tenant=True,
            is_owner=True,
        )
        self.admin_user = User.objects.create_superuser(
            email="admin_unit@example.com",
            password="password123",
        )
        self.anon_user = AnonymousUser()

    def _req(self, method="GET", user=None):
        req = getattr(self.factory, method.lower())("/")
        req.user = user or self.anon_user
        return req

    # ==========================================
    # Helper functions tests
    # ==========================================
    def test_matches_user(self):
        # Direct User object comparison
        self.assertTrue(_matches_user(self.owner_user, self.owner_user))
        self.assertFalse(_matches_user(self.owner_user, self.tenant_user))

        # UUID object comparison
        self.assertTrue(_matches_user(self.owner_user.pk, self.owner_user))
        self.assertFalse(_matches_user(self.tenant_user.pk, self.owner_user))

        # String UUID comparison
        self.assertTrue(_matches_user(str(self.owner_user.pk), self.owner_user))
        self.assertFalse(_matches_user(str(self.tenant_user.pk), self.owner_user))

        # None / Invalid comparisons
        self.assertFalse(_matches_user(None, self.owner_user))
        self.assertFalse(_matches_user(self.owner_user, None))
        self.assertFalse(_matches_user(None, None))

    def test_check_object_ownership(self):
        # Direct owner
        self.assertTrue(_check_object_ownership(self.owner_user, Mock(owner=self.owner_user)))
        self.assertTrue(_check_object_ownership(self.owner_user, Mock(owner_id=self.owner_user.pk)))
        self.assertFalse(_check_object_ownership(self.owner_user, Mock(owner=self.tenant_user)))

        # Direct tenant
        self.assertTrue(_check_object_ownership(self.tenant_user, Mock(tenant=self.tenant_user)))
        self.assertTrue(_check_object_ownership(self.tenant_user, Mock(tenant_id=self.tenant_user.pk)))

        # Direct applicant
        self.assertTrue(_check_object_ownership(self.tenant_user, Mock(applicant=self.tenant_user)))
        self.assertTrue(_check_object_ownership(self.tenant_user, Mock(applicant_id=self.tenant_user.pk)))

        # Direct user
        self.assertTrue(_check_object_ownership(self.tenant_user, Mock(user=self.tenant_user)))
        self.assertTrue(_check_object_ownership(self.tenant_user, Mock(user_id=self.tenant_user.pk)))

        # Nested property.owner
        prop_obj = Mock(property=Mock(owner=self.owner_user))
        self.assertTrue(_check_object_ownership(self.owner_user, prop_obj))
        self.assertFalse(_check_object_ownership(self.other_owner, prop_obj))

        # Unauthenticated user
        self.assertFalse(_check_object_ownership(self.anon_user, Mock(owner=self.owner_user)))
        self.assertFalse(_check_object_ownership(None, Mock(owner=self.owner_user)))

    # ==========================================
    # IsTenant, IsOwner, IsAdmin tests
    # ==========================================
    def test_basic_role_permissions(self):
        tenant_perm = IsTenant()
        self.assertTrue(tenant_perm.has_permission(self._req("GET", self.tenant_user), None))
        self.assertTrue(tenant_perm.has_permission(self._req("GET", self.dual_user), None))
        self.assertFalse(tenant_perm.has_permission(self._req("GET", self.owner_user), None))
        self.assertFalse(tenant_perm.has_permission(self._req("GET", self.anon_user), None))

        owner_perm = IsOwner()
        self.assertTrue(owner_perm.has_permission(self._req("GET", self.owner_user), None))
        self.assertTrue(owner_perm.has_permission(self._req("GET", self.dual_user), None))
        self.assertFalse(owner_perm.has_permission(self._req("GET", self.tenant_user), None))
        self.assertFalse(owner_perm.has_permission(self._req("GET", self.anon_user), None))

        admin_perm = IsAdmin()
        self.assertTrue(admin_perm.has_permission(self._req("GET", self.admin_user), None))
        self.assertFalse(admin_perm.has_permission(self._req("GET", self.owner_user), None))
        self.assertFalse(admin_perm.has_permission(self._req("GET", self.tenant_user), None))
        self.assertFalse(admin_perm.has_permission(self._req("GET", self.anon_user), None))

    # ==========================================
    # IsOwnerOrReadOnly tests
    # ==========================================
    def test_is_owner_or_read_only(self):
        perm = IsOwnerOrReadOnly()
        own_obj = Mock(owner=self.owner_user)
        other_obj = Mock(owner=self.other_owner)

        # 1. Anonymous safe request
        self.assertTrue(perm.has_permission(self._req("GET", self.anon_user), None))
        self.assertTrue(perm.has_permission(self._req("HEAD", self.anon_user), None))
        self.assertTrue(perm.has_permission(self._req("OPTIONS", self.anon_user), None))
        self.assertTrue(perm.has_object_permission(self._req("GET", self.anon_user), None, own_obj))

        # 2. Tenant safe request
        self.assertTrue(perm.has_permission(self._req("GET", self.tenant_user), None))
        self.assertTrue(perm.has_object_permission(self._req("GET", self.tenant_user), None, own_obj))

        # 3. Tenant write request denied
        self.assertFalse(perm.has_permission(self._req("POST", self.tenant_user), None))
        self.assertFalse(perm.has_permission(self._req("PUT", self.tenant_user), None))
        self.assertFalse(perm.has_permission(self._req("PATCH", self.tenant_user), None))
        self.assertFalse(perm.has_permission(self._req("DELETE", self.tenant_user), None))
        self.assertFalse(perm.has_object_permission(self._req("POST", self.tenant_user), None, own_obj))
        self.assertFalse(perm.has_object_permission(self._req("PATCH", self.tenant_user), None, own_obj))

        # 4. Owner safe request
        self.assertTrue(perm.has_permission(self._req("GET", self.owner_user), None))
        self.assertTrue(perm.has_object_permission(self._req("GET", self.owner_user), None, own_obj))

        # 5. Owner modifying own object allowed
        self.assertTrue(perm.has_permission(self._req("POST", self.owner_user), None))
        self.assertTrue(perm.has_permission(self._req("POST", self.dual_user), None))
        self.assertTrue(perm.has_object_permission(self._req("PUT", self.owner_user), None, own_obj))
        self.assertTrue(perm.has_object_permission(self._req("PATCH", self.owner_user), None, own_obj))
        self.assertTrue(perm.has_object_permission(self._req("DELETE", self.owner_user), None, own_obj))

        # 6. Owner modifying another owner's object denied
        self.assertFalse(perm.has_object_permission(self._req("PUT", self.owner_user), None, other_obj))
        self.assertFalse(perm.has_object_permission(self._req("PATCH", self.owner_user), None, other_obj))
        self.assertFalse(perm.has_object_permission(self._req("DELETE", self.owner_user), None, other_obj))

    # ==========================================
    # IsObjectOwner tests
    # ==========================================
    def test_is_object_owner(self):
        perm = IsObjectOwner()

        # 1. Correct direct owner (by instance, by UUID pk, by str pk)
        obj_owner_inst = Mock(owner=self.owner_user, spec=["owner"])
        obj_owner_id = Mock(owner_id=self.owner_user.pk, spec=["owner_id"])
        obj_owner_str = Mock(owner_id=str(self.owner_user.pk), spec=["owner_id"])
        self.assertTrue(perm.has_object_permission(self._req("GET", self.owner_user), None, obj_owner_inst))
        self.assertTrue(perm.has_object_permission(self._req("GET", self.owner_user), None, obj_owner_id))
        self.assertTrue(perm.has_object_permission(self._req("GET", self.owner_user), None, obj_owner_str))

        # 2. Incorrect owner
        self.assertFalse(perm.has_object_permission(self._req("GET", self.other_owner), None, obj_owner_inst))
        self.assertFalse(perm.has_object_permission(self._req("GET", self.tenant_user), None, obj_owner_inst))

        # 3. Tenant relationship
        tenant_inst = Mock(tenant=self.tenant_user, spec=["tenant"])
        tenant_id = Mock(tenant_id=self.tenant_user.pk, spec=["tenant_id"])
        self.assertTrue(perm.has_object_permission(self._req("GET", self.tenant_user), None, tenant_inst))
        self.assertTrue(perm.has_object_permission(self._req("GET", self.tenant_user), None, tenant_id))
        self.assertFalse(perm.has_object_permission(self._req("GET", self.owner_user), None, tenant_inst))

        # 4. Applicant relationship
        applicant_inst = Mock(applicant=self.tenant_user, spec=["applicant"])
        applicant_id = Mock(applicant_id=self.tenant_user.pk, spec=["applicant_id"])
        self.assertTrue(perm.has_object_permission(self._req("GET", self.tenant_user), None, applicant_inst))
        self.assertTrue(perm.has_object_permission(self._req("GET", self.tenant_user), None, applicant_id))
        self.assertFalse(perm.has_object_permission(self._req("GET", self.owner_user), None, applicant_inst))

        # 5. User relationship
        user_inst = Mock(user=self.tenant_user, spec=["user"])
        user_id = Mock(user_id=self.tenant_user.pk, spec=["user_id"])
        self.assertTrue(perm.has_object_permission(self._req("GET", self.tenant_user), None, user_inst))
        self.assertTrue(perm.has_object_permission(self._req("GET", self.tenant_user), None, user_id))
        self.assertFalse(perm.has_object_permission(self._req("GET", self.owner_user), None, user_inst))

        # 6. Nested property owner
        nested_prop = Mock(property=Mock(owner=self.owner_user, spec=["owner"]), spec=["property"])
        nested_prop_id = Mock(property=Mock(owner_id=self.owner_user.pk, spec=["owner_id"]), spec=["property"])
        self.assertTrue(perm.has_object_permission(self._req("GET", self.owner_user), None, nested_prop))
        self.assertTrue(perm.has_object_permission(self._req("GET", self.owner_user), None, nested_prop_id))
        self.assertFalse(perm.has_object_permission(self._req("GET", self.other_owner), None, nested_prop))

        # Secondary nested (listing.property.owner)
        nested_listing = Mock(
            listing=Mock(property=Mock(owner=self.owner_user, spec=["owner"]), spec=["property"]),
            spec=["listing"],
        )
        self.assertTrue(perm.has_object_permission(self._req("GET", self.owner_user), None, nested_listing))
        self.assertFalse(perm.has_object_permission(self._req("GET", self.other_owner), None, nested_listing))

        # 7. Missing ownership attribute
        unrelated_obj = Mock(title="Sample Object", spec=["title"])
        self.assertFalse(perm.has_object_permission(self._req("GET", self.owner_user), None, unrelated_obj))

        # 8. Unauthenticated request
        self.assertFalse(perm.has_object_permission(self._req("GET", self.anon_user), None, obj_owner_inst))
        self.assertFalse(perm.has_object_permission(self._req("GET", self.anon_user), None, nested_prop))

