namespace vim.po.service;

using { vim.po as db } from '../db/schema';

service POService {

    entity POHeaders as projection on db.POHeader;

    entity POItems as projection on db.POItem;

    entity PODispatchAddresses as projection on db.PODispatchAddress;

    entity PODispatchItems as projection on db.PODispatchItem {
            *,
            cast(
                OrderedQuantity - CurrentDispatchQuantity
                as Decimal(15,3)
            ) as RemainingQuantity
        };

}
