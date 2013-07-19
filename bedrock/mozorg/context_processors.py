# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

import re
from datetime import datetime


# match 1 - 4 digits only
FC_RE = re.compile(r'^\d{1,4}$')


def current_year(request):
    return {"current_year": datetime.today().year}


def funnelcake_param(request):
    """If a query param for a funnelcake is sent, add it to the context."""
    fc_id = request.GET.get('f', None)
    context = {}

    if fc_id and FC_RE.match(fc_id):
        context['funnelcake_id'] = fc_id

    return context
