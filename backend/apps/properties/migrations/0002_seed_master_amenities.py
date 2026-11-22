import uuid
from django.db import migrations

INITIAL_AMENITIES = [
    {
        "id": "5a3d2378-81d6-44f9-9770-dd508f6bfe17",
        "name": "Wheelchair Accessible",
        "category": "accessibility",
        "description": "Ramps and accessible entrances",
        "is_active": True,
    },
    {
        "id": "cc005225-be35-4328-a559-dd2803b688cd",
        "name": "Piped Gas",
        "category": "appliance",
        "description": "Piped cooking gas connection",
        "is_active": True,
    },
    {
        "id": "ea846dca-a5f4-4a13-aa23-038d12a153a9",
        "name": "Solar Water Heater",
        "category": "appliance",
        "description": "Eco-friendly solar heated water",
        "is_active": True,
    },
    {
        "id": "284b9a1a-6e96-49ae-8257-2173b549303d",
        "name": "Children Play Area",
        "category": "building",
        "description": "Dedicated play area for children",
        "is_active": True,
    },
    {
        "id": "847844ab-ecfc-4f0e-bf65-5bfdcbb81e1c",
        "name": "Clubhouse",
        "category": "building",
        "description": "Community clubhouse",
        "is_active": True,
    },
    {
        "id": "588c2ec2-0742-49cc-95f2-de9a5c1a5cf4",
        "name": "Gym / Fitness Centre",
        "category": "building",
        "description": "Equipped fitness centre",
        "is_active": True,
    },
    {
        "id": "0d7bba79-72d0-4a64-86af-4b3b28067e18",
        "name": "Lift / Elevator",
        "category": "building",
        "description": "High-speed passenger elevator",
        "is_active": True,
    },
    {
        "id": "e2bcf5db-45ad-4e36-8e18-9267c4248958",
        "name": "Swimming Pool",
        "category": "building",
        "description": "Outdoor swimming pool",
        "is_active": True,
    },
    {
        "id": "d003466b-4626-4445-8c82-99ce33f2df4d",
        "name": "High-Speed Wi-Fi",
        "category": "connectivity",
        "description": "Fibre-optic internet provision",
        "is_active": True,
    },
    {
        "id": "2fa82011-d315-4dab-b5ee-b23dd4f5788e",
        "name": "Intercom",
        "category": "connectivity",
        "description": "Internal intercom system",
        "is_active": True,
    },
    {
        "id": "65d25c3c-101d-48e3-8409-b68824d56b64",
        "name": "Air Conditioning",
        "category": "hvac",
        "description": "Central or split AC units installed",
        "is_active": True,
    },
    {
        "id": "2b8dce52-9761-406b-9056-3979d85f9e4c",
        "name": "Power Backup",
        "category": "power_backup",
        "description": "100% DG power backup",
        "is_active": True,
    },
    {
        "id": "2da931e5-eaf9-4055-a8d1-172e939bfa7e",
        "name": "Jogging Track",
        "category": "recreation",
        "description": "Paved jogging and walking track",
        "is_active": True,
    },
    {
        "id": "26b96e13-93b8-4471-bbd9-c9e4cb7439e5",
        "name": "24x7 Security",
        "category": "safety",
        "description": "24x7 on-site security guards",
        "is_active": True,
    },
    {
        "id": "6dbf0289-c692-4531-b0e7-c53e704c952e",
        "name": "CCTV Surveillance",
        "category": "safety",
        "description": "Continuous CCTV monitoring",
        "is_active": True,
    },
    {
        "id": "c570cc3c-af31-43ad-976a-e8fcbbc714a0",
        "name": "Gated Community",
        "category": "safety",
        "description": "Secured gated perimeter",
        "is_active": True,
    },
]


def seed_master_amenities(apps, schema_editor):
    Amenity = apps.get_model("properties", "Amenity")
    for item in INITIAL_AMENITIES:
        defaults = {
            "category": item["category"],
            "description": item["description"],
            "is_active": item["is_active"],
        }
        if not Amenity.objects.filter(name=item["name"]).exists():
            defaults["id"] = uuid.UUID(item["id"])
            Amenity.objects.create(name=item["name"], **defaults)
        else:
            Amenity.objects.filter(name=item["name"]).update(is_active=True)


def reverse_seed_master_amenities(apps, schema_editor):
    Amenity = apps.get_model("properties", "Amenity")
    Amenity.objects.filter(
        name__in=[item["name"] for item in INITIAL_AMENITIES]
    ).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("properties", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(
            seed_master_amenities,
            reverse_code=reverse_seed_master_amenities,
        ),
    ]

