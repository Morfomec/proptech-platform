from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.listings.models import Listing, ListingStatus, ReviewStatus
from apps.properties.models import (
    FurnishingStatus,
    Property,
    PropertyCategory,
    PropertyImage,
    PropertyStatus,
    PropertyType,
)

User = get_user_model()


class ListingSearchAndFilterAPITests(APITestCase):
    def setUp(self):
        # 1. Users
        self.owner = User.objects.create_user(
            email="owner_filter_test@example.com",
            password="securepassword123",
            first_name="Oscar",
            last_name="Owner",
            is_owner=True,
        )

        # 2. Properties
        # Prop 1: Beachfront Villa in Kozhikode (4 BHK, Fully Furnished)
        self.prop1 = Property.objects.create(
            owner=self.owner,
            title="Kozhikode Beachfront Luxury Villa",
            description="Superb villa facing the Arabian sea.",
            category=PropertyCategory.RESIDENTIAL,
            property_type=PropertyType.VILLA,
            address_line_1="Beach Road 1",
            locality="Kozhikode Beach",
            city="Kozhikode",
            district="Kozhikode",
            state="Kerala",
            pin_code="673001",
            bedrooms=4,
            bathrooms=Decimal("4.0"),
            furnishing_status=FurnishingStatus.FULLY_FURNISHED,
            parking_spaces=2,
            status=PropertyStatus.AVAILABLE,
        )
        PropertyImage.objects.create(
            property=self.prop1,
            image_url="https://images.example.com/prop1.jpg",
            is_primary=True,
        )

        # Prop 2: Tech Studio in Bengaluru (1 BHK, Semi Furnished)
        self.prop2 = Property.objects.create(
            owner=self.owner,
            title="Bengaluru Whitefield Tech Studio",
            description="Quiet studio near ITPL.",
            category=PropertyCategory.RESIDENTIAL,
            property_type=PropertyType.STUDIO_APARTMENT,
            address_line_1="Hope Farm Junction",
            locality="Whitefield",
            city="Bengaluru",
            district="Bengaluru Urban",
            state="Karnataka",
            pin_code="560066",
            bedrooms=1,
            bathrooms=Decimal("1.0"),
            furnishing_status=FurnishingStatus.SEMI_FURNISHED,
            parking_spaces=1,
            status=PropertyStatus.AVAILABLE,
        )
        PropertyImage.objects.create(
            property=self.prop2,
            image_url="https://images.example.com/prop2.jpg",
            is_primary=True,
        )

        # Prop 3: Commercial Office in Kochi (Commercial, Unfurnished)
        self.prop3 = Property.objects.create(
            owner=self.owner,
            title="Kochi Marine Drive Commercial Office",
            description="Grade A office space with high visibility.",
            category=PropertyCategory.COMMERCIAL,
            property_type=PropertyType.OFFICE,
            address_line_1="Shanmugham Road",
            locality="Marine Drive",
            city="Kochi",
            district="Ernakulam",
            state="Kerala",
            pin_code="682011",
            bedrooms=None,
            furnishing_status=FurnishingStatus.UNFURNISHED,
            status=PropertyStatus.AVAILABLE,
        )
        PropertyImage.objects.create(
            property=self.prop3,
            image_url="https://images.example.com/prop3.jpg",
            is_primary=True,
        )

        # Prop 4: Downtown Apartment in Kozhikode (2 BHK, Fully Furnished)
        self.prop4 = Property.objects.create(
            owner=self.owner,
            title="Kozhikode City Centre Apartment",
            description="Modern flat close to downtown schools and hospitals.",
            category=PropertyCategory.RESIDENTIAL,
            property_type=PropertyType.APARTMENT,
            address_line_1="Arayidathupalam",
            locality="Mavoor Road",
            city="Kozhikode",
            district="Kozhikode",
            state="Kerala",
            pin_code="673004",
            bedrooms=2,
            bathrooms=Decimal("2.0"),
            furnishing_status=FurnishingStatus.FULLY_FURNISHED,
            status=PropertyStatus.AVAILABLE,
        )
        PropertyImage.objects.create(
            property=self.prop4,
            image_url="https://images.example.com/prop4.jpg",
            is_primary=True,
        )

        # 3. Published Listings
        base_time = timezone.now()

        # Listing 1: 50k rent, available June 1, review pending
        self.listing1 = Listing.objects.create(
            property=self.prop1,
            title="Luxury 4BHK Sea Villa",
            description="Exclusive beachfront rental with breathtaking ocean views.",
            monthly_rent=Decimal("50000.00"),
            security_deposit=Decimal("150000.00"),
            available_from=date(2026, 6, 1),
            status=ListingStatus.PUBLISHED,
            review_status=ReviewStatus.PENDING,
            published_at=base_time - timezone.timedelta(days=10),
        )

        # Listing 2: 15k rent, available July 1, review approved
        self.listing2 = Listing.objects.create(
            property=self.prop2,
            title="Affordable Studio in Whitefield",
            description="Walk to IT park, perfect for young software developers.",
            monthly_rent=Decimal("15000.00"),
            security_deposit=Decimal("40000.00"),
            available_from=date(2026, 7, 1),
            status=ListingStatus.PUBLISHED,
            review_status=ReviewStatus.APPROVED,
            published_at=base_time - timezone.timedelta(days=6),
        )

        # Listing 3: 80k rent, available August 1, review approved
        self.listing3 = Listing.objects.create(
            property=self.prop3,
            title="Prime Marine Drive Commercial Space",
            description="Ideal for fintech enterprises or legal consultancies.",
            monthly_rent=Decimal("80000.00"),
            security_deposit=Decimal("250000.00"),
            available_from=date(2026, 8, 1),
            status=ListingStatus.PUBLISHED,
            review_status=ReviewStatus.APPROVED,
            published_at=base_time - timezone.timedelta(days=1),
        )

        # Listing 4: 25k rent, available June 15, review pending
        self.listing4 = Listing.objects.create(
            property=self.prop4,
            title="2BHK Family Flat Near Mavoor Road",
            description="Convenient downtown family flat near malls and markets.",
            monthly_rent=Decimal("25000.00"),
            security_deposit=Decimal("75000.00"),
            available_from=date(2026, 6, 15),
            status=ListingStatus.PUBLISHED,
            review_status=ReviewStatus.PENDING,
            published_at=base_time - timezone.timedelta(days=3),
        )

        # 4. Non-published listings (must NEVER appear in public search)
        self.draft_prop = Property.objects.create(
            owner=self.owner,
            title="Draft Hidden Property",
            category=PropertyCategory.RESIDENTIAL,
            property_type=PropertyType.APARTMENT,
            address_line_1="Draft Lane",
            locality="Draft Nagar",
            city="Kozhikode",
            district="Kozhikode",
            state="Kerala",
            pin_code="673001",
            status=PropertyStatus.DRAFT,
        )
        self.draft_listing = Listing.objects.create(
            property=self.draft_prop,
            title="Draft Listing Secret",
            monthly_rent=Decimal("12000.00"),
            status=ListingStatus.DRAFT,
        )

        self.paused_prop = Property.objects.create(
            owner=self.owner,
            title="Paused Hidden Property",
            category=PropertyCategory.RESIDENTIAL,
            property_type=PropertyType.APARTMENT,
            address_line_1="Paused Lane",
            locality="Paused Nagar",
            city="Kozhikode",
            district="Kozhikode",
            state="Kerala",
            pin_code="673001",
            status=PropertyStatus.DRAFT,
        )
        self.paused_listing = Listing.objects.create(
            property=self.paused_prop,
            title="Paused Listing Secret",
            monthly_rent=Decimal("14000.00"),
            status=ListingStatus.PAUSED,
        )

        self.closed_prop = Property.objects.create(
            owner=self.owner,
            title="Closed Hidden Property",
            category=PropertyCategory.RESIDENTIAL,
            property_type=PropertyType.APARTMENT,
            address_line_1="Closed Lane",
            locality="Closed Nagar",
            city="Kozhikode",
            district="Kozhikode",
            state="Kerala",
            pin_code="673001",
            status=PropertyStatus.DRAFT,
        )
        self.closed_listing = Listing.objects.create(
            property=self.closed_prop,
            title="Closed Listing Historical",
            monthly_rent=Decimal("16000.00"),
            status=ListingStatus.CLOSED,
        )

    # ============================================================
    # 1. Anonymous users can search published listings
    # ============================================================
    def test_anonymous_users_can_search_published_listings(self):
        res = self.client.get(reverse("listings:listing-list"))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        results = res.data.get("data", res.data.get("results", []))
        self.assertEqual(len(results), 4)

    # ============================================================
    # 2. Draft, paused and closed listings never appear
    # ============================================================
    def test_draft_paused_closed_never_appear_in_search(self):
        res = self.client.get(reverse("listings:listing-list"))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        results = res.data.get("data", res.data.get("results", []))
        ids = [item["id"] for item in results]

        self.assertNotIn(str(self.draft_listing.id), ids)
        self.assertNotIn(str(self.paused_listing.id), ids)
        self.assertNotIn(str(self.closed_listing.id), ids)

    # ============================================================
    # 3. Review status does not block published listings
    # ============================================================
    def test_review_status_does_not_block_published_listings(self):
        res = self.client.get(reverse("listings:listing-list"))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        results = res.data.get("data", res.data.get("results", []))
        ids = [item["id"] for item in results]

        # Both pending review listings are present
        self.assertIn(str(self.listing1.id), ids)
        self.assertIn(str(self.listing4.id), ids)

    # ============================================================
    # 4. City and locality filtering (case-insensitive)
    # ============================================================
    def test_city_and_locality_filtering(self):
        # Case-insensitive city
        res_city = self.client.get(f"{reverse('listings:listing-list')}?city=kozhikode")
        self.assertEqual(res_city.status_code, status.HTTP_200_OK)
        ids = [item["id"] for item in res_city.data.get("data", res_city.data.get("results", []))]
        self.assertEqual(len(ids), 2)
        self.assertIn(str(self.listing1.id), ids)
        self.assertIn(str(self.listing4.id), ids)
        self.assertNotIn(str(self.listing2.id), ids)

        # Locality filter
        res_loc = self.client.get(f"{reverse('listings:listing-list')}?locality=whitefield")
        self.assertEqual(res_loc.status_code, status.HTTP_200_OK)
        ids_loc = [item["id"] for item in res_loc.data.get("data", res_loc.data.get("results", []))]
        self.assertEqual(ids_loc, [str(self.listing2.id)])

        # Combined city and locality
        res_comb = self.client.get(f"{reverse('listings:listing-list')}?city=Kozhikode&locality=Mavoor Road")
        self.assertEqual(res_comb.status_code, status.HTTP_200_OK)
        ids_comb = [item["id"] for item in res_comb.data.get("data", res_comb.data.get("results", []))]
        self.assertEqual(ids_comb, [str(self.listing4.id)])

    # ============================================================
    # 5. Category and property type filtering
    # ============================================================
    def test_category_and_property_type_filtering(self):
        # Commercial category
        res_cat = self.client.get(f"{reverse('listings:listing-list')}?category=commercial")
        self.assertEqual(res_cat.status_code, status.HTTP_200_OK)
        ids_cat = [item["id"] for item in res_cat.data.get("data", res_cat.data.get("results", []))]
        self.assertEqual(ids_cat, [str(self.listing3.id)])

        # Property type villa
        res_type = self.client.get(f"{reverse('listings:listing-list')}?property_type=villa")
        self.assertEqual(res_type.status_code, status.HTTP_200_OK)
        ids_type = [item["id"] for item in res_type.data.get("data", res_type.data.get("results", []))]
        self.assertEqual(ids_type, [str(self.listing1.id)])

        # Residential apartment
        res_res_apt = self.client.get(
            f"{reverse('listings:listing-list')}?category=residential&property_type=apartment"
        )
        self.assertEqual(res_res_apt.status_code, status.HTTP_200_OK)
        ids_res_apt = [item["id"] for item in res_res_apt.data.get("data", res_res_apt.data.get("results", []))]
        self.assertEqual(ids_res_apt, [str(self.listing4.id)])

    # ============================================================
    # 6. Minimum and maximum rent filtering
    # ============================================================
    def test_min_and_max_rent_filtering(self):
        # Min rent
        res_min = self.client.get(f"{reverse('listings:listing-list')}?min_rent=25000.00")
        self.assertEqual(res_min.status_code, status.HTTP_200_OK)
        ids_min = [item["id"] for item in res_min.data.get("data", res_min.data.get("results", []))]
        self.assertEqual(len(ids_min), 3)
        self.assertNotIn(str(self.listing2.id), ids_min)  # 15k is excluded

        # Max rent
        res_max = self.client.get(f"{reverse('listings:listing-list')}?max_rent=30000.00")
        self.assertEqual(res_max.status_code, status.HTTP_200_OK)
        ids_max = [item["id"] for item in res_max.data.get("data", res_max.data.get("results", []))]
        self.assertEqual(len(ids_max), 2)
        self.assertIn(str(self.listing2.id), ids_max)  # 15k
        self.assertIn(str(self.listing4.id), ids_max)  # 25k

        # Range
        res_range = self.client.get(f"{reverse('listings:listing-list')}?min_rent=20000.00&max_rent=60000.00")
        self.assertEqual(res_range.status_code, status.HTTP_200_OK)
        ids_range = [item["id"] for item in res_range.data.get("data", res_range.data.get("results", []))]
        self.assertEqual(len(ids_range), 2)
        self.assertIn(str(self.listing4.id), ids_range)  # 25k
        self.assertIn(str(self.listing1.id), ids_range)  # 50k

    # ============================================================
    # 7. Bedroom and furnishing filters
    # ============================================================
    def test_bedroom_and_furnishing_filters(self):
        # Bedrooms
        res_bed = self.client.get(f"{reverse('listings:listing-list')}?bedrooms=4")
        self.assertEqual(res_bed.status_code, status.HTTP_200_OK)
        ids_bed = [item["id"] for item in res_bed.data.get("data", res_bed.data.get("results", []))]
        self.assertEqual(ids_bed, [str(self.listing1.id)])

        # Furnishing: semi_furnished
        res_furn = self.client.get(f"{reverse('listings:listing-list')}?furnishing_status=semi_furnished")
        self.assertEqual(res_furn.status_code, status.HTTP_200_OK)
        ids_furn = [item["id"] for item in res_furn.data.get("data", res_furn.data.get("results", []))]
        self.assertEqual(ids_furn, [str(self.listing2.id)])

        # Furnishing: fully_furnished
        res_full = self.client.get(f"{reverse('listings:listing-list')}?furnishing_status=fully_furnished")
        self.assertEqual(res_full.status_code, status.HTTP_200_OK)
        ids_full = [item["id"] for item in res_full.data.get("data", res_full.data.get("results", []))]
        self.assertEqual(len(ids_full), 2)
        self.assertIn(str(self.listing1.id), ids_full)
        self.assertIn(str(self.listing4.id), ids_full)

    # ============================================================
    # 8. Available-from filtering
    # ============================================================
    def test_available_from_filtering(self):
        # Target: available on or before June 15, 2026
        res = self.client.get(f"{reverse('listings:listing-list')}?available_from=2026-06-15")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        ids = [item["id"] for item in res.data.get("data", res.data.get("results", []))]

        # Listing 1 (June 1) and Listing 4 (June 15) match
        self.assertIn(str(self.listing1.id), ids)
        self.assertIn(str(self.listing4.id), ids)

        # Listing 2 (July 1) and Listing 3 (August 1) are excluded
        self.assertNotIn(str(self.listing2.id), ids)
        self.assertNotIn(str(self.listing3.id), ids)

    # ============================================================
    # 9. Text search
    # ============================================================
    def test_text_search_across_fields(self):
        # Match in property description ("Arabian")
        res1 = self.client.get(f"{reverse('listings:listing-list')}?search=Arabian")
        self.assertEqual(res1.status_code, status.HTTP_200_OK)
        ids1 = [item["id"] for item in res1.data.get("data", res1.data.get("results", []))]
        self.assertEqual(ids1, [str(self.listing1.id)])

        # Case-insensitive match in listing description ("fInTeCh")
        res2 = self.client.get(f"{reverse('listings:listing-list')}?search=fInTeCh")
        self.assertEqual(res2.status_code, status.HTTP_200_OK)
        ids2 = [item["id"] for item in res2.data.get("data", res2.data.get("results", []))]
        self.assertEqual(ids2, [str(self.listing3.id)])

        # Match in property locality ("Mavoor")
        res3 = self.client.get(f"{reverse('listings:listing-list')}?search=Mavoor")
        self.assertEqual(res3.status_code, status.HTTP_200_OK)
        ids3 = [item["id"] for item in res3.data.get("data", res3.data.get("results", []))]
        self.assertEqual(ids3, [str(self.listing4.id)])

    # ============================================================
    # 10. Sorting in all supported directions
    # ============================================================
    def test_sorting_options(self):
        # 1. rent_low_to_high: 15k, 25k, 50k, 80k
        res_asc = self.client.get(f"{reverse('listings:listing-list')}?sort=rent_low_to_high")
        self.assertEqual(res_asc.status_code, status.HTTP_200_OK)
        rents_asc = [
            Decimal(str(item["monthly_rent"]))
            for item in res_asc.data.get("data", res_asc.data.get("results", []))
        ]
        self.assertEqual(
            rents_asc,
            [Decimal("15000.00"), Decimal("25000.00"), Decimal("50000.00"), Decimal("80000.00")],
        )

        # 2. rent_high_to_low: 80k, 50k, 25k, 15k
        res_desc = self.client.get(f"{reverse('listings:listing-list')}?sort=rent_high_to_low")
        self.assertEqual(res_desc.status_code, status.HTTP_200_OK)
        rents_desc = [
            Decimal(str(item["monthly_rent"]))
            for item in res_desc.data.get("data", res_desc.data.get("results", []))
        ]
        self.assertEqual(
            rents_desc,
            [Decimal("80000.00"), Decimal("50000.00"), Decimal("25000.00"), Decimal("15000.00")],
        )

        # 3. newest: Listing 3 (1 day ago), Listing 4 (3 days ago), Listing 2 (6 days ago), Listing 1 (10 days ago)
        res_new = self.client.get(f"{reverse('listings:listing-list')}?sort=newest")
        self.assertEqual(res_new.status_code, status.HTTP_200_OK)
        ids_new = [item["id"] for item in res_new.data.get("data", res_new.data.get("results", []))]
        self.assertEqual(
            ids_new,
            [str(self.listing3.id), str(self.listing4.id), str(self.listing2.id), str(self.listing1.id)],
        )

    # ============================================================
    # 11. Invalid query parameters
    # ============================================================
    def test_invalid_query_parameters(self):
        # min_rent > max_rent
        res_range = self.client.get(f"{reverse('listings:listing-list')}?min_rent=50000&max_rent=20000")
        self.assertEqual(res_range.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(res_range.data["success"])

        # negative min_rent
        res_neg = self.client.get(f"{reverse('listings:listing-list')}?min_rent=-100")
        self.assertEqual(res_neg.status_code, status.HTTP_400_BAD_REQUEST)

        # negative bedrooms
        res_bed = self.client.get(f"{reverse('listings:listing-list')}?bedrooms=-1")
        self.assertEqual(res_bed.status_code, status.HTTP_400_BAD_REQUEST)

        # invalid category enum
        res_cat = self.client.get(f"{reverse('listings:listing-list')}?category=martian_habitat")
        self.assertEqual(res_cat.status_code, status.HTTP_400_BAD_REQUEST)

        # invalid property_type enum
        res_type = self.client.get(f"{reverse('listings:listing-list')}?property_type=skyscraper")
        self.assertEqual(res_type.status_code, status.HTTP_400_BAD_REQUEST)

        # invalid furnishing_status enum
        res_furn = self.client.get(f"{reverse('listings:listing-list')}?furnishing_status=golden")
        self.assertEqual(res_furn.status_code, status.HTTP_400_BAD_REQUEST)

        # invalid available_from date
        res_date = self.client.get(f"{reverse('listings:listing-list')}?available_from=not-a-valid-date")
        self.assertEqual(res_date.status_code, status.HTTP_400_BAD_REQUEST)

        # unsupported sort option
        res_sort = self.client.get(f"{reverse('listings:listing-list')}?sort=cheapest_first")
        self.assertEqual(res_sort.status_code, status.HTTP_400_BAD_REQUEST)

    # ============================================================
    # 12. Pagination combined with filters
    # ============================================================
    def test_pagination_combined_with_filters(self):
        # Create 22 more Kozhikode residential listings (bringing total Kozhikode listings to 24)
        for i in range(22):
            prop = Property.objects.create(
                owner=self.owner,
                title=f"Kozhikode Batch Prop {i}",
                category=PropertyCategory.RESIDENTIAL,
                property_type=PropertyType.APARTMENT,
                address_line_1=f"Road {i}",
                locality="Kozhikode Beach",
                city="Kozhikode",
                district="Kozhikode",
                state="Kerala",
                pin_code="673001",
                bedrooms=2,
                bathrooms=Decimal("2.0"),
                status=PropertyStatus.AVAILABLE,
            )
            PropertyImage.objects.create(
                property=prop,
                image_url=f"https://images.example.com/batch_{i}.jpg",
                is_primary=True,
            )
            Listing.objects.create(
                property=prop,
                title=f"Kozhikode Flat {i} for Rent",
                monthly_rent=Decimal("20000.00"),
                status=ListingStatus.PUBLISHED,
            )

        # Page 1 filtering by city=Kozhikode
        res_p1 = self.client.get(f"{reverse('listings:listing-list')}?city=Kozhikode&page=1")
        self.assertEqual(res_p1.status_code, status.HTTP_200_OK)
        self.assertEqual(res_p1.data["count"], 24)
        self.assertEqual(len(res_p1.data["results"]), 20)
        self.assertIsNotNone(res_p1.data["next"])

        # Page 2
        res_p2 = self.client.get(f"{reverse('listings:listing-list')}?city=Kozhikode&page=2")
        self.assertEqual(res_p2.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res_p2.data["results"]), 4)
        self.assertIsNone(res_p2.data["next"])

    # ============================================================
    # 13. No private owner information in responses
    # ============================================================
    def test_no_private_owner_information_in_responses(self):
        res = self.client.get(reverse("listings:listing-list"))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        results = res.data.get("data", res.data.get("results", []))

        for item in results:
            self.assertNotIn("owner", item)
            self.assertNotIn("email", item)
            self.assertNotIn("reviewed_by", item)
            self.assertNotIn("rejection_reason", item)

            prop = item.get("property", {})
            self.assertNotIn("owner", prop)
            self.assertNotIn("email", prop)

