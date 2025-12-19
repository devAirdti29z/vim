sap.ui.define(['sap/fe/test/ListReport'], function(ListReport) {
    'use strict';

    var CustomPageDefinitions = {
        actions: {},
        assertions: {}
    };

    return new ListReport(
        {
            appId: 'dispatchcreation',
            componentId: 'VIM_PO_HEADERSList',
            contextPath: '/VIM_PO_HEADERS'
        },
        CustomPageDefinitions
    );
});