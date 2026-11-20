from typing import Any
from django.http import HttpRequest
from django.utils.translation import gettext_lazy as _
from unfold.admin import ChangeList as UnfoldChangeList
from unfold.decorators import display


class SerialNumberAdminMixin:
    """
    Reusable ModelAdmin mixin that adds dynamic sequential row numbers (S.No.)
    to the admin changelist without altering the database schema.

    - Numbers rows sequentially starting from 1.
    - Accurately respects pagination offsets (e.g. page 2 starts at page_size + 1).
    - Preserves sequential numbering when filtering and searching.
    - Does not add any column or field to the underlying database table.
    """

    def get_changelist(self, request: HttpRequest, **kwargs: Any) -> type[UnfoldChangeList]:
        parent_changelist = super().get_changelist(request, **kwargs)

        class ModelSerialNumberChangeList(parent_changelist):
            def get_results(self, req: HttpRequest) -> None:
                super().get_results(req)
                results = list(self.result_list)
                if self.show_all:
                    start_index = 1
                else:
                    start_index = ((self.page_num - 1) * self.list_per_page) + 1

                for idx, obj in enumerate(results, start=start_index):
                    obj._serial_number = idx

                self.result_list = results

        return ModelSerialNumberChangeList

    @display(
        description=_("S.No."),
    )
    def serial_number(self, obj: Any) -> Any:
        """
        Return the dynamically computed sequential row number for the object.
        """
        return getattr(obj, "_serial_number", "-")

