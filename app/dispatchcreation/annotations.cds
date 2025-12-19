using vim.po.service.POService as service from '../../srv/POService';
annotate service.VIM_PO_HEADERS with @(
    UI.FieldGroup #GeneratedGroup : {
        $Type : 'UI.FieldGroupType',
        Data : [
            {
                $Type : 'UI.DataField',
                Label : 'PONumber',
                Value : PONumber,
            },
            {
                $Type : 'UI.DataField',
                Label : 'PlantCode',
                Value : PlantCode,
            },
            {
                $Type : 'UI.DataField',
                Label : 'PlantDescription',
                Value : PlantDescription,
            },
            {
                $Type : 'UI.DataField',
                Label : 'PlantAddress',
                Value : PlantAddress,
            },
            {
                $Type : 'UI.DataField',
                Label : 'CreationDate',
                Value : CreationDate,
            },
            {
                $Type : 'UI.DataField',
                Label : 'SupplierName',
                Value : SupplierName,
            },
            {
                $Type : 'UI.DataField',
                Label : 'SupplierCode',
                Value : SupplierCode,
            },
            {
                $Type : 'UI.DataField',
                Label : 'SupplierAddress',
                Value : SupplierAddress,
            },
            {
                $Type : 'UI.DataField',
                Label : 'SupplierEmail',
                Value : SupplierEmail,
            },
        ],
    },
    UI.Facets : [
        {
            $Type : 'UI.ReferenceFacet',
            ID : 'GeneratedFacet1',
            Label : 'General Information',
            Target : '@UI.FieldGroup#GeneratedGroup',
        },
    ],
    UI.LineItem : [
        {
            $Type : 'UI.DataField',
            Label : 'PlantCode',
            Value : PlantCode,
        },
        {
            $Type : 'UI.DataField',
            Label : 'PONumber',
            Value : PONumber,
        },
        {
            $Type : 'UI.DataField',
            Label : 'PlantDescription',
            Value : PlantDescription,
        },
        {
            $Type : 'UI.DataField',
            Label : 'PlantAddress',
            Value : PlantAddress,
        },
        {
            $Type : 'UI.DataField',
            Label : 'CreationDate',
            Value : CreationDate,
        },
    ],
);

