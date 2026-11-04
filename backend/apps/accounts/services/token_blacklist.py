from rest_framework_simplejwt.token_blacklist.models import (
    BlacklistedToken,
    OutstandingToken,
)


def blacklist_user_refresh_tokens(user):
    """
    Blacklist all outstanding, unblacklisted refresh tokens belonging to the user.
    """
    unblacklisted_tokens = OutstandingToken.objects.filter(
        user=user,
        blacklistedtoken__isnull=True,
    )
    blacklisted_records = [BlacklistedToken(token=t) for t in unblacklisted_tokens]
    if blacklisted_records:
        BlacklistedToken.objects.bulk_create(blacklisted_records, ignore_conflicts=True)
