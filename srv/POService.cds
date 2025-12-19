namespace vim.po.service;

using { vim.po as db } from '../db/schema';

service POService {

    entity VIM_PO_HEADERS as projection on db.VIM_PO_HEADERS;

    entity VIM_PO_ITEMS as projection on db.VIM_PO_ITEMS;

    entity VIM_PO_DISPATCH_ADDR as projection on db.VIM_PO_DISPATCH_ADDR;

    entity VIM_PO_DISPATCH_ITEMS as projection on db.VIM_PO_DISPATCH_ITEMS {
            *,
            cast(
                OrderedQuantity - CurrentDispatchQuantity
                as Decimal(15,3)
            ) as RemainingQuantity
        };

}
