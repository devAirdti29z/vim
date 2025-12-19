sap.ui.define(['sap/fe/test/ObjectPage'], function(ObjectPage) {
    'use strict';

    var CustomPageDefinitions = {
        actions: {},
        assertions: {}
    };

    return new ObjectPage(
        {
            appId: 'dispatchcreation',
            componentId: 'VIM_PO_HEADERSObjectPage',
            contextPath: '/VIM_PO_HEADERS'
        },
        CustomPageDefinitions
    );
});