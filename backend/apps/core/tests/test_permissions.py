import uuid
from unittest.mock import Mock

from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser
from django.test import RequestFactory, TestCase

from apps.core.permissions import (
    IsAdmin,
    IsNotAdmin,
    IsObjectOwner,
    IsOwner,
    IsOwnerOrReadOnly,
    IsTenant,
    _check_object_ownership,
    _matches_user,
)

User = get_user_model()


class CorePermissionsRegressionTests(TestCase):
    """
    Dedicated regression test suite for core RBAC, helper functions, and object-level permissions.
    """

    def setUp(self):
        self.factory = RequestFactory()

        self.tenant_user = User.objects.create_user(
            email="perm_tenant@example.com",
            password="password123",
            is_tenant=True,
            is_owner=False,
        )
        self.owner_user = User.objects.create_user(
            email="perm_owner@example.com",
            password="password123",
            is_tenant=False,
            is_owner=True,
        )
        self.other_owner = User.objects.create_user(
            email="perm_other_owner@example.com",
            password="password123",
            is_tenant=False,
            is_owner=True,
        )
        self.dual_user = User.objects.create_user(
            email="perm_dual@example.com",
            password="password123",
            is_tenant=True,
            is_owner=True,
        )
        self.admin_user = User.objects.create_superuser(
            email="perm_admin@example.com",
            password="password123",
        )
        self.anon_user = AnonymousUser()

    def _make_request(self, method="GET", user=None):
        req = getattr(self.factory, method.lower())("/")
        req.user = user if user is not None else self.anon_user
        return req

    # ==========================================
    # 1. Helper function tests: _matches_user
    # ==========================================
    def test_matches_user_helper(self):
        # Direct User object comparison
        self.assertTrue(_matches_user(self.owner_user, self.owner_user))
        self.assertFalse(_matches_user(self.owner_user, self.tenant_user))

        # UUID object comparison
        self.assertTrue(_matches_user(self.owner_user.pk, self.owner_user))
        self.assertFalse(_matches_user(self.tenant_user.pk, self.owner_user))

        # String UUID comparison
        self.assertTrue(_matches_user(str(self.owner_user.pk), self.owner_user))
        self.assertFalse(_matches_user(str(self.tenant_user.pk), self.owner_user))

        # None and invalid comparisons
        self.assertFalse(_matches_user(None, self.owner_user))
        self.assertFalse(_matches_user(self.owner_user, None))
        self.assertFalse(_matches_user(None, None))

    # ==========================================
    # 2. Helper function tests: _check_object_ownership
    # ==========================================
    def test_check_object_ownership_helper(self):
        # Direct owner
        self.assertTrue(_check_object_ownership(self.owner_user, Mock(owner=self.owner_user, spec=["owner"])))
        self.assertTrue(_check_object_ownership(self.owner_user, Mock(owner_id=self.owner_user.pk, spec=["owner_id"])))
        self.assertFalse(_check_object_ownership(self.owner_user, Mock(owner=self.tenant_user, spec=["owner"])))

        # Direct tenant
        self.assertTrue(_check_object_ownership(self.tenant_user, Mock(tenant=self.tenant_user, spec=["tenant"])))
        self.assertTrue(_check_object_ownership(self.tenant_user, Mock(tenant_id=self.tenant_user.pk, spec=["tenant_id"])))

        # Direct applicant
        self.assertTrue(_check_object_ownership(self.tenant_user, Mock(applicant=self.tenant_user, spec=["applicant"])))
        self.assertTrue(_check_object_ownership(self.tenant_user, Mock(applicant_id=self.tenant_user.pk, spec=["applicant_id"])))

        # Direct user
        self.assertTrue(_check_object_ownership(self.tenant_user, Mock(user=self.tenant_user, spec=["user"])))
        self.assertTrue(_check_object_ownership(self.tenant_user, Mock(user_id=self.tenant_user.pk, spec=["user_id"])))

        # Nested property.owner
        prop_obj = Mock(property=Mock(owner=self.owner_user, spec=["owner"]), spec=["property"])
        self.assertTrue(_check_object_ownership(self.owner_user, prop_obj))
        self.assertFalse(_check_object_ownership(self.other_owner, prop_obj))

        # Secondary nested listing.property.owner
        listing_obj = Mock(
            listing=Mock(property=Mock(owner=self.owner_user, spec=["owner"]), spec=["property"]),
            spec=["listing"],
        )
        self.assertTrue(_check_object_ownership(self.owner_user, listing_obj))
        self.assertFalse(_check_object_ownership(self.other_owner, listing_obj))

        # Unauthenticated user
        self.assertFalse(_check_object_ownership(self.anon_user, Mock(owner=self.owner_user)))
        self.assertFalse(_check_object_ownership(None, Mock(owner=self.owner_user)))

    # ==========================================
    # 3. IsOwner tests
    # ==========================================
    def test_is_owner_permission(self):
        perm = IsOwner()

        # Owner user allowed
        self.assertTrue(perm.has_permission(self._make_request("GET", self.owner_user), None))
        # Dual-role user allowed
        self.assertTrue(perm.has_permission(self._make_request("GET", self.dual_user), None))
        # Tenant-only user denied
        self.assertFalse(perm.has_permission(self._make_request("GET", self.tenant_user), None))
        # Unauthenticated anonymous user denied
        self.assertFalse(perm.has_permission(self._make_request("GET", self.anon_user), None))
        # Request with user=None denied
        req = self._make_request("GET", None)
        req.user = None
        self.assertFalse(perm.has_permission(req, None))

    # ==========================================
    # 4. IsTenant tests
    # ==========================================
    def test_is_tenant_permission(self):
        perm = IsTenant()

        # Tenant user allowed
        self.assertTrue(perm.has_permission(self._make_request("GET", self.tenant_user), None))
        # Dual-role user allowed
        self.assertTrue(perm.has_permission(self._make_request("GET", self.dual_user), None))
        # Owner-only user denied
        self.assertFalse(perm.has_permission(self._make_request("GET", self.owner_user), None))
        # Unauthenticated anonymous user denied
        self.assertFalse(perm.has_permission(self._make_request("GET", self.anon_user), None))
        # Request with user=None denied
        req = self._make_request("GET", None)
        req.user = None
        self.assertFalse(perm.has_permission(req, None))

    # ==========================================
    # 5. IsAdmin tests
    # ==========================================
    def test_is_admin_permission(self):
        perm = IsAdmin()

        # Platform admin allowed
        self.assertTrue(perm.has_permission(self._make_request("GET", self.admin_user), None))
        # Non-admin owner denied
        self.assertFalse(perm.has_permission(self._make_request("GET", self.owner_user), None))
        # Non-admin tenant denied
        self.assertFalse(perm.has_permission(self._make_request("GET", self.tenant_user), None))
        # Unauthenticated anonymous user denied
        self.assertFalse(perm.has_permission(self._make_request("GET", self.anon_user), None))
        # Request with user=None denied
        req = self._make_request("GET", None)
        req.user = None
        self.assertFalse(perm.has_permission(req, None))

    # ==========================================
    # 6. IsOwnerOrReadOnly tests
    # ==========================================
    def test_is_owner_or_read_only_safe_methods(self):
        perm = IsOwnerOrReadOnly()
        dummy_obj = Mock(owner=self.owner_user)

        for method in ("GET", "HEAD", "OPTIONS"):
            # Anonymous users allowed for safe methods (view and object level)
            self.assertTrue(perm.has_permission(self._make_request(method, self.anon_user), None))
            self.assertTrue(perm.has_object_permission(self._make_request(method, self.anon_user), None, dummy_obj))
            # Tenant-only users allowed for safe methods
            self.assertTrue(perm.has_permission(self._make_request(method, self.tenant_user), None))
            self.assertTrue(perm.has_object_permission(self._make_request(method, self.tenant_user), None, dummy_obj))
            # Owner users allowed for safe methods
            self.assertTrue(perm.has_permission(self._make_request(method, self.owner_user), None))
            self.assertTrue(perm.has_object_permission(self._make_request(method, self.owner_user), None, dummy_obj))

    def test_is_owner_or_read_only_write_methods(self):
        perm = IsOwnerOrReadOnly()
        own_obj = Mock(owner=self.owner_user, spec=["owner"])
        other_obj = Mock(owner=self.other_owner, spec=["owner"])

        for method in ("POST", "PUT", "PATCH", "DELETE"):
            # Owner allowed at view-level
            self.assertTrue(perm.has_permission(self._make_request(method, self.owner_user), None))
            # Dual-role user allowed at view-level
            self.assertTrue(perm.has_permission(self._make_request(method, self.dual_user), None))
            # Tenant denied at view-level
            self.assertFalse(perm.has_permission(self._make_request(method, self.tenant_user), None))
            # Anonymous denied at view-level
            self.assertFalse(perm.has_permission(self._make_request(method, self.anon_user), None))

            # Object-level permission: owner modifying own object allowed
            self.assertTrue(perm.has_object_permission(self._make_request(method, self.owner_user), None, own_obj))
            # Object-level permission: owner modifying another owner's object denied
            self.assertFalse(perm.has_object_permission(self._make_request(method, self.owner_user), None, other_obj))
            # Object-level permission: tenant modifying object denied
            self.assertFalse(perm.has_object_permission(self._make_request(method, self.tenant_user), None, own_obj))
            # Object-level permission: anonymous modifying object denied
            self.assertFalse(perm.has_object_permission(self._make_request(method, self.anon_user), None, own_obj))

    # ==========================================
    # 7. IsObjectOwner: Direct ownership tests
    # ==========================================
    def test_owner_accessing_own_object_direct_attributes(self):
        perm = IsObjectOwner()

        # Object with direct owner_id as UUID
        obj_with_uuid_id = Mock(owner_id=self.owner_user.pk, spec=["owner_id"])
        self.assertTrue(
            perm.has_object_permission(self._make_request("GET", self.owner_user), None, obj_with_uuid_id)
        )

        # Object with direct owner_id as string
        obj_with_str_id = Mock(owner_id=str(self.owner_user.pk), spec=["owner_id"])
        self.assertTrue(
            perm.has_object_permission(self._make_request("GET", self.owner_user), None, obj_with_str_id)
        )

        # Object with direct owner instance exposing .pk
        obj_with_owner_pk = Mock(owner=self.owner_user, spec=["owner"])
        self.assertTrue(
            perm.has_object_permission(self._make_request("GET", self.owner_user), None, obj_with_owner_pk)
        )

        # Object with direct owner instance exposing .id
        mock_owner = Mock(id=self.owner_user.pk, spec=["id"])
        obj_with_owner_id_attr = Mock(owner=mock_owner, spec=["owner"])
        self.assertTrue(
            perm.has_object_permission(
                self._make_request("GET", self.owner_user), None, obj_with_owner_id_attr
            )
        )

    def test_owner_accessing_another_users_object_denied(self):
        perm = IsObjectOwner()

        # Another user's owner_id
        other_obj_id = Mock(owner_id=self.other_owner.pk, spec=["owner_id"])
        self.assertFalse(
            perm.has_object_permission(self._make_request("GET", self.owner_user), None, other_obj_id)
        )

        # Another user's owner instance
        other_obj_inst = Mock(owner=self.other_owner, spec=["owner"])
        self.assertFalse(
            perm.has_object_permission(self._make_request("GET", self.owner_user), None, other_obj_inst)
        )

        # Tenant accessing owner's object
        self.assertFalse(
            perm.has_object_permission(self._make_request("GET", self.tenant_user), None, other_obj_id)
        )

    # ==========================================
    # 8. IsObjectOwner: Nested ownership tests
    # ==========================================
    def test_nested_ownership_property_owner_authorized(self):
        perm = IsObjectOwner()

        # Nested property.owner matching authenticated owner
        prop_owner_inst = Mock(
            property=Mock(owner=self.owner_user, spec=["owner"]),
            spec=["property"],
        )
        self.assertTrue(
            perm.has_object_permission(self._make_request("GET", self.owner_user), None, prop_owner_inst)
        )

        # Nested property.owner_id (UUID) matching authenticated owner
        prop_owner_uuid = Mock(
            property=Mock(owner_id=self.owner_user.pk, spec=["owner_id"]),
            spec=["property"],
        )
        self.assertTrue(
            perm.has_object_permission(self._make_request("GET", self.owner_user), None, prop_owner_uuid)
        )

        # Nested property.owner_id (string) matching authenticated owner
        prop_owner_str = Mock(
            property=Mock(owner_id=str(self.owner_user.pk), spec=["owner_id"]),
            spec=["property"],
        )
        self.assertTrue(
            perm.has_object_permission(self._make_request("GET", self.owner_user), None, prop_owner_str)
        )

    def test_nested_ownership_property_owner_rejected_when_mismatched(self):
        perm = IsObjectOwner()

        # Nested property.owner belonging to other owner
        prop_other_owner = Mock(
            property=Mock(owner=self.other_owner, spec=["owner"]),
            spec=["property"],
        )
        self.assertFalse(
            perm.has_object_permission(self._make_request("GET", self.owner_user), None, prop_other_owner)
        )

        # Nested property.owner_id belonging to other owner
        prop_other_id = Mock(
            property=Mock(owner_id=self.other_owner.pk, spec=["owner_id"]),
            spec=["property"],
        )
        self.assertFalse(
            perm.has_object_permission(self._make_request("GET", self.owner_user), None, prop_other_id)
        )

    def test_nested_ownership_listing_property_owner(self):
        perm = IsObjectOwner()

        # obj.listing.property.owner matching owner
        listing_prop_owner = Mock(
            listing=Mock(
                property=Mock(owner=self.owner_user, spec=["owner"]),
                spec=["property"],
            ),
            spec=["listing"],
        )
        self.assertTrue(
            perm.has_object_permission(self._make_request("GET", self.owner_user), None, listing_prop_owner)
        )

        # obj.listing.property.owner_id matching owner
        listing_prop_id = Mock(
            listing=Mock(
                property=Mock(owner_id=self.owner_user.pk, spec=["owner_id"]),
                spec=["property"],
            ),
            spec=["listing"],
        )
        self.assertTrue(
            perm.has_object_permission(self._make_request("GET", self.owner_user), None, listing_prop_id)
        )

        # obj.listing.property.owner belonging to different owner rejected
        self.assertFalse(
            perm.has_object_permission(self._make_request("GET", self.other_owner), None, listing_prop_owner)
        )

    def test_nested_ownership_tenancy_and_application_paths(self):
        perm = IsObjectOwner()

        # obj.tenancy.property.owner
        tenancy_obj = Mock(
            tenancy=Mock(
                property=Mock(owner=self.owner_user, spec=["owner"]),
                spec=["property"],
            ),
            spec=["tenancy"],
        )
        self.assertTrue(
            perm.has_object_permission(self._make_request("GET", self.owner_user), None, tenancy_obj)
        )
        self.assertFalse(
            perm.has_object_permission(self._make_request("GET", self.other_owner), None, tenancy_obj)
        )

        # obj.application.property.owner
        application_obj = Mock(
            application=Mock(
                property=Mock(owner=self.owner_user, spec=["owner"]),
                spec=["property"],
            ),
            spec=["application"],
        )
        self.assertTrue(
            perm.has_object_permission(self._make_request("GET", self.owner_user), None, application_obj)
        )
        self.assertFalse(
            perm.has_object_permission(self._make_request("GET", self.other_owner), None, application_obj)
        )

    # ==========================================
    # 9. IsObjectOwner: Additional party attributes
    # ==========================================
    def test_additional_party_relationships(self):
        perm = IsObjectOwner()

        # Tenant relationship
        tenant_obj = Mock(tenant=self.tenant_user, spec=["tenant"])
        tenant_id_obj = Mock(tenant_id=self.tenant_user.pk, spec=["tenant_id"])
        self.assertTrue(perm.has_object_permission(self._make_request("GET", self.tenant_user), None, tenant_obj))
        self.assertTrue(perm.has_object_permission(self._make_request("GET", self.tenant_user), None, tenant_id_obj))
        self.assertFalse(perm.has_object_permission(self._make_request("GET", self.owner_user), None, tenant_obj))

        # Applicant relationship
        applicant_obj = Mock(applicant=self.tenant_user, spec=["applicant"])
        applicant_id_obj = Mock(applicant_id=self.tenant_user.pk, spec=["applicant_id"])
        self.assertTrue(perm.has_object_permission(self._make_request("GET", self.tenant_user), None, applicant_obj))
        self.assertTrue(perm.has_object_permission(self._make_request("GET", self.tenant_user), None, applicant_id_obj))
        self.assertFalse(perm.has_object_permission(self._make_request("GET", self.owner_user), None, applicant_obj))

        # User relationship
        user_obj = Mock(user=self.tenant_user, spec=["user"])
        user_id_obj = Mock(user_id=self.tenant_user.pk, spec=["user_id"])
        self.assertTrue(perm.has_object_permission(self._make_request("GET", self.tenant_user), None, user_obj))
        self.assertTrue(perm.has_object_permission(self._make_request("GET", self.tenant_user), None, user_id_obj))
        self.assertFalse(perm.has_object_permission(self._make_request("GET", self.owner_user), None, user_obj))

    # ==========================================
    # 10. Platform admin bypass tests
    # ==========================================
    def test_platform_admin_accessing_another_users_object_allowed(self):
        perm = IsObjectOwner()

        # Admin accessing regular owner's object via owner_id
        obj_owner_id = Mock(owner_id=self.owner_user.pk, spec=["owner_id"])
        self.assertTrue(
            perm.has_object_permission(self._make_request("GET", self.admin_user), None, obj_owner_id)
        )

        # Admin accessing regular owner's object via owner instance
        obj_owner_inst = Mock(owner=self.owner_user, spec=["owner"])
        self.assertTrue(
            perm.has_object_permission(self._make_request("GET", self.admin_user), None, obj_owner_inst)
        )

        # Admin accessing nested relationship
        nested_obj = Mock(property=Mock(owner=self.owner_user, spec=["owner"]), spec=["property"])
        self.assertTrue(
            perm.has_object_permission(self._make_request("GET", self.admin_user), None, nested_obj)
        )

        # Admin accessing object without owner fields
        unrelated_obj = Mock(spec=[])
        self.assertTrue(
            perm.has_object_permission(self._make_request("GET", self.admin_user), None, unrelated_obj)
        )

    # ==========================================
    # 11. Unauthenticated user tests
    # ==========================================
    def test_unauthenticated_user_denied(self):
        perm = IsObjectOwner()
        obj = Mock(owner_id=self.owner_user.pk, spec=["owner_id"])
        nested_obj = Mock(property=Mock(owner=self.owner_user, spec=["owner"]), spec=["property"])

        # AnonymousUser
        self.assertFalse(perm.has_object_permission(self._make_request("GET", self.anon_user), None, obj))
        self.assertFalse(perm.has_object_permission(self._make_request("GET", self.anon_user), None, nested_obj))

        # Request user is None
        req_none = self._make_request("GET", None)
        req_none.user = None
        self.assertFalse(perm.has_object_permission(req_none, None, obj))

        # Unauthenticated user mock (is_authenticated=False)
        unauth_user = Mock(is_authenticated=False, pk=self.owner_user.pk)
        self.assertFalse(perm.has_object_permission(self._make_request("GET", unauth_user), None, obj))

    # ==========================================
    # 12. UUID and string UUID comparison tests
    # ==========================================
    def test_uuid_and_string_uuid_comparisons(self):
        perm = IsObjectOwner()
        fixed_uuid = uuid.uuid4()
        user_with_uuid = Mock(is_authenticated=True, is_platform_admin=False, pk=fixed_uuid)
        user_with_str_uuid = Mock(is_authenticated=True, is_platform_admin=False, pk=str(fixed_uuid))

        # User has UUID pk, object has UUID owner_id
        obj_uuid = Mock(owner_id=fixed_uuid, spec=["owner_id"])
        self.assertTrue(
            perm.has_object_permission(self._make_request("GET", user_with_uuid), None, obj_uuid)
        )

        # User has UUID pk, object has string UUID owner_id
        obj_str = Mock(owner_id=str(fixed_uuid), spec=["owner_id"])
        self.assertTrue(
            perm.has_object_permission(self._make_request("GET", user_with_uuid), None, obj_str)
        )

        # User has string pk, object has UUID owner_id
        self.assertTrue(
            perm.has_object_permission(self._make_request("GET", user_with_str_uuid), None, obj_uuid)
        )

        # Different UUID comparison
        diff_uuid = uuid.uuid4()
        obj_diff = Mock(owner_id=diff_uuid, spec=["owner_id"])
        self.assertFalse(
            perm.has_object_permission(self._make_request("GET", user_with_uuid), None, obj_diff)
        )

    # ==========================================
    # 13. Missing or unresolvable ownership tests
    # ==========================================
    def test_missing_or_unresolvable_owner_relationships_fail_closed(self):
        perm = IsObjectOwner()

        # Object with no owner or owner_id attribute
        obj_no_attrs = Mock(spec=["title", "description"])
        self.assertFalse(
            perm.has_object_permission(self._make_request("GET", self.owner_user), None, obj_no_attrs)
        )

        # Object with owner_id=None and no owner attribute
        obj_none_id = Mock(owner_id=None, spec=["owner_id"])
        self.assertFalse(
            perm.has_object_permission(self._make_request("GET", self.owner_user), None, obj_none_id)
        )

        # Object with owner=None and no owner_id attribute
        obj_none_owner = Mock(owner=None, spec=["owner"])
        self.assertFalse(
            perm.has_object_permission(self._make_request("GET", self.owner_user), None, obj_none_owner)
        )

        # Object with owner_id=None and owner=None
        obj_both_none = Mock(owner_id=None, owner=None, spec=["owner_id", "owner"])
        self.assertFalse(
            perm.has_object_permission(self._make_request("GET", self.owner_user), None, obj_both_none)
        )

        # Object with owner that has neither pk nor id
        obj_invalid_owner = Mock(owner=Mock(spec=["name"]), spec=["owner"])
        self.assertFalse(
            perm.has_object_permission(self._make_request("GET", self.owner_user), None, obj_invalid_owner)
        )

        # Object with nested parent attribute being None
        obj_none_parent = Mock(property=None, spec=["property"])
        self.assertFalse(
            perm.has_object_permission(self._make_request("GET", self.owner_user), None, obj_none_parent)
        )

    # ==========================================
    # 14. IsNotAdmin & read-only admin object policy
    # ==========================================
    def test_is_not_admin_permission(self):
        perm = IsNotAdmin()

        self.assertFalse(perm.has_permission(self._make_request("POST", self.admin_user), None))
        self.assertTrue(perm.has_permission(self._make_request("POST", self.owner_user), None))
        self.assertTrue(perm.has_permission(self._make_request("POST", self.tenant_user), None))
        self.assertTrue(perm.has_permission(self._make_request("POST", self.dual_user), None))
        self.assertFalse(perm.has_permission(self._make_request("POST", self.anon_user), None))

    def test_platform_admin_is_read_only_for_is_object_owner(self):
        perm = IsObjectOwner()
        obj = Mock(owner=self.owner_user, spec=["owner"])

        for method in ("GET", "HEAD", "OPTIONS"):
            self.assertTrue(
                perm.has_object_permission(self._make_request(method, self.admin_user), None, obj)
            )

        for method in ("POST", "PUT", "PATCH", "DELETE"):
            self.assertFalse(
                perm.has_object_permission(self._make_request(method, self.admin_user), None, obj)
            )
